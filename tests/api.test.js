// Pruebas de la API con el test runner nativo de Node (node --test).
// Cada prueba arranca desde la semilla, así no dependen unas de otras.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { crearApp } = require('../src/app');
const { reiniciar } = require('../src/datos/db');

let servidor;
let base;

before(async () => {
  servidor = crearApp().listen(0);
  await once(servidor, 'listening');
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());
beforeEach(() => reiniciar());

async function pedir(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  const respuesta = await fetch(base + ruta, opciones);
  return { estado: respuesta.status, json: await respuesta.json(), cabeceras: respuesta.headers };
}

const prestar = (usuarioId, estacionId, tipo) => pedir('POST', '/api/prestamos', { usuarioId, estacionId, ...(tipo && { tipo }) });

describe('Sistema', () => {
  it('GET /api/salud responde ok', async () => {
    const r = await pedir('GET', '/api/salud');
    assert.equal(r.estado, 200);
    assert.equal(r.json.datos.estado, 'ok');
  });

  it('una ruta inexistente responde 404 con formato de error', async () => {
    const r = await pedir('GET', '/api/no-existe');
    assert.equal(r.estado, 404);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.codigo, 'RUTA_NO_ENCONTRADA');
  });

  it('las cuentas de las estadísticas cuadran', async () => {
    const { flota, estaciones } = (await pedir('GET', '/api/estadisticas')).json.datos;
    assert.equal(flota.disponibles + flota.enUso + flota.enMantenimiento, flota.total);
    assert.equal(estaciones.vacias, 1);
    assert.equal(estaciones.llenas, 1);
  });
});

describe('Estaciones', () => {
  it('filtra por zona sin importar mayúsculas ni tildes', async () => {
    const r = await pedir('GET', '/api/estaciones?zona=el%20poblado');
    assert.equal(r.estado, 200);
    assert.deepEqual(r.json.datos.map((e) => e.id), ['EST-07', 'EST-08']);
  });

  it('filtra estaciones con eléctricas prestables (excluye la de batería baja)', async () => {
    const r = await pedir('GET', '/api/estaciones?tipo=electrica');
    const ids = r.json.datos.map((e) => e.id);
    assert.ok(!ids.includes('EST-03'), 'EST-03 solo tiene una eléctrica al 12 %');
    assert.ok(!ids.includes('EST-04'), 'EST-04 está vacía');
  });

  it('rechaza un filtro inválido con 400', async () => {
    const r = await pedir('GET', '/api/estaciones?minDisponibles=muchas');
    assert.equal(r.estado, 400);
    assert.equal(r.json.error.codigo, 'VALIDACION');
  });

  it('el detalle cuadra: bicis ancladas + anclajes libres = capacidad', async () => {
    const e = (await pedir('GET', '/api/estaciones/est-01')).json.datos;
    assert.equal(e.id, 'EST-01');
    assert.equal(e.bicicletas.length + e.disponibilidad.anclajesLibres, e.capacidad);
  });

  it('una estación inexistente responde 404', async () => {
    const r = await pedir('GET', '/api/estaciones/EST-99');
    assert.equal(r.estado, 404);
    assert.equal(r.json.error.codigo, 'ESTACION_NO_ENCONTRADA');
  });
});

describe('Préstamos', () => {
  it('presta la eléctrica con más batería y actualiza bici y usuario', async () => {
    const r = await prestar('USR-1001', 'EST-01', 'electrica');
    assert.equal(r.estado, 201);
    assert.equal(r.cabeceras.get('location'), `/api/prestamos/${r.json.datos.prestamo.id}`);
    assert.equal(r.json.datos.bicicleta.id, 'BIC-007'); // 92 %, la más cargada de EST-01
    assert.equal(r.json.datos.bicicleta.estado, 'en_uso');

    const usuario = (await pedir('GET', '/api/usuarios/USR-1001')).json.datos;
    assert.equal(usuario.situacion, 'con_prestamo');
    assert.equal(usuario.prestamoActivo.id, r.json.datos.prestamo.id);
  });

  it('sin tipo, prefiere la mecánica con menos kilómetros', async () => {
    const r = await prestar('USR-1005', 'EST-02');
    assert.equal(r.estado, 201);
    assert.equal(r.json.datos.bicicleta.tipo, 'mecanica');
  });

  it('un usuario sancionado recibe 403', async () => {
    const r = await prestar('USR-1004', 'EST-01');
    assert.equal(r.estado, 403);
    assert.equal(r.json.error.codigo, 'USUARIO_SANCIONADO');
  });

  it('un usuario con préstamo activo recibe 409', async () => {
    const r = await prestar('USR-1002', 'EST-01');
    assert.equal(r.estado, 409);
    assert.equal(r.json.error.detalles.prestamoActivoId, 'PRE-0001');
  });

  it('no presta en una estación vacía ni una eléctrica sin carga', async () => {
    const vacia = await prestar('USR-1006', 'EST-04');
    assert.equal(vacia.estado, 409);
    assert.equal(vacia.json.error.codigo, 'SIN_BICICLETAS_DISPONIBLES');

    const sinCarga = await prestar('USR-1006', 'EST-03', 'electrica');
    assert.equal(sinCarga.estado, 409);
    assert.equal(sinCarga.json.error.detalles.electricasSinCarga, 1);
  });

  it('junta todos los errores de validación en un solo 400', async () => {
    const r = await pedir('POST', '/api/prestamos', { usuarioId: '', estacionId: 'EST-1', tipo: 'patineta' });
    assert.equal(r.estado, 400);
    assert.deepEqual(r.json.error.detalles.map((d) => d.campo), ['usuarioId', 'estacionId', 'tipo']);
  });

  it('responde 400 si el JSON está mal escrito', async () => {
    const r = await pedir('POST', '/api/prestamos', '{"usuarioId": "USR-1001",}');
    assert.equal(r.estado, 400);
    assert.equal(r.json.error.codigo, 'JSON_INVALIDO');
  });

  it('devolver a tiempo: sin sanción, bici en destino y km sumados', async () => {
    const creado = (await prestar('USR-1001', 'EST-01', 'electrica')).json.datos;
    const r = await pedir('PATCH', `/api/prestamos/${creado.prestamo.id}/devolucion`, { estacionId: 'EST-07' });
    assert.equal(r.estado, 200);
    assert.equal(r.json.datos.prestamo.estado, 'finalizado');
    assert.equal(r.json.datos.sancion.aplicada, false);
    assert.equal(r.json.datos.bicicleta.estacionId, 'EST-07');
    assert.ok(r.json.datos.bicicleta.kmRecorridos > creado.bicicleta.kmRecorridos);
  });

  it('devolver tarde: 35 min de exceso = 3 días de sanción', async () => {
    const r = await pedir('PATCH', '/api/prestamos/PRE-0002/devolucion', { estacionId: 'EST-06' });
    assert.equal(r.estado, 200);
    assert.equal(r.json.datos.sancion.dias, 3);

    const intento = await prestar('USR-1003', 'EST-06');
    assert.equal(intento.estado, 403);
  });

  it('reportar un daño deja la bici en mantenimiento', async () => {
    const r = await pedir('PATCH', '/api/prestamos/PRE-0001/devolucion', { estacionId: 'EST-02', reporteDanio: 'Pedal suelto' });
    assert.equal(r.json.datos.bicicleta.estado, 'mantenimiento');
  });

  it('no se puede devolver en una estación llena y sugiere otras', async () => {
    const r = await pedir('PATCH', '/api/prestamos/PRE-0001/devolucion', { estacionId: 'EST-08' });
    assert.equal(r.estado, 409);
    assert.equal(r.json.error.codigo, 'ESTACION_LLENA');
    assert.ok(r.json.error.detalles.sugerencias.length > 0);
  });

  it('no se puede devolver dos veces', async () => {
    await pedir('PATCH', '/api/prestamos/PRE-0001/devolucion', { estacionId: 'EST-02' });
    const r = await pedir('PATCH', '/api/prestamos/PRE-0001/devolucion', { estacionId: 'EST-02' });
    assert.equal(r.estado, 409);
    assert.equal(r.json.error.codigo, 'PRESTAMO_NO_ACTIVO');
  });

  it('DELETE cancela un préstamo reciente y la bici vuelve al origen', async () => {
    const creado = (await prestar('USR-1005', 'EST-05')).json.datos;
    const r = await pedir('DELETE', `/api/prestamos/${creado.prestamo.id}`);
    assert.equal(r.estado, 200);
    assert.equal(r.json.datos.prestamo.estado, 'cancelado');
    assert.equal(r.json.datos.bicicleta.estacionId, 'EST-05');
  });

  it('DELETE de un préstamo con más de 2 minutos responde 409', async () => {
    const r = await pedir('DELETE', '/api/prestamos/PRE-0001');
    assert.equal(r.estado, 409);
    assert.equal(r.json.error.codigo, 'CANCELACION_FUERA_DE_TIEMPO');
  });
});

describe('Bicicletas y usuarios', () => {
  it('PATCH cambia el estado y deja auditoría', async () => {
    const r = await pedir('PATCH', '/api/bicicletas/BIC-002/estado', { estado: 'mantenimiento', motivo: 'Freno trasero' });
    assert.equal(r.estado, 200);
    assert.equal(r.json.auditoria.estadoAnterior, 'disponible');

    const repetido = await pedir('PATCH', '/api/bicicletas/BIC-002/estado', { estado: 'mantenimiento', motivo: 'Otra vez' });
    assert.equal(repetido.estado, 409);
    assert.equal(repetido.json.error.codigo, 'ESTADO_SIN_CAMBIO');
  });

  it('una bici en uso no cambia de estado', async () => {
    const r = await pedir('PATCH', '/api/bicicletas/BIC-051/estado', { estado: 'mantenimiento', motivo: 'Revisión' });
    assert.equal(r.estado, 409);
    assert.equal(r.json.error.codigo, 'BICICLETA_EN_USO');
  });

  it('registra un usuario y rechaza documento repetido', async () => {
    const nuevo = { nombre: 'Mariana Cardona', documento: '1037123456', correo: 'mariana@ejemplo.com', plan: 'estudiante' };
    const r = await pedir('POST', '/api/usuarios', nuevo);
    assert.equal(r.estado, 201);
    assert.equal(r.json.datos.id, 'USR-1007');

    const repetido = await pedir('POST', '/api/usuarios', { ...nuevo, correo: 'otro@ejemplo.com' });
    assert.equal(repetido.estado, 409);
    assert.equal(repetido.json.error.codigo, 'DOCUMENTO_DUPLICADO');
  });

  it('valida documento y correo del usuario', async () => {
    const r = await pedir('POST', '/api/usuarios', { nombre: 'Ana', documento: '12-34', correo: 'ana@', plan: 'vip' });
    assert.equal(r.estado, 400);
    assert.deepEqual(r.json.error.detalles.map((d) => d.campo), ['documento', 'correo', 'plan']);
  });
});
