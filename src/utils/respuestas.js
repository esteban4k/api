// Formato único de respuestas y errores para toda la API.
//   Éxito: { ok: true, mensaje?, total?, filtros?, datos, marcaTiempo }
//   Error: { ok: false, error: { codigo, mensaje, detalles? }, marcaTiempo }

class ErrorApi extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const RECURSOS = {
  estaciones: { codigo: 'ESTACION_NO_ENCONTRADA', texto: 'la estación' },
  bicicletas: { codigo: 'BICICLETA_NO_ENCONTRADA', texto: 'la bicicleta' },
  usuarios: { codigo: 'USUARIO_NO_ENCONTRADO', texto: 'el usuario' },
  prestamos: { codigo: 'PRESTAMO_NO_ENCONTRADO', texto: 'el préstamo' },
};

const errores = {
  validacion: (mensaje, detalles) => new ErrorApi(400, 'VALIDACION', mensaje, detalles),
  noEncontrado: (coleccion, id) => {
    const recurso = RECURSOS[coleccion];
    return new ErrorApi(404, recurso.codigo, `No existe ${recurso.texto} con ID '${id}'.`);
  },
  prohibido: (codigo, mensaje, detalles) => new ErrorApi(403, codigo, mensaje, detalles),
  conflicto: (codigo, mensaje, detalles) => new ErrorApi(409, codigo, mensaje, detalles),
};

function responder(res, estado, cuerpo) {
  res.status(estado).json({ ok: true, ...cuerpo, marcaTiempo: new Date().toISOString() });
}

function responderError(res, estado, codigo, mensaje, detalles) {
  const error = { codigo, mensaje };
  if (detalles !== undefined) error.detalles = detalles;
  res.status(estado).json({ ok: false, error, marcaTiempo: new Date().toISOString() });
}

module.exports = { ErrorApi, errores, responder, responderError };
