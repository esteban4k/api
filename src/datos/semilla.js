// Datos iniciales. Las fechas se calculan desde "ahora" para que los préstamos
// activos tengan siempre la misma antigüedad cada vez que se reinicia la API.
const { LIMITE_MINUTOS, MINUTOS_POR_DIA_SANCION, DIAS_SANCION_MAX, FACTOR_RUTA } = require('../config');
const { MINUTO, sumarMinutos, distanciaKm, redondear } = require('../utils/comunes');

const DIA = 24 * 60 * MINUTO;

const ESTACIONES = [
  { id: 'EST-01', nombre: 'Universidad de Antioquia', zona: 'Norte', capacidad: 14, coordenadas: { lat: 6.2675, lng: -75.5686 } },
  { id: 'EST-02', nombre: 'Parque Explora', zona: 'Norte', capacidad: 12, coordenadas: { lat: 6.2706, lng: -75.5656 } },
  { id: 'EST-03', nombre: 'Parque Berrío', zona: 'Centro', capacidad: 10, coordenadas: { lat: 6.2502, lng: -75.5682 } },
  { id: 'EST-04', nombre: 'San Antonio', zona: 'Centro', capacidad: 10, coordenadas: { lat: 6.2468, lng: -75.5694 } },
  { id: 'EST-05', nombre: 'Estadio Atanasio Girardot', zona: 'Laureles', capacidad: 14, coordenadas: { lat: 6.2567, lng: -75.59 } },
  { id: 'EST-06', nombre: 'Primer Parque de Laureles', zona: 'Laureles', capacidad: 10, coordenadas: { lat: 6.2449, lng: -75.5952 } },
  { id: 'EST-07', nombre: 'Ciudad del Río', zona: 'El Poblado', capacidad: 12, coordenadas: { lat: 6.2229, lng: -75.5747 } },
  { id: 'EST-08', nombre: 'Parque Lleras', zona: 'El Poblado', capacidad: 8, coordenadas: { lat: 6.2085, lng: -75.5672 } },
];

// Bicicletas ancladas en cada estación al iniciar.
// EST-03 tiene una eléctrica sin carga, EST-04 está vacía y EST-08 está llena:
// sirven para probar los errores de negocio.
const DISTRIBUCION = [
  { estacionId: 'EST-01', mecanicas: 6, electricas: 3, mantenimiento: 1 },
  { estacionId: 'EST-02', mecanicas: 4, electricas: 2, mantenimiento: 0 },
  { estacionId: 'EST-03', mecanicas: 3, electricas: 1, mantenimiento: 0, baterias: [12] },
  { estacionId: 'EST-04', mecanicas: 0, electricas: 0, mantenimiento: 0 },
  { estacionId: 'EST-05', mecanicas: 7, electricas: 3, mantenimiento: 1 },
  { estacionId: 'EST-06', mecanicas: 3, electricas: 2, mantenimiento: 0 },
  { estacionId: 'EST-07', mecanicas: 4, electricas: 2, mantenimiento: 0 },
  { estacionId: 'EST-08', mecanicas: 6, electricas: 2, mantenimiento: 0 },
];

const BATERIAS = [92, 78, 64, 88, 100, 57, 71, 83, 97, 46, 69, 90, 81, 74];

function crearBicicletas() {
  const bicicletas = [];
  let consecutivo = 0;
  let indiceBateria = 0;

  const agregar = (tipo, estacionId, estado, extra = {}) => {
    consecutivo += 1;
    bicicletas.push({
      id: `BIC-${String(consecutivo).padStart(3, '0')}`,
      tipo,
      modelo: tipo === 'electrica' ? 'E-Urbana 250W' : 'Urbana 7V',
      estado,
      estacionId,
      bateria: tipo === 'electrica' ? BATERIAS[indiceBateria++ % BATERIAS.length] : null,
      kmRecorridos: 120 + ((consecutivo * 37) % 900),
      nota: null,
      ...extra,
    });
  };

  for (const d of DISTRIBUCION) {
    for (let i = 0; i < d.mecanicas; i++) agregar('mecanica', d.estacionId, 'disponible');
    for (let i = 0; i < d.electricas; i++) {
      agregar('electrica', d.estacionId, 'disponible', d.baterias?.[i] != null ? { bateria: d.baterias[i] } : {});
    }
    for (let i = 0; i < d.mantenimiento; i++) {
      agregar('mecanica', d.estacionId, 'mantenimiento', { nota: 'Revisión de frenos programada' });
    }
  }

  // Dos bicicletas que están rodando ahora mismo (préstamos PRE-0001 y PRE-0002).
  agregar('mecanica', null, 'en_uso'); // BIC-051
  agregar('electrica', null, 'en_uso', { bateria: 58 }); // BIC-052

  return bicicletas;
}

function crearUsuarios(ahora) {
  return [
    { id: 'USR-1001', nombre: 'Laura Gómez', documento: '1036654321', correo: 'laura.gomez@ejemplo.com', plan: 'estudiante', sancionadoHasta: null, prestamoActivoId: null, registradoEn: '2026-02-03' },
    { id: 'USR-1002', nombre: 'Andrés Restrepo', documento: '71234567', correo: 'andres.restrepo@ejemplo.com', plan: 'general', sancionadoHasta: null, prestamoActivoId: 'PRE-0001', registradoEn: '2025-11-20' },
    { id: 'USR-1003', nombre: 'Valentina Ríos', documento: '1001987654', correo: 'valentina.rios@ejemplo.com', plan: 'estudiante', sancionadoHasta: null, prestamoActivoId: 'PRE-0002', registradoEn: '2026-03-14' },
    { id: 'USR-1004', nombre: 'Camilo Zapata', documento: '98765432', correo: 'camilo.zapata@ejemplo.com', plan: 'general', sancionadoHasta: new Date(ahora + 2 * DIA - 4 * 60 * MINUTO).toISOString(), prestamoActivoId: null, registradoEn: '2025-08-09' },
    { id: 'USR-1005', nombre: 'Sara Mejía', documento: '1152345678', correo: 'sara.mejia@ejemplo.com', plan: 'estudiante', sancionadoHasta: null, prestamoActivoId: null, registradoEn: '2026-05-22' },
    { id: 'USR-1006', nombre: 'Julián Ospina', documento: '1017456789', correo: 'julian.ospina@ejemplo.com', plan: 'general', sancionadoHasta: null, prestamoActivoId: null, registradoEn: '2026-07-01' },
  ];
}

function crearPrestamos(ahora, usuarios) {
  const estacion = (id) => ESTACIONES.find((e) => e.id === id);
  const plan = (usuarioId) => usuarios.find((u) => u.id === usuarioId).plan;

  const activo = ({ id, usuarioId, bicicletaId, tipoBicicleta, estacionOrigenId, haceMinutos }) => {
    const inicio = new Date(ahora - haceMinutos * MINUTO);
    return {
      id, usuarioId, bicicletaId, tipoBicicleta, estacionOrigenId,
      estacionDestinoId: null,
      inicio: inicio.toISOString(),
      limiteDevolucion: sumarMinutos(inicio, LIMITE_MINUTOS[plan(usuarioId)]).toISOString(),
      fin: null, duracionMin: null, distanciaKm: null,
      minutosExcedidos: 0, diasSancion: 0, reporteDanio: null,
      estado: 'activo',
    };
  };

  const finalizado = ({ id, usuarioId, bicicletaId, tipoBicicleta, estacionOrigenId, estacionDestinoId, terminoHaceMinutos, duracionMin }) => {
    const fin = new Date(ahora - terminoHaceMinutos * MINUTO);
    const inicio = sumarMinutos(fin, -duracionMin);
    const limite = LIMITE_MINUTOS[plan(usuarioId)];
    const minutosExcedidos = Math.max(0, duracionMin - limite);
    const diasSancion = minutosExcedidos > 0 ? Math.min(DIAS_SANCION_MAX, Math.ceil(minutosExcedidos / MINUTOS_POR_DIA_SANCION)) : 0;
    const km = distanciaKm(estacion(estacionOrigenId).coordenadas, estacion(estacionDestinoId).coordenadas) * FACTOR_RUTA;
    return {
      id, usuarioId, bicicletaId, tipoBicicleta, estacionOrigenId, estacionDestinoId,
      inicio: inicio.toISOString(),
      limiteDevolucion: sumarMinutos(inicio, limite).toISOString(),
      fin: fin.toISOString(),
      duracionMin,
      distanciaKm: redondear(km),
      minutosExcedidos, diasSancion, reporteDanio: null,
      estado: 'finalizado',
    };
  };

  return [
    activo({ id: 'PRE-0001', usuarioId: 'USR-1002', bicicletaId: 'BIC-051', tipoBicicleta: 'mecanica', estacionOrigenId: 'EST-02', haceMinutos: 20 }),
    // Lleva 95 min y su plan permite 60: al devolverla recibe sanción.
    activo({ id: 'PRE-0002', usuarioId: 'USR-1003', bicicletaId: 'BIC-052', tipoBicicleta: 'electrica', estacionOrigenId: 'EST-05', haceMinutos: 95 }),
    finalizado({ id: 'PRE-0003', usuarioId: 'USR-1001', bicicletaId: 'BIC-017', tipoBicicleta: 'mecanica', estacionOrigenId: 'EST-01', estacionDestinoId: 'EST-03', terminoHaceMinutos: 26 * 60, duracionMin: 18 }),
    // Este préstamo de 70 min (plan general: 45) explica la sanción de Camilo.
    finalizado({ id: 'PRE-0004', usuarioId: 'USR-1004', bicicletaId: 'BIC-041', tipoBicicleta: 'electrica', estacionOrigenId: 'EST-06', estacionDestinoId: 'EST-07', terminoHaceMinutos: 4 * 60, duracionMin: 70 }),
    finalizado({ id: 'PRE-0005', usuarioId: 'USR-1005', bicicletaId: 'BIC-043', tipoBicicleta: 'mecanica', estacionOrigenId: 'EST-07', estacionDestinoId: 'EST-08', terminoHaceMinutos: 2 * 24 * 60, duracionMin: 12 }),
  ];
}

function crearAuditoria(ahora) {
  return [
    { fecha: new Date(ahora - 3 * DIA).toISOString(), bicicletaId: 'BIC-010', estadoAnterior: 'disponible', estadoNuevo: 'mantenimiento', motivo: 'Revisión de frenos programada' },
    { fecha: new Date(ahora - 2 * DIA).toISOString(), bicicletaId: 'BIC-031', estadoAnterior: 'disponible', estadoNuevo: 'mantenimiento', motivo: 'Revisión de frenos programada' },
  ];
}

function crearSemilla() {
  const ahora = Date.now();
  const usuarios = crearUsuarios(ahora);
  return {
    estaciones: ESTACIONES.map((e) => ({ ...e, coordenadas: { ...e.coordenadas } })),
    bicicletas: crearBicicletas(),
    usuarios,
    prestamos: crearPrestamos(ahora, usuarios),
    auditoria: crearAuditoria(ahora),
    contadores: { prestamo: 5, usuario: 1006 },
  };
}

module.exports = { crearSemilla };
