const { Router } = require('express');
const { db, buscar } = require('../datos/db');
const { responder, errores } = require('../utils/respuestas');
const { validarCuerpo, enumConsulta, enteroConsulta } = require('../utils/validar');
const { prestamoPublico } = require('../servicios/prestamos');

const router = Router();

const nombreEstacion = (id) => db.estaciones.find((e) => e.id === id)?.nombre ?? null;

// GET /api/bicicletas?estado=disponible&tipo=electrica&estacionId=EST-01&bateriaMin=50
router.get('/', (req, res) => {
  const estado = enumConsulta(req.query.estado, 'estado', ['disponible', 'en_uso', 'mantenimiento']);
  const tipo = enumConsulta(req.query.tipo, 'tipo', ['mecanica', 'electrica']);
  const bateriaMin = enteroConsulta(req.query.bateriaMin, 'bateriaMin', { min: 0, max: 100 });
  const estacionId = req.query.estacionId !== undefined ? String(req.query.estacionId).toUpperCase() : undefined;
  if (estacionId) buscar('estaciones', estacionId);

  let bicicletas = db.bicicletas;
  if (estado) bicicletas = bicicletas.filter((b) => b.estado === estado);
  if (tipo) bicicletas = bicicletas.filter((b) => b.tipo === tipo);
  if (estacionId) bicicletas = bicicletas.filter((b) => b.estacionId === estacionId);
  // bateriaMin solo aplica a eléctricas: las mecánicas no tienen batería.
  if (bateriaMin !== undefined) bicicletas = bicicletas.filter((b) => b.tipo === 'electrica' && b.bateria >= bateriaMin);

  responder(res, 200, {
    total: bicicletas.length,
    filtros: { estado: estado ?? null, tipo: tipo ?? null, estacionId: estacionId ?? null, bateriaMin: bateriaMin ?? null },
    datos: bicicletas.map((b) => ({ ...b, estacionNombre: nombreEstacion(b.estacionId) })),
  });
});

// GET /api/bicicletas/BIC-007
router.get('/:id', (req, res) => {
  const bici = buscar('bicicletas', req.params.id);
  const prestamos = db.prestamos.filter((p) => p.bicicletaId === bici.id);
  const activo = prestamos.find((p) => p.estado === 'activo');

  responder(res, 200, {
    datos: {
      ...bici,
      estacionNombre: nombreEstacion(bici.estacionId),
      prestamoActivo: activo ? prestamoPublico(activo) : null,
      historialPrestamos: prestamos.filter((p) => p.estado !== 'activo').slice(-5).reverse(),
      auditoria: db.auditoria.filter((a) => a.bicicletaId === bici.id).slice(-5).reverse(),
    },
  });
});

// PATCH /api/bicicletas/BIC-002/estado   { "estado": "mantenimiento", "motivo": "..." }
router.patch('/:id/estado', (req, res) => {
  validarCuerpo(req.body, {
    estado: { requerido: true, tipo: 'string', enum: ['disponible', 'mantenimiento'] },
    motivo: { requerido: true, tipo: 'string', min: 5, max: 200 },
  });

  const bici = buscar('bicicletas', req.params.id);
  const { estado, motivo } = req.body;

  if (bici.estado === 'en_uso') {
    throw errores.conflicto('BICICLETA_EN_USO', `${bici.id} está rodando en un préstamo activo. Su estado cambia cuando se devuelva.`);
  }
  if (bici.estado === estado) {
    throw errores.conflicto('ESTADO_SIN_CAMBIO', `${bici.id} ya está en estado '${estado}'.`);
  }

  const registro = { fecha: new Date().toISOString(), bicicletaId: bici.id, estadoAnterior: bici.estado, estadoNuevo: estado, motivo: motivo.trim() };
  db.auditoria.push(registro);

  bici.estado = estado;
  bici.nota = estado === 'mantenimiento' ? registro.motivo : null;
  // Al salir del taller las eléctricas vuelven con carga completa.
  if (estado === 'disponible' && bici.tipo === 'electrica') bici.bateria = 100;

  responder(res, 200, {
    mensaje: `${bici.id} pasó de '${registro.estadoAnterior}' a '${estado}'.`,
    auditoria: registro,
    datos: { ...bici, estacionNombre: nombreEstacion(bici.estacionId) },
  });
});

module.exports = router;
