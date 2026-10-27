'use strict';

/* ==========================================================
   PedalVerde · consola web
   Consume la API REST del mismo servidor (/api/...).
   ========================================================== */

const $ = (selector) => document.querySelector(selector);
const esc = (valor) =>
  String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TIPO = { mecanica: 'Mecánica', electrica: 'Eléctrica' };
const ESTADO_BICI = { disponible: 'Disponible', en_uso: 'En uso', mantenimiento: 'Mantenimiento' };

const estado = {
  estaciones: [], // todas, para selects y nombres
  usuarios: [],
  estacionPorId: new Map(),
  usuarioPorId: new Map(),
};

/* ---------- Cliente HTTP ---------- */
async function pedir(metodo, url, cuerpo) {
  const opciones = { method: metodo, headers: { Accept: 'application/json' } };
  if (cuerpo !== undefined && cuerpo !== null) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  const inicio = performance.now();
  const respuesta = await fetch(url, opciones);
  const texto = await respuesta.text();
  const ms = Math.round(performance.now() - inicio);
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  return { estado: respuesta.status, textoEstado: respuesta.statusText, ok: respuesta.ok, ms, json, texto };
}

/* ---------- Aviso flotante ---------- */
let temporizadorAviso;
function avisar(texto, tipo = 'ok') {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.className = `aviso visible ${tipo === 'error' ? 'error' : ''}`;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('visible'), 4000);
}

/* ---------- Pestañas ---------- */
const pestanas = [...document.querySelectorAll('[role="tab"]')];

function activarPestana(pestana, enfocar = false) {
  for (const p of pestanas) {
    const activa = p === pestana;
    p.setAttribute('aria-selected', String(activa));
    p.tabIndex = activa ? 0 : -1;
    document.getElementById(p.getAttribute('aria-controls')).hidden = !activa;
  }
  if (enfocar) pestana.focus();
  // La URL guarda la pestaña (#estaciones, #prestamos, #api) para poder compartirla o recargar.
  history.replaceState(null, '', `#${pestana.id.replace('tab-', '')}`);
}

pestanas.forEach((p, i) => {
  p.addEventListener('click', () => activarPestana(p));
  p.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const siguiente = (i + (e.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length;
    activarPestana(pestanas[siguiente], true);
  });
});

const pestanaInicial = document.getElementById(`tab-${location.hash.slice(1)}`);
if (pestanaInicial && pestanas.includes(pestanaInicial)) activarPestana(pestanaInicial);

/* ---------- Resumen (KPIs) ---------- */
async function cargarResumen() {
  const [salud, stats] = await Promise.all([pedir('GET', '/api/salud'), pedir('GET', '/api/estadisticas')]);
  const indicador = $('#estado-servidor');
  indicador.dataset.estado = salud.ok ? 'ok' : 'error';
  indicador.querySelector('.texto').textContent = salud.ok ? `API en línea · v${salud.json.datos.version}` : 'API sin respuesta';
  if (!stats.ok) return;

  const { flota, estaciones, prestamos, usuarios } = stats.json.datos;
  const kpis = [
    ['Bicis disponibles', flota.disponibles, `/ ${flota.total}`],
    ['Préstamos activos', prestamos.activos, ''],
    ['En mantenimiento', flota.enMantenimiento, ''],
    ['Anclajes libres', estaciones.anclajesLibres, `/ ${estaciones.capacidadTotal}`],
    ['Usuarios sancionados', usuarios.sancionados, `/ ${usuarios.total}`],
  ];
  $('#kpis').innerHTML = kpis
    .map(([titulo, valor, extra]) => `<dl class="kpi"><dt>${esc(titulo)}</dt><dd>${esc(valor)}${extra ? `<small>${esc(extra)}</small>` : ''}</dd></dl>`)
    .join('');
}

/* ---------- Catálogos (estaciones y usuarios para selects) ---------- */
async function cargarCatalogos() {
  const [est, usu] = await Promise.all([pedir('GET', '/api/estaciones'), pedir('GET', '/api/usuarios')]);
  if (est.ok) {
    estado.estaciones = est.json.datos;
    estado.estacionPorId = new Map(estado.estaciones.map((e) => [e.id, e]));
  }
  if (usu.ok) {
    estado.usuarios = usu.json.datos;
    estado.usuarioPorId = new Map(estado.usuarios.map((u) => [u.id, u]));
  }
  llenarFiltroZonas();
  llenarFormulario();
}

const nombreEstacion = (id) => estado.estacionPorId.get(id)?.nombre ?? id ?? '—';
const nombreUsuario = (id) => estado.usuarioPorId.get(id)?.nombre ?? id;

function llenarFiltroZonas() {
  const select = $('#filtro-zona');
  const actual = select.value;
  const zonas = [...new Set(estado.estaciones.map((e) => e.zona))];
  select.innerHTML = '<option value="">Todas</option>' + zonas.map((z) => `<option value="${esc(z)}">${esc(z)}</option>`).join('');
  select.value = actual;
}

function llenarFormulario() {
  const selUsuario = $('#sel-usuario');
  const selEstacion = $('#sel-estacion');
  const usuarioActual = selUsuario.value;
  const estacionActual = selEstacion.value;
  const situacion = { sancionado: ' · sancionado', con_prestamo: ' · ya tiene bici', habilitado: '' };

  selUsuario.innerHTML = estado.usuarios
    .map((u) => `<option value="${esc(u.id)}">${esc(u.nombre)} (${esc(u.plan)})${situacion[u.situacion] ?? ''}</option>`)
    .join('');
  selEstacion.innerHTML = estado.estaciones
    .map((e) => `<option value="${esc(e.id)}">${esc(e.nombre)} · ${e.disponibilidad.bicisDisponibles} bicis</option>`)
    .join('');

  if (usuarioActual) selUsuario.value = usuarioActual;
  if (estacionActual) selEstacion.value = estacionActual;
}

/* ---------- Estaciones ---------- */
function urlEstaciones() {
  const parametros = new URLSearchParams();
  const zona = $('#filtro-zona').value;
  const tipo = $('#filtro-tipo').value;
  if (zona) parametros.set('zona', zona);
  if (tipo) parametros.set('tipo', tipo);
  if ($('#filtro-disponibles').checked) parametros.set('minDisponibles', '1');
  const consulta = parametros.toString();
  return `/api/estaciones${consulta ? `?${consulta}` : ''}`;
}

async function cargarEstaciones() {
  const url = urlEstaciones();
  $('#url-estaciones').textContent = `GET ${decodeURIComponent(url.replace(/\+/g, ' '))}`;
  const r = await pedir('GET', url);
  const contenedor = $('#lista-estaciones');
  if (!r.ok) {
    contenedor.innerHTML = `<p class="vacio">${esc(r.json?.error?.mensaje ?? 'No se pudieron cargar las estaciones.')}</p>`;
    return;
  }
  contenedor.innerHTML = r.json.datos.length
    ? r.json.datos.map(tarjetaEstacion).join('')
    : '<p class="vacio">Ninguna estación coincide con los filtros.</p>';
}

function tarjetaEstacion(e) {
  const d = e.disponibilidad;
  const ancho = (n) => `${((n / e.capacidad) * 100).toFixed(1)}%`;
  let etiqueta = `<span class="etiqueta">${esc(e.zona)}</span>`;
  if (d.bicisDisponibles === 0) etiqueta = '<span class="etiqueta alerta">Sin bicis</span>';
  else if (d.anclajesLibres === 0) etiqueta = '<span class="etiqueta atencion">Llena</span>';

  const descripcion = `${d.mecanicas} mecánicas, ${d.electricas} eléctricas, ${d.electricasSinCarga} eléctricas sin carga, ${d.enMantenimiento} en mantenimiento y ${d.anclajesLibres} anclajes libres de ${e.capacidad}`;
  return `
    <button class="estacion" type="button" data-estacion="${esc(e.id)}">
      <div class="estacion-cab"><span class="id">${esc(e.id)}</span>${etiqueta}</div>
      <h3>${esc(e.nombre)}</h3>
      <div class="barra" role="img" aria-label="${esc(descripcion)}">
        <span class="mec" style="width:${ancho(d.mecanicas)}"></span>
        <span class="ele" style="width:${ancho(d.electricas)}"></span>
        <span class="sin" style="width:${ancho(d.electricasSinCarga)}"></span>
        <span class="man" style="width:${ancho(d.enMantenimiento)}"></span>
      </div>
      <dl class="cifras">
        <div><dt>Disponibles</dt><dd>${d.bicisDisponibles}</dd></div>
        <div><dt>Eléctricas</dt><dd>${d.electricas}</dd></div>
        <div><dt>Anclajes libres</dt><dd>${d.anclajesLibres}</dd></div>
      </dl>
    </button>`;
}

['#filtro-zona', '#filtro-tipo', '#filtro-disponibles'].forEach((s) => $(s).addEventListener('change', cargarEstaciones));

$('#lista-estaciones').addEventListener('click', (e) => {
  const tarjeta = e.target.closest('[data-estacion]');
  if (tarjeta) abrirDetalle(tarjeta.dataset.estacion);
});

/* ---------- Detalle de estación ---------- */
const dialogo = $('#detalle-estacion');
let detalleActual = null;
$('#detalle-cerrar').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });

async function abrirDetalle(id) {
  const r = await pedir('GET', `/api/estaciones/${encodeURIComponent(id)}`);
  if (!r.ok) return avisar(r.json?.error?.mensaje ?? 'No se pudo abrir la estación', 'error');
  const e = r.json.datos;
  const d = e.disponibilidad;
  detalleActual = e.id;

  $('#detalle-sobretitulo').textContent = `${e.id} · ${e.zona} · GET /api/estaciones/${e.id}`;
  $('#detalle-titulo').textContent = e.nombre;

  const filas = e.bicicletas
    .map((b) => {
      const accion = b.estado === 'mantenimiento'
        ? `<button class="boton chico" type="button" data-bici="${esc(b.id)}" data-nuevo="disponible">Habilitar</button>`
        : `<button class="boton chico" type="button" data-bici="${esc(b.id)}" data-nuevo="mantenimiento">A mantenimiento</button>`;
      const bateria = b.bateria == null ? '—' : `${b.bateria} %`;
      return `<tr>
        <td class="mono">${esc(b.id)}</td>
        <td>${esc(TIPO[b.tipo])}</td>
        <td>${esc(ESTADO_BICI[b.estado])}${b.nota ? `<br><small class="pista">${esc(b.nota)}</small>` : ''}</td>
        <td class="num">${esc(bateria)}</td>
        <td class="num">${esc(b.kmRecorridos)} km</td>
        <td>${accion}</td>
      </tr>`;
    })
    .join('');

  $('#detalle-cuerpo').innerHTML = `
    <dl class="cifras">
      <div><dt>Disponibles</dt><dd>${d.bicisDisponibles}</dd></div>
      <div><dt>Anclajes libres</dt><dd>${d.anclajesLibres} / ${e.capacidad}</dd></div>
      <div><dt>Ocupación</dt><dd>${d.ocupacionPct} %</dd></div>
    </dl>
    ${e.bicicletas.length
      ? `<div class="tabla-envoltura"><table>
          <thead><tr><th>Bici</th><th>Tipo</th><th>Estado</th><th>Batería</th><th>Recorrido</th><th><span class="pista">PATCH …/estado</span></th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>`
      : '<p class="vacio">No hay bicicletas ancladas en esta estación.</p>'}
    <div><button class="boton principal" type="button" data-prestar="${esc(e.id)}">Prestar desde aquí</button></div>`;

  if (!dialogo.open) dialogo.showModal();
}

$('#detalle-cuerpo').addEventListener('click', async (e) => {
  const botonBici = e.target.closest('[data-bici]');
  if (botonBici) {
    botonBici.disabled = true;
    const nuevo = botonBici.dataset.nuevo;
    const r = await pedir('PATCH', `/api/bicicletas/${botonBici.dataset.bici}/estado`, {
      estado: nuevo,
      motivo: nuevo === 'mantenimiento' ? 'Marcada desde la consola web' : 'Revisada y habilitada desde la consola web',
    });
    avisar(r.json?.mensaje ?? r.json?.error?.mensaje ?? `Error ${r.estado}`, r.ok ? 'ok' : 'error');
    await refrescar();
    return abrirDetalle(detalleActual);
  }
  const botonPrestar = e.target.closest('[data-prestar]');
  if (botonPrestar) {
    dialogo.close();
    activarPestana($('#tab-prestamos'));
    $('#sel-estacion').value = botonPrestar.dataset.prestar;
    $('#sel-usuario').focus();
  }
});

/* ---------- Préstamos ---------- */
function cajaResultado(r) {
  const encabezado = `<span class="codigo-http">${r.estado} ${esc(r.textoEstado)} · ${r.ms} ms</span>`;
  if (r.ok) return `<div class="caja ok">${encabezado}<p>${esc(r.json.mensaje)}</p></div>`;
  const error = r.json?.error ?? { codigo: 'SIN_RESPUESTA', mensaje: r.texto };
  const detalles = error.detalles ? `<pre>${esc(JSON.stringify(error.detalles, null, 2))}</pre>` : '';
  return `<div class="caja error">${encabezado}<p><strong>${esc(error.codigo)}</strong> · ${esc(error.mensaje)}</p>${detalles}</div>`;
}

$('#form-prestamo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formulario = new FormData(e.target);
  const cuerpo = { usuarioId: formulario.get('usuarioId'), estacionId: formulario.get('estacionId') };
  if (formulario.get('tipo')) cuerpo.tipo = formulario.get('tipo');

  const boton = e.target.querySelector('button[type="submit"]');
  boton.disabled = true;
  const r = await pedir('POST', '/api/prestamos', cuerpo);
  boton.disabled = false;

  $('#resultado-prestamo').innerHTML = cajaResultado(r) +
    `<pre class="json">${resaltar({ ...cuerpo })}</pre><p class="pista">Cuerpo enviado en <code>POST /api/prestamos</code></p>`;
  if (r.ok) await refrescar();
});

async function cargarPrestamos() {
  const r = await pedir('GET', '/api/prestamos');
  if (!r.ok) return;
  const activos = r.json.datos.filter((p) => p.estado === 'activo');
  const terminados = r.json.datos.filter((p) => p.estado !== 'activo').slice(0, 8);

  const opcionesDestino = (origen) => estado.estaciones
    .map((e) => {
      const libres = e.disponibilidad.anclajesLibres;
      return `<option value="${esc(e.id)}" ${e.id === origen ? 'selected' : ''}>${esc(e.nombre)} (${libres ? `${libres} libres` : 'llena'})</option>`;
    })
    .join('');

  $('#tabla-activos').innerHTML = activos.length
    ? `<table>
        <thead><tr><th>Préstamo</th><th>Usuario</th><th>Origen</th><th>Tiempo</th><th>Devolver en</th></tr></thead>
        <tbody>${activos.map((p) => {
          const limite = p.minutosTranscurridos + p.minutosRestantes;
          const pct = Math.min(100, (p.minutosTranscurridos / limite) * 100);
          return `<tr>
            <td><span class="mono">${esc(p.id)}</span><br><small class="pista">${esc(p.bicicletaId)} · ${esc(TIPO[p.tipoBicicleta])}</small></td>
            <td>${esc(nombreUsuario(p.usuarioId))}</td>
            <td>${esc(nombreEstacion(p.estacionOrigenId))}</td>
            <td class="num">${p.minutosTranscurridos} / ${limite} min
              <div class="progreso ${p.vencido ? 'vencido' : ''}"><span style="width:${pct}%"></span></div>
              ${p.vencido ? `<small class="pista" style="color:var(--peligro)">Vencido hace ${-p.minutosRestantes} min</small>` : ''}
            </td>
            <td><div class="acciones-fila">
              <select aria-label="Estación de devolución de ${esc(p.id)}" data-destino="${esc(p.id)}">${opcionesDestino(p.estacionOrigenId)}</select>
              <button class="boton chico principal" type="button" data-devolver="${esc(p.id)}">Devolver</button>
              <button class="boton chico peligro" type="button" data-cancelar="${esc(p.id)}">Cancelar</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`
    : '<p class="vacio">No hay préstamos activos.</p>';

  $('#tabla-historial').innerHTML = terminados.length
    ? `<table>
        <thead><tr><th>Préstamo</th><th>Usuario</th><th>Recorrido</th><th>Duración</th><th>Distancia</th><th>Resultado</th></tr></thead>
        <tbody>${terminados.map((p) => {
          let resultado = '<span class="etiqueta ok">A tiempo</span>';
          if (p.estado === 'cancelado') resultado = '<span class="etiqueta">Cancelado</span>';
          else if (p.diasSancion > 0) resultado = `<span class="etiqueta alerta">+${p.minutosExcedidos} min · ${p.diasSancion} día(s) de sanción</span>`;
          if (p.reporteDanio) resultado += ' <span class="etiqueta atencion">Daño reportado</span>';
          return `<tr>
            <td class="mono">${esc(p.id)}</td>
            <td>${esc(nombreUsuario(p.usuarioId))}</td>
            <td>${esc(nombreEstacion(p.estacionOrigenId))} → ${esc(nombreEstacion(p.estacionDestinoId))}</td>
            <td class="num">${p.duracionMin} min</td>
            <td class="num">${p.distanciaKm} km</td>
            <td>${resultado}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`
    : '<p class="vacio">Todavía no hay préstamos terminados.</p>';
}

$('#tabla-activos').addEventListener('click', async (e) => {
  const devolver = e.target.closest('[data-devolver]');
  const cancelar = e.target.closest('[data-cancelar]');
  if (!devolver && !cancelar) return;

  const boton = devolver ?? cancelar;
  boton.disabled = true;
  let r;
  if (devolver) {
    const id = devolver.dataset.devolver;
    const destino = document.querySelector(`[data-destino="${CSS.escape(id)}"]`).value;
    r = await pedir('PATCH', `/api/prestamos/${id}/devolucion`, { estacionId: destino });
  } else {
    r = await pedir('DELETE', `/api/prestamos/${cancelar.dataset.cancelar}`);
  }
  avisar(r.json?.mensaje ?? r.json?.error?.mensaje ?? `Error ${r.estado}`, r.ok ? 'ok' : 'error');
  $('#resultado-prestamo').innerHTML = cajaResultado(r);
  if (r.ok) await refrescar();
  else boton.disabled = false;
});

/* ---------- Probador de la colección de Postman ---------- */
const probador = { grupos: [], items: [], variables: {}, scriptColeccion: '', actual: null };

const scriptDe = (eventos = []) =>
  eventos.filter((e) => e.listen === 'test').map((e) => [].concat(e.script.exec).join('\n')).join('\n');

const resolver = (texto) => texto.replace(/\{\{(\w+)\}\}/g, (marca, clave) => probador.variables[clave] || marca);

async function cargarColeccion() {
  const r = await pedir('GET', '/postman/PedalVerde.postman_collection.json');
  if (!r.ok || !r.json) {
    $('#lista-peticiones').innerHTML = '<p class="vacio">No se encontró la colección de Postman.</p>';
    return;
  }
  const coleccion = r.json;
  probador.scriptColeccion = scriptDe(coleccion.event);
  probador.variables = Object.fromEntries((coleccion.variable ?? []).map((v) => [v.key, v.value]));
  probador.variables.baseUrl = location.origin;

  let n = 0;
  probador.grupos = coleccion.item.map((grupo) => ({
    nombre: grupo.name,
    items: grupo.item.map((item) => ({
      n: n++,
      nombre: item.name,
      metodo: item.request.method,
      url: typeof item.request.url === 'string' ? item.request.url : item.request.url.raw,
      cuerpo: item.request.body?.raw ?? null,
      descripcion: item.request.description ?? '',
      pruebas: scriptDe(item.event),
      resultado: null,
    })),
  }));
  probador.items = probador.grupos.flatMap((g) => g.items);
  pintarLista();
  seleccionar(probador.items[0]);
}

function pintarLista() {
  $('#lista-peticiones').innerHTML = probador.grupos
    .map((g) => `
      <section class="grupo">
        <h3>${esc(g.nombre)}</h3>
        <ol>${g.items.map((item) => {
          const r = item.resultado;
          const marca = !r ? '' : r.fallidas === 0 ? '<span class="marca-resultado ok" aria-label="pruebas superadas">✔</span>' : '<span class="marca-resultado error" aria-label="pruebas fallidas">✘</span>';
          return `<li><button class="peticion" type="button" data-n="${item.n}" aria-current="${probador.actual === item}">
            <span class="metodo ${esc(item.metodo)}">${esc(item.metodo)}</span>
            <span>${esc(item.nombre)}</span>${marca}
          </button></li>`;
        }).join('')}</ol>
      </section>`)
    .join('');
}

$('#lista-peticiones').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-n]');
  if (boton) seleccionar(probador.items[Number(boton.dataset.n)]);
});

function seleccionar(item) {
  probador.actual = item;
  $('#consola-metodo').textContent = item.metodo;
  $('#consola-metodo').className = `metodo ${item.metodo}`;
  $('#consola-url').textContent = resolver(item.url);
  $('#consola-descripcion').textContent = item.descripcion;
  const tieneCuerpo = item.cuerpo !== null;
  $('#consola-cuerpo-etiqueta').hidden = !tieneCuerpo;
  $('#consola-cuerpo').value = tieneCuerpo ? item.cuerpoEditado ?? item.cuerpo : '';
  if (item.resultado) pintarRespuesta(item.resultado);
  else $('#consola-respuesta').hidden = true;
  document.querySelectorAll('.peticion').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.n) === item.n)));
}

$('#consola-cuerpo').addEventListener('input', (e) => {
  if (probador.actual) probador.actual.cuerpoEditado = e.target.value;
});

// Imitación mínima de "pm" de Postman para correr en el navegador los mismos scripts de prueba.
function esperar(valor) {
  const mostrar = (v) => JSON.stringify(v);
  const afirmar = (condicion, mensaje) => { if (!condicion) throw new Error(mensaje); };
  const cadena = {
    equal: (esperado) => afirmar(valor === esperado, `se esperaba ${mostrar(esperado)} y llegó ${mostrar(valor)}`),
    eql: (esperado) => afirmar(JSON.stringify(valor) === JSON.stringify(esperado), `se esperaba ${mostrar(esperado)} y llegó ${mostrar(valor)}`),
    above: (n) => afirmar(valor > n, `se esperaba más de ${n} y llegó ${mostrar(valor)}`),
    below: (n) => afirmar(valor < n, `se esperaba menos de ${n} y llegó ${mostrar(valor)}`),
    include: (x) => afirmar(valor != null && valor.includes(x), `se esperaba que incluyera ${mostrar(x)}`),
    match: (re) => afirmar(re.test(valor), `${mostrar(valor)} no cumple ${re}`),
    property: (clave) => afirmar(valor != null && Object.prototype.hasOwnProperty.call(valor, clave), `falta la propiedad ${mostrar(clave)}`),
    lengthOf: (n) => afirmar(valor != null && valor.length === n, `se esperaba longitud ${n} y llegó ${valor?.length}`),
    an: (tipo) => afirmar(tipo === 'array' ? Array.isArray(valor) : typeof valor === tipo, `se esperaba un ${tipo}`),
  };
  cadena.a = cadena.an;
  Object.defineProperty(cadena, 'true', { get: () => afirmar(valor === true, `se esperaba true y llegó ${mostrar(valor)}`) });
  Object.defineProperty(cadena, 'false', { get: () => afirmar(valor === false, `se esperaba false y llegó ${mostrar(valor)}`) });
  cadena.to = cadena.be = cadena.have = cadena.been = cadena.that = cadena;
  return cadena;
}

function correrPruebas(scripts, respuesta) {
  const resultados = [];
  const pm = {
    test(nombre, fn) {
      try { fn(); resultados.push({ nombre, ok: true }); } catch (error) { resultados.push({ nombre, ok: false, error: error.message }); }
    },
    expect: esperar,
    response: {
      code: respuesta.estado,
      responseTime: respuesta.ms,
      json() {
        if (respuesta.json === null) throw new Error('La respuesta no es JSON');
        return respuesta.json;
      },
      to: { have: { status(n) { if (respuesta.estado !== n) throw new Error(`se esperaba estado ${n} y llegó ${respuesta.estado}`); } } },
    },
    collectionVariables: {
      get: (clave) => probador.variables[clave],
      set: (clave, valor) => { probador.variables[clave] = valor; },
    },
  };
  for (const script of scripts) {
    if (!script.trim()) continue;
    try {
      new Function('pm', script)(pm); // scripts de nuestra propia colección
    } catch (error) {
      resultados.push({ nombre: 'Script de pruebas', ok: false, error: error.message });
    }
  }
  return resultados;
}

async function ejecutar(item) {
  const url = resolver(item.url);
  const cuerpo = item.cuerpo !== null ? resolver(item.cuerpoEditado ?? item.cuerpo) : undefined;
  const respuesta = await pedir(item.metodo, url, cuerpo);
  const pruebas = correrPruebas([probador.scriptColeccion, item.pruebas], respuesta);
  item.resultado = { ...respuesta, url, pruebas, fallidas: pruebas.filter((p) => !p.ok).length };
  return item.resultado;
}

function pintarRespuesta(resultado) {
  $('#consola-respuesta').hidden = false;
  $('#consola-url').textContent = resultado.url;
  const codigo = $('#resp-codigo');
  codigo.textContent = `${resultado.estado} ${resultado.textoEstado}`;
  codigo.className = `codigo ${resultado.estado < 400 ? 'ok' : 'error'}`;
  const pasadas = resultado.pruebas.length - resultado.fallidas;
  $('#resp-tiempo').textContent = `${resultado.ms} ms · pruebas ${pasadas}/${resultado.pruebas.length}`;
  $('#resp-pruebas').innerHTML = resultado.pruebas
    .map((p) => `<li class="${p.ok ? '' : 'fallo'}">${esc(p.nombre)}${p.ok ? '' : `<small>${esc(p.error)}</small>`}</li>`)
    .join('');
  $('#resp-json').innerHTML = resultado.json !== null ? resaltar(resultado.json) : esc(resultado.texto);
}

$('#btn-enviar').addEventListener('click', async () => {
  const item = probador.actual;
  if (!item) return;
  const boton = $('#btn-enviar');
  boton.disabled = true;
  const resultado = await ejecutar(item);
  boton.disabled = false;
  pintarRespuesta(resultado);
  pintarLista();
  refrescar();
});

$('#btn-correr-todo').addEventListener('click', async () => {
  const boton = $('#btn-correr-todo');
  boton.disabled = true;
  const resumen = $('#resumen-corrida');
  resumen.className = 'resumen-corrida';
  let pruebas = 0;
  let fallidas = 0;
  for (const [i, item] of probador.items.entries()) {
    resumen.textContent = `Ejecutando ${i + 1} de ${probador.items.length}: ${item.nombre}`;
    const r = await ejecutar(item);
    pruebas += r.pruebas.length;
    fallidas += r.fallidas;
    pintarLista();
  }
  resumen.textContent = `${probador.items.length} peticiones · ${pruebas} pruebas · ${fallidas} fallidas`;
  resumen.classList.add(fallidas === 0 ? 'ok' : 'error');
  boton.disabled = false;
  seleccionar(probador.actual ?? probador.items[0]);
  refrescar();
});

// Resaltado de JSON. Fuera de las cadenas solo hay {}[],: espacios, números y literales,
// así que basta con escapar el contenido de las cadenas.
const TOKEN_JSON = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
function resaltar(valor) {
  return JSON.stringify(valor, null, 2).replace(TOKEN_JSON, (coincidencia, cadena, dosPuntos, literal) => {
    if (cadena) return dosPuntos ? `<span class="j-clave">${esc(cadena)}</span>${dosPuntos}` : `<span class="j-texto">${esc(cadena)}</span>`;
    if (literal) return `<span class="j-literal">${coincidencia}</span>`;
    return `<span class="j-numero">${coincidencia}</span>`;
  });
}

/* ---------- Arranque ---------- */
async function refrescar() {
  try {
    await cargarCatalogos();
    await Promise.all([cargarResumen(), cargarEstaciones(), cargarPrestamos()]);
  } catch {
    const indicador = $('#estado-servidor');
    indicador.dataset.estado = 'error';
    indicador.querySelector('.texto').textContent = 'API sin respuesta';
  }
}

refrescar();
cargarColeccion();
// Los minutos de los préstamos activos avanzan solos.
setInterval(() => { if (!document.hidden) refrescar(); }, 30000);
