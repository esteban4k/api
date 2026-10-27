// Reglas de negocio del sistema. Cambiarlas aquí cambia el comportamiento de toda la API.
module.exports = {
  PUERTO: Number(process.env.PORT) || 4000,

  // Minutos que cada plan puede usar una bicicleta antes de recibir sanción.
  LIMITE_MINUTOS: { estudiante: 60, general: 45 },

  // Por cada bloque de 15 minutos de exceso se suma 1 día de sanción (máximo 7).
  MINUTOS_POR_DIA_SANCION: 15,
  DIAS_SANCION_MAX: 7,

  // Una eléctrica con menos batería que esto no se presta.
  BATERIA_MINIMA: 20,
  CONSUMO_BATERIA_POR_MINUTO: 0.5,

  // Un préstamo se puede cancelar (DELETE) solo en sus primeros minutos.
  MINUTOS_CANCELACION: 2,

  // Las calles no son línea recta: la distancia real ≈ distancia en línea recta × 1,3.
  FACTOR_RUTA: 1.3,
};
