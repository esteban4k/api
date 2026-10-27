const path = require('node:path');
const express = require('express');
const { ErrorApi, responderError } = require('./utils/respuestas');

function registrar(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    if (!req.originalUrl.startsWith('/api')) return;
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${req.method.padEnd(6)} ${req.originalUrl} → ${res.statusCode} (${ms.toFixed(1)} ms)`);
  });
  next();
}

function cabeceras(req, res, next) {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

function rutaNoEncontrada(req) {
  throw new ErrorApi(404, 'RUTA_NO_ENCONTRADA', `No existe la ruta ${req.method} ${req.originalUrl}. Consulta GET /api para ver las rutas disponibles.`);
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(error, req, res, next) {
  if (error instanceof ErrorApi) {
    return responderError(res, error.estado, error.codigo, error.message, error.detalles);
  }
  if (error.type === 'entity.parse.failed') {
    return responderError(res, 400, 'JSON_INVALIDO', 'El cuerpo no es JSON válido. Revisa comas, comillas dobles y llaves.');
  }
  if (error.type === 'entity.too.large') {
    return responderError(res, 413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo de la petición supera el límite de 20 kB.');
  }
  console.error(error);
  return responderError(res, 500, 'ERROR_INTERNO', 'Ocurrió un error inesperado en el servidor.');
}

function crearApp({ registrarPeticiones = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('json spaces', 2);

  if (registrarPeticiones) app.use(registrar);
  app.use(cabeceras);
  app.use(express.json({ limit: '20kb' }));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/postman', express.static(path.join(__dirname, '..', 'postman')));

  app.use('/api', require('./rutas/sistema'));
  app.use('/api/estaciones', require('./rutas/estaciones'));
  app.use('/api/bicicletas', require('./rutas/bicicletas'));
  app.use('/api/usuarios', require('./rutas/usuarios'));
  app.use('/api/prestamos', require('./rutas/prestamos'));

  app.use('/api', rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}

module.exports = { crearApp };
