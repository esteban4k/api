const { Router } = require('express');
const { db, reiniciar } = require('../datos/db');
const config = require('../config');
const { responder } = require('../utils/respuestas');
const { redondear } = require('../utils/comunes');
const { disponibilidad } = require('../servicios/estaciones');
const { sancionVigente } = require('../servicios/prestamos');
const { version } = require('../../package.json');

const router = Router();
const arranque = Date.now();

const ENDPOINTS = [
  ['GET', '/api', 'Este índice'],
  ['GET', '/api/salud', 'Estado del servicio'],
  ['GET', '/api/estadisticas', 'Resumen de flota, estaciones, préstamos y usuarios'],
  ['GET', '/api/estaciones', 'Listar estaciones. Filtros: zona, tipo, minDisponibles, conAnclajes, q'],
  ['GET', '/api/estaciones/:id', 'Detalle de una estación con sus bicicletas'],
  ['GET', '/api/bicicletas', 'Listar bicicletas. Filtros: estado, tipo, estacionId, bateriaMin'],
  ['GET', '/api/bicicletas/:id', 'Detalle de una bicicleta con historial'],
  ['PATCH', '/api/bicicletas/:id/estado', 'Enviar a mantenimiento o habilitar una bicicleta'],
  ['GET', '/api/usuarios', 'Listar usuarios. Filtro: plan'],
  ['GET', '/api/usuarios/:id', 'Perfil, préstamo activo e historial de un usuario'],
  ['POST', '/api/usuarios', 'Registrar un usuario'],
  ['GET', '/api/prestamos', 'Listar préstamos. Filtros: estado, usuarioId, estacionId'],
  ['GET', '/api/prestamos/:id', 'Detalle de un préstamo'],
  ['POST', '/api/prestamos', 'Prestar una bicicleta'],
  ['PATCH', '/api/prestamos/:id/devolucion', 'Devolver la bicicleta en una estación'],
  ['DELETE', '/api/prestamos/:id', 'Cancelar un préstamo recién creado'],
  ['GET', '/api/auditoria', 'Cambios de estado de las bicicletas'],
  ['POST', '/api/reset', 'Volver a los datos iniciales'],
];

router.get('/', (req, res) => {
  responder(res, 200, {
    mensaje: 'PedalVerde API: sistema de bicicletas compartidas. La consola web está en /',
    reglas: {
      limiteMinutosPorPlan: config.LIMITE_MINUTOS,
      diasSancion: `1 por cada ${config.MINUTOS_POR_DIA_SANCION} min de exceso (máx. ${config.DIAS_SANCION_MAX})`,
      bateriaMinimaElectricas: config.BATERIA_MINIMA,
      minutosParaCancelar: config.MINUTOS_CANCELACION,
    },
    datos: ENDPOINTS.map(([metodo, ruta, descripcion]) => ({ metodo, ruta, descripcion })),
  });
});

router.get('/salud', (req, res) => {
  responder(res, 200, {
    datos: { estado: 'ok', servicio: 'PedalVerde API', version, segundosActivo: Math.round((Date.now() - arranque) / 1000) },
  });
});

router.get('/estadisticas', (req, res) => {
  const cuenta = (lista, fn) => lista.filter(fn).length;
  const electricas = db.bicicletas.filter((b) => b.tipo === 'electrica');
  const disp = db.estaciones.map((e) => ({ estacion: e, d: disponibilidad(e) }));
  const finalizados = db.prestamos.filter((p) => p.estado === 'finalizado');

  const zonas = [...new Set(db.estaciones.map((e) => e.zona))].map((zona) => {
    const deZona = disp.filter((x) => x.estacion.zona === zona);
    return {
      zona,
      estaciones: deZona.length,
      bicisDisponibles: deZona.reduce((s, x) => s + x.d.bicisDisponibles, 0),
      anclajesLibres: deZona.reduce((s, x) => s + x.d.anclajesLibres, 0),
    };
  });

  responder(res, 200, {
    datos: {
      flota: {
        total: db.bicicletas.length,
        disponibles: cuenta(db.bicicletas, (b) => b.estado === 'disponible'),
        enUso: cuenta(db.bicicletas, (b) => b.estado === 'en_uso'),
        enMantenimiento: cuenta(db.bicicletas, (b) => b.estado === 'mantenimiento'),
        mecanicas: db.bicicletas.length - electricas.length,
        electricas: electricas.length,
        bateriaPromedioElectricas: Math.round(electricas.reduce((s, b) => s + b.bateria, 0) / (electricas.length || 1)),
      },
      estaciones: {
        total: db.estaciones.length,
        capacidadTotal: db.estaciones.reduce((s, e) => s + e.capacidad, 0),
        anclajesLibres: disp.reduce((s, x) => s + x.d.anclajesLibres, 0),
        vacias: cuenta(disp, (x) => x.d.bicisDisponibles === 0),
        llenas: cuenta(disp, (x) => x.d.anclajesLibres === 0),
      },
      prestamos: {
        total: db.prestamos.length,
        activos: cuenta(db.prestamos, (p) => p.estado === 'activo'),
        finalizados: finalizados.length,
        cancelados: cuenta(db.prestamos, (p) => p.estado === 'cancelado'),
        duracionPromedioMin: finalizados.length ? Math.round(finalizados.reduce((s, p) => s + p.duracionMin, 0) / finalizados.length) : 0,
        kmTotales: redondear(finalizados.reduce((s, p) => s + p.distanciaKm, 0)),
        conSancion: cuenta(finalizados, (p) => p.diasSancion > 0),
      },
      usuarios: {
        total: db.usuarios.length,
        sancionados: cuenta(db.usuarios, (u) => sancionVigente(u)),
        conPrestamo: cuenta(db.usuarios, (u) => u.prestamoActivoId),
      },
      zonas,
    },
  });
});

router.get('/auditoria', (req, res) => {
  responder(res, 200, { total: db.auditoria.length, datos: [...db.auditoria].reverse() });
});

router.post('/reset', (req, res) => {
  reiniciar();
  responder(res, 200, {
    mensaje: 'Datos reiniciados a la semilla inicial.',
    datos: { estaciones: db.estaciones.length, bicicletas: db.bicicletas.length, usuarios: db.usuarios.length, prestamos: db.prestamos.length },
  });
});

module.exports = router;
