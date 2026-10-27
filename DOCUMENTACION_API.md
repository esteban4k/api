# Documentación técnica: PedalVerde API

**URL base:** `http://localhost:4000`
**Formato:** JSON (UTF-8). Las peticiones con cuerpo deben enviar `Content-Type: application/json`.
**Colección de Postman:** [`postman/PedalVerde.postman_collection.json`](postman/PedalVerde.postman_collection.json)

## Contenido

1. [Visión general](#1-visión-general)
2. [Arquitectura](#2-arquitectura)
3. [Modelos de datos](#3-modelos-de-datos)
4. [Formato de respuestas](#4-formato-de-respuestas)
5. [Endpoints](#5-endpoints)
6. [Códigos de error](#6-códigos-de-error)
7. [Datos semilla para probar](#7-datos-semilla-para-probar)

---

## 1. Visión general

PedalVerde modela un sistema de bicicletas públicas compartidas como los que tienen varias ciudades de Colombia. Resuelve tres necesidades:

1. **Consultar disponibilidad:** cuántas bicis (mecánicas y eléctricas) y cuántos anclajes libres hay en cada estación.
2. **Prestar y devolver:** con validaciones de usuario, estación, batería y tiempo.
3. **Controlar la flota:** mantenimiento de bicicletas, sanciones a usuarios y estadísticas.

## 2. Arquitectura

```text
Petición HTTP
   │
   ▼
src/app.js ── middlewares: registro, CORS, cabeceras, express.json (máx. 20 kB)
   │
   ▼
src/rutas/*.js ── leen la URL y el cuerpo, validan formato (400)
   │
   ▼
src/servicios/*.js ── reglas de negocio (403, 404, 409)
   │
   ▼
src/datos/db.js ── datos en memoria (se reinician con POST /api/reset)
   │
   ▼
manejarErrores ── convierte cualquier error en { ok: false, error: { codigo, mensaje } }
```

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Configuración | `src/config.js` | Reglas de negocio en un solo lugar |
| Rutas | `src/rutas/` | Un archivo por recurso: estaciones, bicicletas, usuarios, préstamos y sistema |
| Servicios | `src/servicios/` | Disponibilidad, préstamos, devoluciones, cancelaciones y sanciones |
| Utilidades | `src/utils/` | Formato de respuestas, validación, fechas y distancia (Haversine) |
| Datos | `src/datos/` | Semilla y base de datos en memoria |

## 3. Modelos de datos

### Estación

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `id` | string | Identificador | `"EST-01"` |
| `nombre` | string | Nombre del lugar | `"Universidad de Antioquia"` |
| `zona` | string | `Norte`, `Centro`, `Laureles` o `El Poblado` | `"Norte"` |
| `capacidad` | number | Número de anclajes | `14` |
| `coordenadas` | object | `{ lat, lng }` | `{ "lat": 6.2675, "lng": -75.5686 }` |
| `disponibilidad` | object | Calculado en cada consulta (ver abajo) | |

`disponibilidad`:

| Campo | Descripción |
|---|---|
| `bicisDisponibles` | Bicis que se pueden prestar ya (mecánicas + eléctricas con ≥ 20 % de batería) |
| `mecanicas` / `electricas` | Desglose de las anteriores |
| `electricasSinCarga` | Eléctricas ancladas con menos de 20 % |
| `enMantenimiento` | Bicis bloqueadas en la estación |
| `anclajesLibres` | `capacidad` − bicis ancladas |
| `ocupacionPct` | Porcentaje de anclajes ocupados |

### Bicicleta

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `id` | string | Identificador | `"BIC-007"` |
| `tipo` | string | `mecanica` o `electrica` | `"electrica"` |
| `modelo` | string | Modelo | `"E-Urbana 250W"` |
| `estado` | string | `disponible`, `en_uso` o `mantenimiento` | `"disponible"` |
| `estacionId` | string \| null | Estación donde está anclada (`null` si está en uso) | `"EST-01"` |
| `bateria` | number \| null | 0 a 100 en eléctricas, `null` en mecánicas | `92` |
| `kmRecorridos` | number | Kilómetros acumulados | `379` |
| `nota` | string \| null | Motivo del mantenimiento | `null` |

### Usuario

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `id` | string | Identificador | `"USR-1001"` |
| `nombre` | string | 3 a 80 caracteres | `"Laura Gómez"` |
| `documento` | string | 6 a 12 dígitos, único | `"1036654321"` |
| `correo` | string | Correo válido, único | `"laura.gomez@ejemplo.com"` |
| `plan` | string | `estudiante` (60 min) o `general` (45 min) | `"estudiante"` |
| `sancionadoHasta` | string \| null | Fecha ISO hasta la que no puede prestar | `null` |
| `prestamoActivoId` | string \| null | Préstamo en curso | `null` |
| `situacion` | string | Calculado: `habilitado`, `con_prestamo` o `sancionado` | `"habilitado"` |
| `limiteMinutos` | number | Calculado según el plan | `60` |

### Préstamo

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | `"PRE-0006"` |
| `usuarioId`, `bicicletaId` | string | Quién y qué bici |
| `tipoBicicleta` | string | `mecanica` o `electrica` |
| `estacionOrigenId` / `estacionDestinoId` | string | Dónde se tomó y dónde se devolvió |
| `inicio` / `fin` / `limiteDevolucion` | string ISO | Fechas |
| `duracionMin` | number | Minutos de uso (al finalizar) |
| `distanciaKm` | number | Distancia estimada: línea recta × 1,3 |
| `minutosExcedidos` / `diasSancion` | number | Exceso sobre el límite y sanción aplicada |
| `reporteDanio` | string \| null | Daño reportado al devolver |
| `estado` | string | `activo`, `finalizado` o `cancelado` |
| `minutosTranscurridos` / `minutosRestantes` / `vencido` | | Solo en préstamos activos, calculados al consultar |

## 4. Formato de respuestas

**Éxito**

```json
{
  "ok": true,
  "mensaje": "Texto para personas (en POST, PATCH y DELETE)",
  "total": 2,
  "filtros": { "zona": "Norte" },
  "datos": {},
  "marcaTiempo": "2026-10-26T14:59:29.595Z"
}
```

`total` y `filtros` solo aparecen en los listados.

**Error**

```json
{
  "ok": false,
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Hay campos inválidos en la petición.",
    "detalles": [
      { "campo": "usuarioId", "problema": "Es obligatorio." },
      { "campo": "tipo", "problema": "Debe ser uno de: mecanica, electrica." }
    ]
  },
  "marcaTiempo": "2026-10-26T14:59:30.512Z"
}
```

La validación junta **todos** los problemas en una sola respuesta para corregirlos de una vez.

## 5. Endpoints

### Sistema

| Método y ruta | Descripción | Respuesta |
|---|---|---|
| `GET /api` | Índice de rutas y reglas vigentes | 200 |
| `GET /api/salud` | `{ estado: "ok", servicio, version, segundosActivo }` | 200 |
| `GET /api/estadisticas` | Flota, estaciones, préstamos, usuarios y zonas | 200 |
| `GET /api/auditoria` | Cambios de estado de bicicletas, del más reciente al más antiguo | 200 |
| `POST /api/reset` | Restaura los datos semilla | 200 |

### Estaciones

**`GET /api/estaciones`**

| Parámetro | Valores | Ejemplo |
|---|---|---|
| `zona` | Nombre de la zona (no distingue mayúsculas ni tildes) | `zona=el poblado` |
| `tipo` | `mecanica` \| `electrica`: solo estaciones con ese tipo disponible | `tipo=electrica` |
| `minDisponibles` | Entero ≥ 0 | `minDisponibles=1` |
| `conAnclajes` | `true` \| `false` | `conAnclajes=true` |
| `q` | Texto contenido en el nombre | `q=parque` |

Errores: `400 VALIDACION` si un parámetro tiene un valor no permitido.

**`GET /api/estaciones/:id`**: estación + `bicicletas` ancladas + `prestamosActivosDesdeAqui`. Errores: `404 ESTACION_NO_ENCONTRADA`.

### Bicicletas

**`GET /api/bicicletas`**: filtros `estado` (`disponible`, `en_uso`, `mantenimiento`), `tipo`, `estacionId`, `bateriaMin` (0 a 100, solo eléctricas).

**`GET /api/bicicletas/:id`**: bici + `prestamoActivo` + últimos 5 préstamos + últimos 5 cambios de estado.

**`PATCH /api/bicicletas/:id/estado`**

```json
{ "estado": "mantenimiento", "motivo": "Freno trasero desajustado" }
```

| Campo | Regla |
|---|---|
| `estado` | Obligatorio. `disponible` o `mantenimiento` |
| `motivo` | Obligatorio. 5 a 200 caracteres |

Respuesta `200` con `datos` (bici actualizada) y `auditoria` (registro creado). Al habilitar una eléctrica sale del taller con 100 % de batería.
Errores: `400 VALIDACION`, `404 BICICLETA_NO_ENCONTRADA`, `409 BICICLETA_EN_USO`, `409 ESTADO_SIN_CAMBIO`.

### Usuarios

**`GET /api/usuarios`**: filtro `plan` (`estudiante`, `general`).

**`GET /api/usuarios/:id`**: usuario + `prestamoActivo` + `resumen` (viajes, minutos, km, viajes con sanción) + `historial`.

**`POST /api/usuarios`**

```json
{
  "nombre": "Mariana Cardona",
  "documento": "1037123456",
  "correo": "mariana.cardona@ejemplo.com",
  "plan": "estudiante"
}
```

Respuesta `201 Created` con encabezado `Location: /api/usuarios/USR-1007`.
Errores: `400 VALIDACION`, `400 JSON_INVALIDO`, `409 DOCUMENTO_DUPLICADO`, `409 CORREO_DUPLICADO`.

### Préstamos

**`GET /api/prestamos`**: filtros `estado` (`activo`, `finalizado`, `cancelado`), `usuarioId`, `estacionId` (origen o destino). Del más reciente al más antiguo.

**`GET /api/prestamos/:id`**: detalle. Errores: `404 PRESTAMO_NO_ENCONTRADO`.

**`POST /api/prestamos`**: prestar una bicicleta.

```json
{ "usuarioId": "USR-1001", "estacionId": "EST-01", "tipo": "electrica" }
```

| Campo | Regla |
|---|---|
| `usuarioId` | Obligatorio. Formato `USR-1001` |
| `estacionId` | Obligatorio. Formato `EST-01` |
| `tipo` | Opcional. `mecanica` o `electrica`. Si se omite, prefiere mecánica |

Validaciones en orden:

1. El cuerpo tiene el formato correcto → si no, `400 VALIDACION`.
2. El usuario existe → si no, `404 USUARIO_NO_ENCONTRADO`.
3. El usuario no está sancionado → si no, `403 USUARIO_SANCIONADO`.
4. El usuario no tiene otra bici → si no, `409 PRESTAMO_ACTIVO_EXISTENTE`.
5. La estación existe → si no, `404 ESTACION_NO_ENCONTRADA`.
6. Hay una bici prestable del tipo pedido → si no, `409 SIN_BICICLETAS_DISPONIBLES` (con el desglose en `detalles`).

Respuesta `201 Created` con `prestamo`, `bicicleta` y `usuario`, y encabezado `Location`.

**`PATCH /api/prestamos/:id/devolucion`**: devolver la bicicleta.

```json
{ "estacionId": "EST-07", "reporteDanio": "La luz delantera no enciende" }
```

| Campo | Regla |
|---|---|
| `estacionId` | Obligatorio. Formato `EST-01` |
| `reporteDanio` | Opcional. 5 a 200 caracteres. Deja la bici en mantenimiento |

Cálculos:

- `duracionMin` = minutos desde `inicio`.
- `minutosExcedidos` = `duracionMin` − límite del plan (mínimo 0).
- `diasSancion` = ⌈`minutosExcedidos` / 15⌉, máximo 7. Si el usuario ya tenía sanción, se conserva la fecha más lejana.
- `distanciaKm` = distancia Haversine entre estaciones × 1,3.
- Eléctricas: la batería baja 0,5 % por minuto.

Respuesta `200` con `prestamo`, `bicicleta` y `sancion: { aplicada, dias, hasta }`.
Errores: `404 PRESTAMO_NO_ENCONTRADO`, `404 ESTACION_NO_ENCONTRADA`, `409 PRESTAMO_NO_ACTIVO`, `409 ESTACION_LLENA` (con `sugerencias`: las 3 estaciones más cercanas con espacio).

**`DELETE /api/prestamos/:id`**: cancelar un préstamo de 2 minutos o menos. La bici vuelve a la estación de origen y el préstamo queda `cancelado` (se conserva en el historial).
Errores: `404 PRESTAMO_NO_ENCONTRADO`, `409 PRESTAMO_NO_ACTIVO`, `409 CANCELACION_FUERA_DE_TIEMPO`, `409 ESTACION_LLENA`.

## 6. Códigos de error

| HTTP | Código | Cuándo ocurre |
|---|---|---|
| 400 | `VALIDACION` | Campos faltantes o con formato incorrecto, o parámetros de URL inválidos |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido |
| 403 | `USUARIO_SANCIONADO` | El usuario tiene una sanción vigente |
| 404 | `ESTACION_NO_ENCONTRADA`, `BICICLETA_NO_ENCONTRADA`, `USUARIO_NO_ENCONTRADO`, `PRESTAMO_NO_ENCONTRADO` | El ID no existe |
| 404 | `RUTA_NO_ENCONTRADA` | La ruta no existe |
| 409 | `PRESTAMO_ACTIVO_EXISTENTE` | El usuario ya tiene una bici |
| 409 | `SIN_BICICLETAS_DISPONIBLES` | No hay bici prestable del tipo pedido |
| 409 | `ESTACION_LLENA` | No hay anclajes libres para devolver |
| 409 | `PRESTAMO_NO_ACTIVO` | El préstamo ya terminó o se canceló |
| 409 | `CANCELACION_FUERA_DE_TIEMPO` | Pasaron más de 2 minutos |
| 409 | `BICICLETA_EN_USO` | Se intenta cambiar el estado de una bici que está rodando |
| 409 | `ESTADO_SIN_CAMBIO` | La bici ya tiene ese estado |
| 409 | `DOCUMENTO_DUPLICADO`, `CORREO_DUPLICADO` | Ya existe un usuario con ese dato |
| 413 | `CUERPO_DEMASIADO_GRANDE` | El cuerpo supera 20 kB |
| 500 | `ERROR_INTERNO` | Error inesperado (se registra en la consola del servidor) |

## 7. Datos semilla para probar

Después de `POST /api/reset` siempre hay estos casos listos:

| Dato | Para qué sirve |
|---|---|
| `USR-1001` Laura (estudiante), `USR-1005` Sara, `USR-1006` Julián | Usuarios habilitados para prestar |
| `USR-1002` Andrés | Tiene el préstamo activo `PRE-0001` (hace 20 min) → probar `PRESTAMO_ACTIVO_EXISTENTE` y `CANCELACION_FUERA_DE_TIEMPO` |
| `USR-1003` Valentina | Préstamo `PRE-0002` de hace 95 min con límite de 60 → al devolverlo recibe 3 días de sanción |
| `USR-1004` Camilo | Sancionado por 2 días → probar `USUARIO_SANCIONADO` |
| `EST-03` Parque Berrío | Su única eléctrica (`BIC-020`) tiene 12 % → no se presta |
| `EST-04` San Antonio | Vacía → probar `SIN_BICICLETAS_DISPONIBLES` |
| `EST-08` Parque Lleras | Llena → probar `ESTACION_LLENA` y ver las sugerencias |
| `BIC-051` | En uso por `PRE-0001` → probar `BICICLETA_EN_USO` |
| `BIC-010`, `BIC-031` | En mantenimiento |
