const { db, buscar, siguienteId } = require('../datos/db');
const config = require('../config');
const { errores } = require('../utils/respuestas');
const { minutosEntre, sumarMinutos, horaCorta, fechaHora, distanciaKm, redondear } = require('../utils/comunes');
const { bicisAncladas, esPrestable, disponibilidad, cercanasConAnclajes } = require('./estaciones');

const TIPO_TEXTO = { mecanica: 'mecánica', electrica: 'eléctrica' };

// Agrega al préstamo activo cuánto tiempo lleva y cuánto le queda.
function prestamoPublico(prestamo, ahora = Date.now()) {
  if (prestamo.estado !== 'activo') return { ...prestamo };
  const transcurridos = minutosEntre(prestamo.inicio, ahora);
  const limite = minutosEntre(prestamo.inicio, prestamo.limiteDevolucion);
  return {
    ...prestamo,
    minutosTranscurridos: transcurridos,
    minutosRestantes: limite - transcurridos,
    vencido: transcurridos > limite,
  };
}

// Si la sanción ya pasó, se limpia.
function sancionVigente(usuario, ahora = Date.now()) {
  if (usuario.sancionadoHasta && new Date(usuario.sancionadoHasta).getTime() <= ahora) {
    usuario.sancionadoHasta = null;
  }
  return usuario.sancionadoHasta;
}

// Eléctrica: la de más batería. Mecánica: la de menos km (así se reparte el desgaste).
function elegirBicicleta(estacionId, tipo) {
  const candidatas = bicisAncladas(estacionId).filter((b) => esPrestable(b) && (!tipo || b.tipo === tipo));
  if (candidatas.length === 0) return null;
  const mecanicas = candidatas.filter((b) => b.tipo === 'mecanica');
  if (!tipo && mecanicas.length > 0) return mecanicas.sort((a, b) => a.kmRecorridos - b.kmRecorridos)[0];
  if (tipo === 'mecanica') return candidatas.sort((a, b) => a.kmRecorridos - b.kmRecorridos)[0];
  return candidatas.sort((a, b) => b.bateria - a.bateria)[0];
}

function crearPrestamo({ usuarioId, estacionId, tipo }) {
  const usuario = buscar('usuarios', usuarioId);

  const sancion = sancionVigente(usuario);
  if (sancion) {
    throw errores.prohibido('USUARIO_SANCIONADO', `${usuario.nombre} está sancionado hasta el ${fechaHora(sancion)} y no puede prestar bicicletas.`, {
      sancionadoHasta: sancion,
    });
  }
  if (usuario.prestamoActivoId) {
    throw errores.conflicto('PRESTAMO_ACTIVO_EXISTENTE', `${usuario.nombre} ya tiene una bicicleta prestada. Debe devolverla antes de pedir otra.`, {
      prestamoActivoId: usuario.prestamoActivoId,
    });
  }

  const estacion = buscar('estaciones', estacionId);
  const bici = elegirBicicleta(estacion.id, tipo);
  if (!bici) {
    const d = disponibilidad(estacion);
    const pedido = tipo ? ` ${TIPO_TEXTO[tipo]}s` : '';
    throw errores.conflicto('SIN_BICICLETAS_DISPONIBLES', `No hay bicicletas${pedido} disponibles en ${estacion.nombre}.`, {
      tipoSolicitado: tipo ?? 'cualquiera',
      mecanicas: d.mecanicas,
      electricas: d.electricas,
      electricasSinCarga: d.electricasSinCarga,
      bateriaMinima: config.BATERIA_MINIMA,
    });
  }

  const inicio = new Date();
  const limiteMin = config.LIMITE_MINUTOS[usuario.plan];
  const prestamo = {
    id: siguienteId('prestamo'),
    usuarioId: usuario.id,
    bicicletaId: bici.id,
    tipoBicicleta: bici.tipo,
    estacionOrigenId: estacion.id,
    estacionDestinoId: null,
    inicio: inicio.toISOString(),
    limiteDevolucion: sumarMinutos(inicio, limiteMin).toISOString(),
    fin: null,
    duracionMin: null,
    distanciaKm: null,
    minutosExcedidos: 0,
    diasSancion: 0,
    reporteDanio: null,
    estado: 'activo',
  };

  db.prestamos.push(prestamo);
  bici.estado = 'en_uso';
  bici.estacionId = null;
  usuario.prestamoActivoId = prestamo.id;

  return {
    mensaje: `Préstamo ${prestamo.id} creado: ${bici.id} (${TIPO_TEXTO[bici.tipo]}) desde ${estacion.nombre}. Devuélvela antes de las ${horaCorta(prestamo.limiteDevolucion)} (${limiteMin} min).`,
    datos: { prestamo: prestamoPublico(prestamo), bicicleta: { ...bici }, usuario: { id: usuario.id, nombre: usuario.nombre, plan: usuario.plan } },
  };
}

function devolverBicicleta(prestamoId, { estacionId, reporteDanio }) {
  const prestamo = buscar('prestamos', prestamoId);
  if (prestamo.estado !== 'activo') {
    throw errores.conflicto('PRESTAMO_NO_ACTIVO', `El préstamo ${prestamo.id} ya está ${prestamo.estado}.`, { estado: prestamo.estado });
  }

  const destino = buscar('estaciones', estacionId);
  if (disponibilidad(destino).anclajesLibres === 0) {
    throw errores.conflicto('ESTACION_LLENA', `${destino.nombre} no tiene anclajes libres. Prueba en una estación cercana.`, {
      sugerencias: cercanasConAnclajes(destino),
    });
  }

  const usuario = buscar('usuarios', prestamo.usuarioId);
  const bici = buscar('bicicletas', prestamo.bicicletaId);
  const origen = buscar('estaciones', prestamo.estacionOrigenId);
  const ahora = new Date();

  const duracionMin = Math.max(0, minutosEntre(prestamo.inicio, ahora));
  const limiteMin = minutosEntre(prestamo.inicio, prestamo.limiteDevolucion);
  const minutosExcedidos = Math.max(0, duracionMin - limiteMin);
  const diasSancion = minutosExcedidos > 0
    ? Math.min(config.DIAS_SANCION_MAX, Math.ceil(minutosExcedidos / config.MINUTOS_POR_DIA_SANCION))
    : 0;
  const km = redondear(distanciaKm(origen.coordenadas, destino.coordenadas) * config.FACTOR_RUTA);

  Object.assign(prestamo, {
    estado: 'finalizado',
    estacionDestinoId: destino.id,
    fin: ahora.toISOString(),
    duracionMin,
    distanciaKm: km,
    minutosExcedidos,
    diasSancion,
    reporteDanio: reporteDanio ? reporteDanio.trim() : null,
  });

  bici.estacionId = destino.id;
  bici.kmRecorridos = redondear(bici.kmRecorridos + km, 1);
  if (bici.tipo === 'electrica') {
    bici.bateria = Math.max(0, Math.round(bici.bateria - duracionMin * config.CONSUMO_BATERIA_POR_MINUTO));
  }
  if (reporteDanio) {
    const motivo = `Daño reportado al devolver: ${reporteDanio.trim()}`;
    db.auditoria.push({ fecha: ahora.toISOString(), bicicletaId: bici.id, estadoAnterior: 'en_uso', estadoNuevo: 'mantenimiento', motivo });
    bici.estado = 'mantenimiento';
    bici.nota = motivo;
  } else {
    bici.estado = 'disponible';
  }

  usuario.prestamoActivoId = null;
  let sancion = { aplicada: false, dias: 0, hasta: null };
  if (diasSancion > 0) {
    const nuevaFecha = sumarMinutos(ahora, diasSancion * 24 * 60);
    const actual = usuario.sancionadoHasta ? new Date(usuario.sancionadoHasta) : null;
    usuario.sancionadoHasta = (actual && actual > nuevaFecha ? actual : nuevaFecha).toISOString();
    sancion = { aplicada: true, dias: diasSancion, hasta: usuario.sancionadoHasta };
  }

  const resumen = diasSancion > 0
    ? `Se pasó ${minutosExcedidos} min del límite: ${diasSancion} día(s) de sanción.`
    : 'Devuelta a tiempo, sin sanción.';

  return {
    mensaje: `Bicicleta ${bici.id} devuelta en ${destino.nombre} tras ${duracionMin} min y ${km} km. ${resumen}`,
    datos: { prestamo: prestamoPublico(prestamo), bicicleta: { ...bici }, sancion },
  };
}

function cancelarPrestamo(prestamoId) {
  const prestamo = buscar('prestamos', prestamoId);
  if (prestamo.estado !== 'activo') {
    throw errores.conflicto('PRESTAMO_NO_ACTIVO', `El préstamo ${prestamo.id} ya está ${prestamo.estado}.`, { estado: prestamo.estado });
  }

  const transcurridos = minutosEntre(prestamo.inicio, Date.now());
  if (transcurridos > config.MINUTOS_CANCELACION) {
    throw errores.conflicto('CANCELACION_FUERA_DE_TIEMPO', `Solo se puede cancelar en los primeros ${config.MINUTOS_CANCELACION} minutos; este préstamo lleva ${transcurridos}. Usa la devolución.`, {
      minutosTranscurridos: transcurridos,
      devolucion: `PATCH /api/prestamos/${prestamo.id}/devolucion`,
    });
  }

  const origen = buscar('estaciones', prestamo.estacionOrigenId);
  if (disponibilidad(origen).anclajesLibres === 0) {
    throw errores.conflicto('ESTACION_LLENA', `${origen.nombre} ya no tiene anclajes libres para recibir la bicicleta de vuelta.`, {
      sugerencias: cercanasConAnclajes(origen),
    });
  }

  const bici = buscar('bicicletas', prestamo.bicicletaId);
  const usuario = buscar('usuarios', prestamo.usuarioId);

  Object.assign(prestamo, { estado: 'cancelado', fin: new Date().toISOString(), duracionMin: transcurridos, estacionDestinoId: origen.id, distanciaKm: 0 });
  bici.estado = 'disponible';
  bici.estacionId = origen.id;
  usuario.prestamoActivoId = null;

  return {
    mensaje: `Préstamo ${prestamo.id} cancelado. ${bici.id} volvió a ${origen.nombre}.`,
    datos: { prestamo: prestamoPublico(prestamo), bicicleta: { ...bici } },
  };
}

module.exports = { prestamoPublico, sancionVigente, crearPrestamo, devolverBicicleta, cancelarPrestamo };
