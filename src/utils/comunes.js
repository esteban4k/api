const MINUTO = 60 * 1000;

// "El Poblado" === "el poblado" === "EL POBLADO"; también ignora tildes.
const normalizar = (texto) =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const minutosEntre = (desde, hasta) =>
  Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / MINUTO);

const sumarMinutos = (fecha, minutos) => new Date(new Date(fecha).getTime() + minutos * MINUTO);

// Hora local de Colombia, ej. "3:42 p. m."
const horaCorta = (fecha) =>
  new Date(fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });

// Fecha y hora de Colombia, ej. "28 oct 2026, 5:49 a. m."
const fechaHora = (fecha) =>
  new Date(fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

// Distancia en km entre dos coordenadas (fórmula de Haversine).
function distanciaKm(a, b) {
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const redondear = (numero, decimales = 2) => Number(numero.toFixed(decimales));

module.exports = { MINUTO, normalizar, minutosEntre, sumarMinutos, horaCorta, fechaHora, distanciaKm, redondear };
