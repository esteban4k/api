// "Base de datos" en memoria. Se pierde al apagar el servidor y vuelve a la
// semilla con POST /api/reset, así las pruebas de Postman siempre parten igual.
const { crearSemilla } = require('./semilla');
const { errores } = require('../utils/respuestas');

const db = {};

function reiniciar() {
  Object.assign(db, crearSemilla());
}

function buscar(coleccion, id) {
  const buscado = String(id).toUpperCase();
  const encontrado = db[coleccion].find((item) => item.id === buscado);
  if (!encontrado) throw errores.noEncontrado(coleccion, id);
  return encontrado;
}

function siguienteId(tipo) {
  db.contadores[tipo] += 1;
  const n = db.contadores[tipo];
  return tipo === 'prestamo' ? `PRE-${String(n).padStart(4, '0')}` : `USR-${n}`;
}

reiniciar();

module.exports = { db, reiniciar, buscar, siguienteId };
