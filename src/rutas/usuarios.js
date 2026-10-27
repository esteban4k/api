const { Router } = require('express');
const { db, buscar, siguienteId } = require('../datos/db');
const { LIMITE_MINUTOS } = require('../config');
const { responder, errores } = require('../utils/respuestas');
const { validarCuerpo, enumConsulta } = require('../utils/validar');
const { prestamoPublico, sancionVigente } = require('../servicios/prestamos');
const { redondear } = require('../utils/comunes');

const router = Router();

const PLANES = Object.keys(LIMITE_MINUTOS);

function usuarioPublico(usuario) {
  const sancion = sancionVigente(usuario);
  return {
    ...usuario,
    limiteMinutos: LIMITE_MINUTOS[usuario.plan],
    situacion: sancion ? 'sancionado' : usuario.prestamoActivoId ? 'con_prestamo' : 'habilitado',
  };
}

// GET /api/usuarios?plan=estudiante
router.get('/', (req, res) => {
  const plan = enumConsulta(req.query.plan, 'plan', PLANES);
  const usuarios = db.usuarios.filter((u) => !plan || u.plan === plan).map(usuarioPublico);
  responder(res, 200, { total: usuarios.length, filtros: { plan: plan ?? null }, datos: usuarios });
});

// GET /api/usuarios/USR-1003
router.get('/:id', (req, res) => {
  const usuario = buscar('usuarios', req.params.id);
  const prestamos = db.prestamos.filter((p) => p.usuarioId === usuario.id);
  const terminados = prestamos.filter((p) => p.estado === 'finalizado');
  const activo = prestamos.find((p) => p.estado === 'activo');

  responder(res, 200, {
    datos: {
      ...usuarioPublico(usuario),
      prestamoActivo: activo ? prestamoPublico(activo) : null,
      resumen: {
        viajes: terminados.length,
        minutosTotales: terminados.reduce((s, p) => s + p.duracionMin, 0),
        kmTotales: redondear(terminados.reduce((s, p) => s + p.distanciaKm, 0)),
        viajesConSancion: terminados.filter((p) => p.diasSancion > 0).length,
      },
      historial: prestamos.filter((p) => p.estado !== 'activo').reverse(),
    },
  });
});

// POST /api/usuarios   { nombre, documento, correo, plan }
router.post('/', (req, res) => {
  validarCuerpo(req.body, {
    nombre: { requerido: true, tipo: 'string', min: 3, max: 80 },
    documento: { requerido: true, tipo: 'string', patron: /^\d{6,12}$/, mensajePatron: 'Debe tener entre 6 y 12 dígitos, sin puntos ni espacios.' },
    correo: { requerido: true, tipo: 'string', max: 120, patron: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, mensajePatron: 'No es un correo válido.' },
    plan: { requerido: true, tipo: 'string', enum: PLANES },
  });

  const nombre = req.body.nombre.trim();
  const documento = req.body.documento.trim();
  const correo = req.body.correo.trim().toLowerCase();

  if (db.usuarios.some((u) => u.documento === documento)) {
    throw errores.conflicto('DOCUMENTO_DUPLICADO', `Ya existe un usuario con el documento ${documento}.`);
  }
  if (db.usuarios.some((u) => u.correo === correo)) {
    throw errores.conflicto('CORREO_DUPLICADO', `Ya existe un usuario con el correo ${correo}.`);
  }

  const usuario = {
    id: siguienteId('usuario'),
    nombre,
    documento,
    correo,
    plan: req.body.plan,
    sancionadoHasta: null,
    prestamoActivoId: null,
    registradoEn: new Date().toISOString().slice(0, 10),
  };
  db.usuarios.push(usuario);

  res.location(`/api/usuarios/${usuario.id}`);
  responder(res, 201, {
    mensaje: `Usuario ${usuario.id} registrado con plan ${usuario.plan} (${LIMITE_MINUTOS[usuario.plan]} min por viaje).`,
    datos: usuarioPublico(usuario),
  });
});

module.exports = router;
