const { db } = require('../datos/db');
const { BATERIA_MINIMA } = require('../config');
const { distanciaKm, redondear } = require('../utils/comunes');

const bicisAncladas = (estacionId) => db.bicicletas.filter((b) => b.estacionId === estacionId);

// Una bici se puede prestar si está disponible y, si es eléctrica, tiene carga suficiente.
const esPrestable = (bici) =>
  bici.estado === 'disponible' && (bici.tipo === 'mecanica' || bici.bateria >= BATERIA_MINIMA);

function disponibilidad(estacion) {
  const ancladas = bicisAncladas(estacion.id);
  const prestables = ancladas.filter(esPrestable);
  const mecanicas = prestables.filter((b) => b.tipo === 'mecanica').length;
  const electricas = prestables.length - mecanicas;
  const electricasSinCarga = ancladas.filter((b) => b.estado === 'disponible' && b.tipo === 'electrica' && b.bateria < BATERIA_MINIMA).length;

  return {
    bicisDisponibles: prestables.length,
    mecanicas,
    electricas,
    electricasSinCarga,
    enMantenimiento: ancladas.filter((b) => b.estado === 'mantenimiento').length,
    anclajesLibres: estacion.capacidad - ancladas.length,
    ocupacionPct: Math.round((ancladas.length / estacion.capacidad) * 100),
  };
}

const estacionConDisponibilidad = (estacion) => ({ ...estacion, disponibilidad: disponibilidad(estacion) });

// Estaciones con anclajes libres más cercanas a una estación (para sugerir otra si está llena).
function cercanasConAnclajes(origen, cantidad = 3) {
  return db.estaciones
    .filter((e) => e.id !== origen.id && disponibilidad(e).anclajesLibres > 0)
    .map((e) => ({
      id: e.id,
      nombre: e.nombre,
      distanciaKm: redondear(distanciaKm(origen.coordenadas, e.coordenadas)),
      anclajesLibres: disponibilidad(e).anclajesLibres,
    }))
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, cantidad);
}

module.exports = { bicisAncladas, esPrestable, disponibilidad, estacionConDisponibilidad, cercanasConAnclajes };
