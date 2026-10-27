# Resultados de las pruebas de Postman

Ejecución con Newman de `postman/PedalVerde.postman_collection.json` contra `http://localhost:4000` (26 de octubre de 2026 a las 9:59 a. m.).

**27 peticiones, 0 fallidas · 121 comprobaciones, 0 fallidas.**

Para repetirla: enciende la API (`npm start`) y en otra terminal ejecuta `npm run postman`.

| Petición | Método | URL | Estado | Tiempo | Pruebas |
|---|---|---|---|---|---|
| Reiniciar datos de prueba | POST | `/api/reset` | 200 OK | 34 ms | 4/4 |
| Salud del servicio | GET | `/api/salud` | 200 OK | 3 ms | 4/4 |
| 1. Listar estaciones de la zona Norte con bicis (GET con filtros) | GET | `/api/estaciones?zona=Norte&minDisponibles=1` | 200 OK | 3 ms | 5/5 |
| 2. Consultar una estación por ID (GET con parámetro de ruta) | GET | `/api/estaciones/EST-01` | 200 OK | 2 ms | 5/5 |
| 3. Prestar una bicicleta eléctrica (POST) | POST | `/api/prestamos` | 201 Created | 4 ms | 5/5 |
| 4. Devolver la bicicleta en otra estación (PATCH) | PATCH | `/api/prestamos/PRE-0006/devolucion` | 200 OK | 2 ms | 6/6 |
| 5. Prestar una mecánica para cancelarla (POST) | POST | `/api/prestamos` | 201 Created | 2 ms | 4/4 |
| 6. Cancelar el préstamo recién creado (DELETE) | DELETE | `/api/prestamos/PRE-0007` | 200 OK | 2 ms | 5/5 |
| Eléctricas disponibles con 50 % de batería o más (GET) | GET | `/api/bicicletas?tipo=electrica&estado=disponible&bateriaMin=50` | 200 OK | 4 ms | 4/4 |
| Enviar una bicicleta a mantenimiento (PATCH) | PATCH | `/api/bicicletas/BIC-002/estado` | 200 OK | 2 ms | 4/4 |
| Registrar un usuario (POST) | POST | `/api/usuarios` | 201 Created | 2 ms | 4/4 |
| Perfil de un usuario con el préstamo vencido (GET) | GET | `/api/usuarios/USR-1003` | 200 OK | 1 ms | 4/4 |
| Devolver tarde y reportar un daño: genera sanción (PATCH) | PATCH | `/api/prestamos/PRE-0002/devolucion` | 200 OK | 2 ms | 5/5 |
| Préstamos activos (GET) | GET | `/api/prestamos?estado=activo` | 200 OK | 1 ms | 4/4 |
| Estadísticas del sistema (GET) | GET | `/api/estadisticas` | 200 OK | 2 ms | 5/5 |
| Usuario sancionado no puede prestar → 403 | POST | `/api/prestamos` | 403 Forbidden | 4 ms | 5/5 |
| Usuario que ya tiene una bici → 409 | POST | `/api/prestamos` | 409 Conflict | 2 ms | 5/5 |
| Estación sin bicicletas → 409 | POST | `/api/prestamos` | 409 Conflict | 1 ms | 4/4 |
| Eléctrica con batería baja no se presta → 409 | POST | `/api/prestamos` | 409 Conflict | 2 ms | 5/5 |
| Devolver en una estación llena → 409 con sugerencias | PATCH | `/api/prestamos/PRE-0001/devolucion` | 409 Conflict | 1 ms | 5/5 |
| Cancelar un préstamo de hace 20 minutos → 409 | DELETE | `/api/prestamos/PRE-0001` | 409 Conflict | 1 ms | 4/4 |
| Campos inválidos → 400 con la lista de problemas | POST | `/api/prestamos` | 400 Bad Request | 2 ms | 5/5 |
| JSON mal escrito → 400 | POST | `/api/usuarios` | 400 Bad Request | 1 ms | 4/4 |
| Documento repetido → 409 | POST | `/api/usuarios` | 409 Conflict | 2 ms | 4/4 |
| Bicicleta en uso no cambia de estado → 409 | PATCH | `/api/bicicletas/BIC-051/estado` | 409 Conflict | 1 ms | 4/4 |
| Estación que no existe → 404 | GET | `/api/estaciones/EST-99` | 404 Not Found | 1 ms | 4/4 |
| Filtro con un valor inválido → 400 | GET | `/api/estaciones?tipo=patineta` | 400 Bad Request | 2 ms | 4/4 |

Cada petición suma 2 comprobaciones de la colección (responde en menos de 1 s y devuelve JSON con el campo `ok`) más las suyas.

## Respuestas reales

Las listas largas están recortadas (`"… N más"`) para que se lean mejor.

### 1. Listar estaciones de la zona Norte con bicis (GET con filtros)

`GET http://localhost:4000/api/estaciones?zona=Norte&minDisponibles=1` → **200 OK** en 3 ms

```json
{
  "ok": true,
  "total": 2,
  "filtros": {
    "zona": "Norte",
    "tipo": null,
    "minDisponibles": 1,
    "conAnclajes": null,
    "q": null
  },
  "datos": [
    {
      "id": "EST-01",
      "nombre": "Universidad de Antioquia",
      "zona": "Norte",
      "capacidad": 14,
      "coordenadas": {
        "lat": 6.2675,
        "lng": -75.5686
      },
      "disponibilidad": {
        "bicisDisponibles": 9,
        "mecanicas": 6,
        "electricas": 3,
        "electricasSinCarga": 0,
        "enMantenimiento": 1,
        "anclajesLibres": 4,
        "ocupacionPct": 71
      }
    },
    {
      "id": "EST-02",
      "nombre": "Parque Explora",
      "zona": "Norte",
      "capacidad": 12,
      "coordenadas": {
        "lat": 6.2706,
        "lng": -75.5656
      },
      "disponibilidad": {
        "bicisDisponibles": 6,
        "mecanicas": 4,
        "electricas": 2,
        "electricasSinCarga": 0,
        "enMantenimiento": 0,
        "anclajesLibres": 6,
        "ocupacionPct": 50
      }
    }
  ],
  "marcaTiempo": "2026-10-26T14:59:29.595Z"
}
```

### 2. Consultar una estación por ID (GET con parámetro de ruta)

`GET http://localhost:4000/api/estaciones/EST-01` → **200 OK** en 2 ms

```json
{
  "ok": true,
  "datos": {
    "id": "EST-01",
    "nombre": "Universidad de Antioquia",
    "zona": "Norte",
    "capacidad": 14,
    "coordenadas": {
      "lat": 6.2675,
      "lng": -75.5686
    },
    "disponibilidad": {
      "bicisDisponibles": 9,
      "mecanicas": 6,
      "electricas": 3,
      "electricasSinCarga": 0,
      "enMantenimiento": 1,
      "anclajesLibres": 4,
      "ocupacionPct": 71
    },
    "prestamosActivosDesdeAqui": 0,
    "bicicletas": [
      {
        "id": "BIC-001",
        "tipo": "mecanica",
        "estado": "disponible",
        "bateria": null,
        "kmRecorridos": 157,
        "nota": null
      },
      {
        "id": "BIC-002",
        "tipo": "mecanica",
        "estado": "disponible",
        "bateria": null,
        "kmRecorridos": 194,
        "nota": null
      },
      {
        "id": "BIC-003",
        "tipo": "mecanica",
        "estado": "disponible",
        "bateria": null,
        "kmRecorridos": 231,
        "nota": null
      },
      "… 7 más"
    ]
  },
  "marcaTiempo": "2026-10-26T14:59:29.686Z"
}
```

### 3. Prestar una bicicleta eléctrica (POST)

`POST http://localhost:4000/api/prestamos` → **201 Created** en 4 ms

```json
{
  "ok": true,
  "mensaje": "Préstamo PRE-0006 creado: BIC-007 (eléctrica) desde Universidad de Antioquia. Devuélvela antes de las 10:59 a. m. (60 min).",
  "datos": {
    "prestamo": {
      "id": "PRE-0006",
      "usuarioId": "USR-1001",
      "bicicletaId": "BIC-007",
      "tipoBicicleta": "electrica",
      "estacionOrigenId": "EST-01",
      "estacionDestinoId": null,
      "inicio": "2026-10-26T14:59:29.766Z",
      "limiteDevolucion": "2026-10-26T15:59:29.766Z",
      "fin": null,
      "duracionMin": null,
      "distanciaKm": null,
      "minutosExcedidos": 0,
      "diasSancion": 0,
      "reporteDanio": null,
      "estado": "activo",
      "minutosTranscurridos": 0,
      "minutosRestantes": 60,
      "vencido": false
    },
    "bicicleta": {
      "id": "BIC-007",
      "tipo": "electrica",
      "modelo": "E-Urbana 250W",
      "estado": "en_uso",
      "estacionId": null,
      "bateria": 92,
      "kmRecorridos": 379,
      "nota": null
    },
    "usuario": {
      "id": "USR-1001",
      "nombre": "Laura Gómez",
      "plan": "estudiante"
    }
  },
  "marcaTiempo": "2026-10-26T14:59:29.766Z"
}
```

### 4. Devolver la bicicleta en otra estación (PATCH)

`PATCH http://localhost:4000/api/prestamos/PRE-0006/devolucion` → **200 OK** en 2 ms

```json
{
  "ok": true,
  "mensaje": "Bicicleta BIC-007 devuelta en Ciudad del Río tras 0 min y 6.51 km. Devuelta a tiempo, sin sanción.",
  "datos": {
    "prestamo": {
      "id": "PRE-0006",
      "usuarioId": "USR-1001",
      "bicicletaId": "BIC-007",
      "tipoBicicleta": "electrica",
      "estacionOrigenId": "EST-01",
      "estacionDestinoId": "EST-07",
      "inicio": "2026-10-26T14:59:29.766Z",
      "limiteDevolucion": "2026-10-26T15:59:29.766Z",
      "fin": "2026-10-26T14:59:29.856Z",
      "duracionMin": 0,
      "distanciaKm": 6.51,
      "minutosExcedidos": 0,
      "diasSancion": 0,
      "reporteDanio": null,
      "estado": "finalizado"
    },
    "bicicleta": {
      "id": "BIC-007",
      "tipo": "electrica",
      "modelo": "E-Urbana 250W",
      "estado": "disponible",
      "estacionId": "EST-07",
      "bateria": 92,
      "kmRecorridos": 385.5,
      "nota": null
    },
    "sancion": {
      "aplicada": false,
      "dias": 0,
      "hasta": null
    }
  },
  "marcaTiempo": "2026-10-26T14:59:29.856Z"
}
```

### 5. Prestar una mecánica para cancelarla (POST)

`POST http://localhost:4000/api/prestamos` → **201 Created** en 2 ms

```json
{
  "ok": true,
  "mensaje": "Préstamo PRE-0007 creado: BIC-025 (mecánica) desde Estadio Atanasio Girardot. Devuélvela antes de las 10:59 a. m. (60 min).",
  "datos": {
    "prestamo": {
      "id": "PRE-0007",
      "usuarioId": "USR-1005",
      "bicicletaId": "BIC-025",
      "tipoBicicleta": "mecanica",
      "estacionOrigenId": "EST-05",
      "estacionDestinoId": null,
      "inicio": "2026-10-26T14:59:29.949Z",
      "limiteDevolucion": "2026-10-26T15:59:29.949Z",
      "fin": null,
      "duracionMin": null,
      "distanciaKm": null,
      "minutosExcedidos": 0,
      "diasSancion": 0,
      "reporteDanio": null,
      "estado": "activo",
      "minutosTranscurridos": 0,
      "minutosRestantes": 60,
      "vencido": false
    },
    "bicicleta": {
      "id": "BIC-025",
      "tipo": "mecanica",
      "modelo": "Urbana 7V",
      "estado": "en_uso",
      "estacionId": null,
      "bateria": null,
      "kmRecorridos": 145,
      "nota": null
    },
    "usuario": {
      "id": "USR-1005",
      "nombre": "Sara Mejía",
      "plan": "estudiante"
    }
  },
  "marcaTiempo": "2026-10-26T14:59:29.949Z"
}
```

### 6. Cancelar el préstamo recién creado (DELETE)

`DELETE http://localhost:4000/api/prestamos/PRE-0007` → **200 OK** en 2 ms

```json
{
  "ok": true,
  "mensaje": "Préstamo PRE-0007 cancelado. BIC-025 volvió a Estadio Atanasio Girardot.",
  "datos": {
    "prestamo": {
      "id": "PRE-0007",
      "usuarioId": "USR-1005",
      "bicicletaId": "BIC-025",
      "tipoBicicleta": "mecanica",
      "estacionOrigenId": "EST-05",
      "estacionDestinoId": "EST-05",
      "inicio": "2026-10-26T14:59:29.949Z",
      "limiteDevolucion": "2026-10-26T15:59:29.949Z",
      "fin": "2026-10-26T14:59:30.042Z",
      "duracionMin": 0,
      "distanciaKm": 0,
      "minutosExcedidos": 0,
      "diasSancion": 0,
      "reporteDanio": null,
      "estado": "cancelado"
    },
    "bicicleta": {
      "id": "BIC-025",
      "tipo": "mecanica",
      "modelo": "Urbana 7V",
      "estado": "disponible",
      "estacionId": "EST-05",
      "bateria": null,
      "kmRecorridos": 145,
      "nota": null
    }
  },
  "marcaTiempo": "2026-10-26T14:59:30.042Z"
}
```

### Devolver tarde y reportar un daño: genera sanción (PATCH)

`PATCH http://localhost:4000/api/prestamos/PRE-0002/devolucion` → **200 OK** en 2 ms

```json
{
  "ok": true,
  "mensaje": "Bicicleta BIC-052 devuelta en Primer Parque de Laureles tras 95 min y 1.86 km. Se pasó 35 min del límite: 3 día(s) de sanción.",
  "datos": {
    "prestamo": {
      "id": "PRE-0002",
      "usuarioId": "USR-1003",
      "bicicletaId": "BIC-052",
      "tipoBicicleta": "electrica",
      "estacionOrigenId": "EST-05",
      "estacionDestinoId": "EST-06",
      "inicio": "2026-10-26T13:24:29.411Z",
      "limiteDevolucion": "2026-10-26T14:24:29.411Z",
      "fin": "2026-10-26T14:59:30.477Z",
      "duracionMin": 95,
      "distanciaKm": 1.86,
      "minutosExcedidos": 35,
      "diasSancion": 3,
      "reporteDanio": "La luz delantera no enciende",
      "estado": "finalizado"
    },
    "bicicleta": {
      "id": "BIC-052",
      "tipo": "electrica",
      "modelo": "E-Urbana 250W",
      "estado": "mantenimiento",
      "estacionId": "EST-06",
      "bateria": 11,
      "kmRecorridos": 245.9,
      "nota": "Daño reportado al devolver: La luz delantera no enciende"
    },
    "sancion": {
      "aplicada": true,
      "dias": 3,
      "hasta": "2026-10-29T14:59:30.477Z"
    }
  },
  "marcaTiempo": "2026-10-26T14:59:30.477Z"
}
```

### Usuario sancionado no puede prestar → 403

`POST http://localhost:4000/api/prestamos` → **403 Forbidden** en 4 ms

```json
{
  "ok": false,
  "error": {
    "codigo": "USUARIO_SANCIONADO",
    "mensaje": "Camilo Zapata está sancionado hasta el 28/10/2026, 5:59 a. m. y no puede prestar bicicletas.",
    "detalles": {
      "sancionadoHasta": "2026-10-28T10:59:29.411Z"
    }
  },
  "marcaTiempo": "2026-10-26T14:59:30.770Z"
}
```

### Devolver en una estación llena → 409 con sugerencias

`PATCH http://localhost:4000/api/prestamos/PRE-0001/devolucion` → **409 Conflict** en 1 ms

```json
{
  "ok": false,
  "error": {
    "codigo": "ESTACION_LLENA",
    "mensaje": "Parque Lleras no tiene anclajes libres. Prueba en una estación cercana.",
    "detalles": {
      "sugerencias": [
        {
          "id": "EST-07",
          "nombre": "Ciudad del Río",
          "distanciaKm": 1.8,
          "anclajesLibres": 5
        },
        {
          "id": "EST-04",
          "nombre": "San Antonio",
          "distanciaKm": 4.27,
          "anclajesLibres": 10
        },
        {
          "id": "EST-03",
          "nombre": "Parque Berrío",
          "distanciaKm": 4.64,
          "anclajesLibres": 6
        }
      ]
    }
  },
  "marcaTiempo": "2026-10-26T14:59:31.126Z"
}
```

### Campos inválidos → 400 con la lista de problemas

`POST http://localhost:4000/api/prestamos` → **400 Bad Request** en 2 ms

```json
{
  "ok": false,
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Hay campos inválidos en la petición.",
    "detalles": [
      {
        "campo": "usuarioId",
        "problema": "Es obligatorio."
      },
      {
        "campo": "estacionId",
        "problema": "Debe tener el formato 'EST-01'."
      },
      {
        "campo": "tipo",
        "problema": "Debe ser uno de: mecanica, electrica."
      }
    ]
  },
  "marcaTiempo": "2026-10-26T14:59:31.311Z"
}
```
