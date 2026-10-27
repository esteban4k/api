const { Router } = require('express');
const { db, buscar } = require('../datos/db');
const { responder } = require('../utils/respuestas');
const { enumConsulta, enteroConsulta, booleanoConsulta } = require('../utils/validar');
const { normalizar } = require('../utils/comunes');
const { estacionConDisponibilidad, bicisAncladas } = require('../servicios/estaciones');

const router = Router();

// GET /api/estaciones?zona=Norte&tipo=electrica&minDisponibles=1&conAnclajes=true&q=parque
router.get('/', (req, res) => {
  const zona = req.query.zona !== undefined ? String(req.query.zona) : undefined;
  const q = req.query.q !== undefined ? String(req.query.q) : undefined;
  const tipo = enumConsulta(req.query.tipo, 'tipo', ['mecanica', 'electrica']);
  const minDisponibles = enteroConsulta(req.query.minDisponibles, 'minDisponibles');
  const conAnclajes = booleanoConsulta(req.query.conAnclajes, 'conAnclajes');

  let estaciones = db.estaciones.map(estacionConDisponibilidad);

  if (zona) estaciones = estaciones.filter((e) => normalizar(e.zona) === normalizar(zona));
  if (q) estaciones = estaciones.filter((e) => normalizar(e.nombre).includes(normalizar(q)));
  if (tipo) estaciones = estaciones.filter((e) => e.disponibilidad[tipo === 'mecanica' ? 'mecanicas' : 'electricas'] > 0);
  if (minDisponibles !== undefined) estaciones = estaciones.filter((e) => e.disponibilidad.bicisDisponibles >= minDisponibles);
  if (conAnclajes !== undefined) estaciones = estaciones.filter((e) => (e.disponibilidad.anclajesLibres > 0) === conAnclajes);

  responder(res, 200, {
    total: estaciones.length,
    filtros: { zona: zona ?? null, tipo: tipo ?? null, minDisponibles: minDisponibles ?? null, conAnclajes: conAnclajes ?? null, q: q ?? null },
    datos: estaciones,
  });
});

// GET /api/estaciones/EST-01
router.get('/:id', (req, res) => {
  const estacion = buscar('estaciones', req.params.id);
  const bicicletas = bicisAncladas(estacion.id).map(({ id, tipo, estado, bateria, kmRecorridos, nota }) => ({ id, tipo, estado, bateria, kmRecorridos, nota }));
  const prestamosActivosDesdeAqui = db.prestamos.filter((p) => p.estado === 'activo' && p.estacionOrigenId === estacion.id).length;

  responder(res, 200, {
    datos: { ...estacionConDisponibilidad(estacion), prestamosActivosDesdeAqui, bicicletas },
  });
});

module.exports = router;
