const { Router } = require('express');
const { db, buscar } = require('../datos/db');
const { responder } = require('../utils/respuestas');
const { validarCuerpo, enumConsulta } = require('../utils/validar');
const { prestamoPublico, crearPrestamo, devolverBicicleta, cancelarPrestamo } = require('../servicios/prestamos');

const router = Router();

const ID_USUARIO = { patron: /^USR-\d+$/i, mensajePatron: "Debe tener el formato 'USR-1001'." };
const ID_ESTACION = { patron: /^EST-\d{2}$/i, mensajePatron: "Debe tener el formato 'EST-01'." };

// GET /api/prestamos?estado=activo&usuarioId=USR-1002&estacionId=EST-02
router.get('/', (req, res) => {
  const estado = enumConsulta(req.query.estado, 'estado', ['activo', 'finalizado', 'cancelado']);
  const usuarioId = req.query.usuarioId !== undefined ? String(req.query.usuarioId).toUpperCase() : undefined;
  const estacionId = req.query.estacionId !== undefined ? String(req.query.estacionId).toUpperCase() : undefined;

  let prestamos = db.prestamos;
  if (estado) prestamos = prestamos.filter((p) => p.estado === estado);
  if (usuarioId) prestamos = prestamos.filter((p) => p.usuarioId === usuarioId);
  if (estacionId) prestamos = prestamos.filter((p) => p.estacionOrigenId === estacionId || p.estacionDestinoId === estacionId);

  const ahora = Date.now();
  responder(res, 200, {
    total: prestamos.length,
    filtros: { estado: estado ?? null, usuarioId: usuarioId ?? null, estacionId: estacionId ?? null },
    datos: [...prestamos].reverse().map((p) => prestamoPublico(p, ahora)),
  });
});

// GET /api/prestamos/PRE-0001
router.get('/:id', (req, res) => {
  responder(res, 200, { datos: prestamoPublico(buscar('prestamos', req.params.id)) });
});

// POST /api/prestamos   { usuarioId, estacionId, tipo? }
router.post('/', (req, res) => {
  validarCuerpo(req.body, {
    usuarioId: { requerido: true, tipo: 'string', ...ID_USUARIO },
    estacionId: { requerido: true, tipo: 'string', ...ID_ESTACION },
    tipo: { tipo: 'string', enum: ['mecanica', 'electrica'] },
  });

  const resultado = crearPrestamo({
    usuarioId: req.body.usuarioId,
    estacionId: req.body.estacionId,
    tipo: req.body.tipo || undefined,
  });

  res.location(`/api/prestamos/${resultado.datos.prestamo.id}`);
  responder(res, 201, resultado);
});

// PATCH /api/prestamos/PRE-0006/devolucion   { estacionId, reporteDanio? }
router.patch('/:id/devolucion', (req, res) => {
  validarCuerpo(req.body, {
    estacionId: { requerido: true, tipo: 'string', ...ID_ESTACION },
    reporteDanio: { tipo: 'string', min: 5, max: 200 },
  });
  responder(res, 200, devolverBicicleta(req.params.id, req.body));
});

// DELETE /api/prestamos/PRE-0006   (solo en los primeros minutos)
router.delete('/:id', (req, res) => {
  responder(res, 200, cancelarPrestamo(req.params.id));
});

module.exports = router;
