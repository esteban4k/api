const { errores } = require('./respuestas');

// Valida el cuerpo JSON contra un esquema sencillo y junta TODOS los problemas
// en una sola respuesta 400, para que quien llama los corrija de una vez.
//
// Reglas posibles por campo: requerido, tipo ('string' | 'boolean'), enum, min, max, patron, mensajePatron.
function validarCuerpo(cuerpo, esquema) {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw errores.validacion(
      'El cuerpo debe ser un objeto JSON. Envíalo con el encabezado Content-Type: application/json.',
    );
  }

  const problemas = [];
  for (const [campo, regla] of Object.entries(esquema)) {
    const valor = cuerpo[campo];
    const vacio = valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

    if (vacio) {
      if (regla.requerido) problemas.push({ campo, problema: 'Es obligatorio.' });
      continue;
    }
    if (regla.tipo === 'string' && typeof valor !== 'string') {
      problemas.push({ campo, problema: 'Debe ser texto.' });
      continue;
    }
    if (regla.tipo === 'boolean' && typeof valor !== 'boolean') {
      problemas.push({ campo, problema: 'Debe ser true o false.' });
      continue;
    }
    if (regla.enum && !regla.enum.includes(valor)) {
      problemas.push({ campo, problema: `Debe ser uno de: ${regla.enum.join(', ')}.` });
      continue;
    }
    if (regla.min && valor.trim().length < regla.min) {
      problemas.push({ campo, problema: `Debe tener al menos ${regla.min} caracteres.` });
    }
    if (regla.max && valor.length > regla.max) {
      problemas.push({ campo, problema: `Debe tener como máximo ${regla.max} caracteres.` });
    }
    if (regla.patron && !regla.patron.test(valor)) {
      problemas.push({ campo, problema: regla.mensajePatron });
    }
  }

  if (problemas.length > 0) {
    throw errores.validacion('Hay campos inválidos en la petición.', problemas);
  }
}

// Valores de la URL (?clave=valor)
function enumConsulta(valor, nombre, opciones) {
  if (valor === undefined) return undefined;
  const texto = String(valor).toLowerCase();
  if (!opciones.includes(texto)) {
    throw errores.validacion(`El parámetro '${nombre}' debe ser uno de: ${opciones.join(', ')}.`);
  }
  return texto;
}

function enteroConsulta(valor, nombre, { min = 0, max = Infinity } = {}) {
  if (valor === undefined) return undefined;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    const rango = max === Infinity ? `mayor o igual a ${min}` : `entre ${min} y ${max}`;
    throw errores.validacion(`El parámetro '${nombre}' debe ser un número entero ${rango}.`);
  }
  return numero;
}

function booleanoConsulta(valor, nombre) {
  if (valor === undefined) return undefined;
  const texto = String(valor).toLowerCase();
  if (texto !== 'true' && texto !== 'false') {
    throw errores.validacion(`El parámetro '${nombre}' debe ser true o false.`);
  }
  return texto === 'true';
}

module.exports = { validarCuerpo, enumConsulta, enteroConsulta, booleanoConsulta };
