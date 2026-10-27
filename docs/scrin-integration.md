# Integración Scrin.io → Sistema de Gestión de Horas (SGH)

## 0. Resumen

Integrar el sistema de **Gestión de Horas** (módulo `sgh`, NestJS + PostgreSQL) con el
sistema de monitorización **Scrin.io** consumiendo su API.

- **Dirección:** Scrin.io es la fuente de datos. Se **importa** el tiempo capturado a SGH. No hay push hacia Scrin.
- **Cuentas:** 3 cuentas, cada una con su propio token de API (ya existe el token de la cuenta 1; faltan los otros 2).
- **Disparador:** Sincronización **manual desde el frontend** (rango de fechas).
- **Tokens:** almacenados en **tabla de base de datos** (configurable sin redeploy).

> **Decisión técnica importante:** Scrin expone **dos API**. La **v2** (documentada, base `/api/v2`)
> es la **recomendada** para esta integración porque entrega el **catálogo de usuarios y proyectos**
> (`GetCommonData`) y las actividades en formato limpio (`GetActivities`). La **v1** es el endpoint
> `report` que ya usas en Postman; queda como alternativa rápida (ver §1.2).

---

## 1. Las dos API de Scrin

### 1.1 Autenticación

| API | Autenticación | Base URL |
|-----|---------------|----------|
| **v1** | Query param `?token=…` | `https://scrin.io/api/v1` |
| **v2** | Header `X-SSM-Token: <token>` | `https://scrin.io/api/v2` |

> El **mismo token** sirve para ambas versiones. La v2 es más segura porque el token va en
> *header* (no se filtra en URLs/logs de proxy).

---

### 1.2 API v1 — endpoint `report` (el que usas en Postman)

```
GET https://scrin.io/api/v1/report?token=<TOKEN>&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Respuesta (única y consolidada por empleado/rango):

```json
{
  "status": "OK",
  "rows": [
    {
      "employee_id": 275279,
      "employee": "Jesus Cordero",
      "from": "/Date(1782905280000)/",
      "to": "/Date(1782905640000)/",
      "duration_minutes": 6,
      "offline": false,
      "note": "Resolviendo (Definiciones - Constante)  SNO",
      "project_id": "c88f409a-21b0-5af0-3bc3-3839692e177e",
      "project_name": "MIGRACION ANGULAR",
      "ref": null
    }
  ]
}
```

- **Ventaja:** una sola llamada devuelve empleado + proyecto + duración ya resueltos; ideal para un import rápido por rango.
- **Desventajas:** token como query param; fechas en `/Date(ms)/`; `employee_id` no es reutilizable entre cuentas; **no devuelve catálogo** (usuarios/proyectos) y **ignora** parámetros extra (`employee`, `limit`) — verificado.

---

### 1.3 API v2 — API REST oficial (la recomendada)

Documentada en `https://scrin.io/apidoc/` (base `/api/v2`, header `X-SSM-Token`).

> ⚠️ **Requisitos obligatorios en todos los endpoints v2** (verificado con el servidor):
> - Método **`POST`** (usar `GET` devuelve **500**).
> - Header **`X-SSM-Token: <token>`**.
> - Header **`Content-Type: application/json`** (sin él, devuelve **500**).
> - Header **`Accept: application/json`** (sin él, devuelve **500**). Crítico al usar
>   clientes HTTP como el `fetch` de Node, cuyo `Accept` por defecto (`*/*`) provoca el 500.
>
> Con `body: {}` (correcto para `GetCommonData`) y estos headers, responde **200 OK**.

### Endpoints disponibles

| Grupo       | Endpoint                | Método | Descripción |
|-------------|-------------------------|--------|-------------|
| **Common**  | `GetCommonData`          | POST   | **Catálogo**: empresas, empleados y proyectos |
| Activities  | `GetActivities`          | POST   | Actividades por rango y empleado |
| Activities  | `AddOfflineActivity`     | POST   | Crear actividad offline (escritura) |
| Activities  | `SplitActivityExact`     | POST   | Dividir/corregir actividades |
| Projects    | `EditProject`            | POST   | Crear/editar proyecto |
| Projects    | `AssignProject`          | POST   | Asignar proyectos a empleados |
| Projects    | `DeleteProject`          | POST   | Eliminar proyecto |
| Employments | `InviteEmployee`         | POST   | Invitar nuevo empleado |
| Employments | `DeleteEmployment`       | POST   | Eliminar/ocultar empleado |
| Screenshots | `GetScreenshots`         | POST   | Capturas por actividad (opcional, rico) |
| Config      | `SetConfigValue`         | POST   | Configuración de empresa/empleado |

---

### 1.4 Cómo obtener **usuarios** y **proyectos** (lo que pediste)

**→ `POST /api/v2/GetCommonData`** con header `X-SSM-Token`.

**Ejemplo (PowerShell / Postman):**

```
POST https://scrin.io/api/v2/GetCommonData
Header:  X-SSM-Token: 275281l499d98661e7655e248effa61ddef096c
Body:    {}
```

**Respuesta real (verificada con tu token):**

```json
{
  "companies": [
    {
      "id": 275281,
      "name": "Tracking for myself",
      "isAdmin": true,
      "employments": [
        {
          "id": 469374,
          "name": "Wilmer Briceño",
          "email": "wilmerbriceno@sigesp.com.ve",
          "registered": true,
          "lastActive": 1775916112,
          "activityStatus": "offline",
          "role": 0,
          "projects": [
            { "employmentId": 469374, "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e", "payRate": null }
          ]
        },
        {
          "id": 469375,
          "name": "Jesus Cordero",
          "email": "jesusc@sigesp.com.ve",
          "registered": true,
          "lastActive": 1787325723,
          "activityStatus": "online",
          "role": 0,
          "projects": [
            { "employmentId": 469375, "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e", "payRate": null }
          ]
        }
      ],
      "projects": [
        { "id": "c88f409a-21b0-5af0-3bc3-3839692e177e", "name": "MIGRACION ANGULAR", "color": "#5574A6" }
      ],
      "config": { "autoPauseMinutes": 5, "timeZone": { "name": "Venezuela Standard Time", "utcOffset": -240 } },
      "subscription": { "subscriptionType": 0 }
    }
  ],
  "currentCompanyId": 275281,
  "now": 1787325720
}
```

**Campos que nos interesan:**

| Campo                                   | Sig. en SGH |
|-----------------------------------------|-------------|
| `companies[].employments[].id`          | `id_user` (usuario = employment) |
| `companies[].employments[].name`        | `name_user` |
| `companies[].employments[].email`       | `email` |
| `companies[].projects[].id`             | id de proyecto (GUID) |
| `companies[].projects[].name`           | nombre de proyecto |
| `companies[].employments[].projects[]`  | relación empleado↔proyecto |

---

### 1.5 Cómo obtener **actividades** (tiempo trabajado)

**→ `POST /api/v2/GetActivities`** con body = array de rangos por empleado. `from`/`to` en **segundos** desde epoch.

```
POST https://scrin.io/api/v2/GetActivities
Header:  X-SSM-Token: 275281l499d98661e7655e248effa61ddef096c
Body:    [{ "employmentId": 469375, "from": 1784733720, "to": 1787325720 }]
```

**Respuesta real (verificada):**

```json
[
  {
    "activityId": "e7407627-2fee-4774-a679-e4b375b580a3",
    "id": "e7407627-2fee-4774-a679-e4b375b580a3",
    "employmentId": 469375,
    "note": "Curso Opencode",
    "from": 1784732160,
    "to": 1784735340,
    "offline": false,
    "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e",
    "taskId": null
  }
]
```

> **`activityId` es un GUID único** → ideal para deduplicar en SGH (mejor que la clave por `(employee, from, project)` que propusimos para v1).

---

### 1.6 ⚠️ Advertencia de espacios de ID

El `employee_id` de **v1** (ej. `275279`) **NO** es el mismo que el `employmentId` de **v2**
(ej. `469375` para la misma persona "Jesus Cordero"). Los IDs difieren entre versiones.

**Regla:** elegir **una sola versión** para la integración y mapear catálogo por
`name`/`email` al sincronizar, o guardar la correspondencia en la tabla de importación.
Recomendación: usar **v2** de principio a fin.

---

## 2. Arquitectura propuesta (basada en v2)

```
┌──────────────┐              header X-SSM-Token              ┌─────────────────┐
│  Scrin.io    │ ◄─────────────────────────────────────────── │ ScrinService    │
│ (3 tokens)   │   POST /api/v2/GetCommonData (catálogo)      │ (módulo sgh)    │
│              │   POST /api/v2/GetActivities   (actividades) │                 │
└──────────────┘                                             └────────┬────────┘
                                                                      │ parse segundos → fecha
                                                                      ▼
                       ┌──────────────────────────────────────────────────────────┐
                       │                   SyncService (importación)            │
                       │  FASE A: GetCommonData por token                        │
                       │    → upsert sgh_users  (empleados)                      │
                       │    → upsert sgh_proyect (proyectos)                     │
                       │  FASE B: GetActivities por empleado                     │
                       │    → INSERT sgh_scrin_track (dedupe por activityId)     │
                       │    → crear sgh_activity + sgh_dt_activity               │
                       └────────────────────────────┬─────────────────────────────┘
                                                    │
   Frontend ─► POST /sgh/scrin/sync?from&to ────────┘  (trigger manual)
   Frontend ─► /sgh/scrin/accounts ...                  (CRUD de tokens)
```

---

## 3. Modelo de datos

### 3.1 `sgh_scrin_accounts` — cuentas / tokens

| Columna      | Tipo                      | Descripción          |
|--------------|---------------------------|----------------------|
| `id_account` | `INT SERIAL PRIMARY KEY`  | Identificador        |
| `name`       | `VARCHAR(150) NOT NULL`   | Nombre de la cuenta  |
| `token`      | `TEXT NOT NULL`           | Token de API Scrin   |
| `active`     | `SMALLINT DEFAULT 1`      | 1 activa / 0 inactiva|
| `created_at` | `TIMESTAMP DEFAULT NOW()` | Alta                 |
| `updated_at` | `TIMESTAMP`               | Última modificación  |

### 3.2 `sgh_scrin_track` — importación cruda / deduplicación

| Columna             | Tipo                       | Descripción                 |
|---------------------|----------------------------|-----------------------------|
| `id_track`          | `INT SERIAL PRIMARY KEY`   | Identificador               |
| `id_account`        | `INT` (FK → cuentas)       | Cuenta de origen            |
| `activity_id`       | `VARCHAR(64)`              | GUID `activityId` de Scrin  |
| `employment_id`     | `INT`                      | `employmentId` de Scrin     |
| `employee_name`     | `VARCHAR(250)`             | nombre (para mapeo)         |
| `from_ms`/`to_ms`   | `BIGINT`                   | inicio/fin en ms            |
| `offline`           | `BOOLEAN`                  | marcado offline             |
| `note`              | `TEXT`                     | descripción                 |
| `project_id`        | `VARCHAR(64)`              | GUID proyecto               |
| `task_id`           | `VARCHAR(64)`              | GUID tarea (opcional)       |
| `date_sync`         | `TIMESTAMP DEFAULT NOW()`  | fecha de importación        |
| `activity_created`  | `INT` (FK → sgh_activity)  | actividad SGH creada        |

**Índice de deduplicación** (`activityId` es única por cuenta):

```sql
CREATE UNIQUE INDEX uq_scrin_track_dedupe
  ON sgh_scrin_track (id_account, activity_id);
```

---

## 4. Contratos de API (back-end)

Protegidos por JWT + permiso del módulo `sgh`.

### 4.1 Cuentas / tokens

| Método | Ruta                      | Descripción     |
|--------|---------------------------|-----------------|
| GET    | `/sgh/scrin/accounts`     | Lista de cuentas (token ofuscado) |
| POST   | `/sgh/scrin/accounts`     | Crea `{ name, token, active }` |
| PUT    | `/sgh/scrin/accounts/:id` | Actualiza `{ name?, token?, active? }` |
| DELETE | `/sgh/scrin/accounts/:id` | Elimina / desactiva |

### 4.2 Sincronización

| Método | Ruta                                            | Descripción |
|--------|-------------------------------------------------|-------------|
| POST   | `/sgh/scrin/sync?from=YYYY-MM-DD&to=YYYY-MM-DD` | Importa catálogo + actividades de cuentas activas |

Respuesta de sync (resumen):

```json
{
  "from": "2026-07-01",
  "to": "2026-07-16",
  "accounts": 3,
  "users_synced": 6,
  "projects_synced": 4,
  "activities_fetched": 812,
  "activities_created": 795,
  "skipped_duplicates": 17,
  "errors": 0
}
```

### 4.3 Consulta de lo importado

| Método | Ruta                        | Descripción |
|--------|-----------------------------|-------------|
| GET    | `/sgh/scrin/tracks?from&to` | Filas importadas (paginar) |

---

## 5. Mapeo Scrin (v2) → SGH

| Scrin (v2)                        | Destino SGH                  | Estrategia |
|-----------------------------------|------------------------------|------------|
| `GetCommonData.employments[].id`  | `sgh_users.id_user`          | match/create por employmentId o email |
| `employments[].name` / `email`    | `sgh_users.name_user` / `email` | directo |
| `GetCommonData.projects[].id`     | `sgh_proyect`                | store GUID para mapping; match/create por nombre |
| `projects[].name`                 | nombre de proyecto           | directo |
| `GetActivities[].note`            | `sgh_activity.note`          | directo |
| `from`/`to` (segundos)            | `sgh_activity.date_document`, `hour_document` | convertir a fecha/hora local (timezone de la cuenta, UTC-4) |
| `GetActivities[].offline`         | flag / `sgh_activity.visit`  | campo de control |
| `projectId`                       | `sgh_activity.id_proyect`    | resolver GUID→proyecto |
| `activityId`                      | `sgh_scrin_track.activity_id` (+ columna de referencia) | clave de dedupe |

> **Pendiente de confirmar:** clasificación por defecto del registro dentro de SGH
> (tipo de actividad / proceso / estructura por defecto al crear la `sgh_activity`).

---

## 6. Flujo de sincronización (SyncService)

1. **Validar** rango `from`/`to` y que exista ≥ 1 cuenta activa.
2. **Leer** cuentas activas (`sgh_scrin_accounts.active = 1`).
3. **FASE A — Catálogo.** Por cada cuenta:
   - `POST /api/v2/GetCommonData` → upsert `sgh_users` y `sgh_proyect` (mapeo por `email`/`name` y GUID).
4. **FASE B — Actividades.** Por cada cuenta y empleado activo:
   - `POST /api/v2/GetActivities` con `{employmentId, from, to}`.
   - Por cada fila: insertar en `sgh_scrin_track` con `ON CONFLICT (id_account, activity_id) DO NOTHING`.
   - Si es duplicada → `skipped_duplicates++` y continuar.
   - Si es nueva → crear `sgh_activity` (+ `sgh_dt_activity`) y vincular `id_activity` en `activity_created`.
5. Devolver resumen.

Manejo de errores: si una cuenta falla, registrar el error y continuar con la siguiente.

---

## 7. Seguridad de los tokens

- Token en **header** (v2) → no se filtra en URL ni en logs.
- **Lectura ofuscada** en respuestas (nunca devolver el token completo).
- Almacenar con **cifrado simétrico** (AES-GCM) antes de persistir; descifrar solo al hacer la petición.
- No loguear el token.

---

## 8. Consideraciones y riesgos

| Tema | Detalle / mitigación |
|------|----------------------|
| **Dos API / IDs distintos** | Usar **v2** de forma consistente; mapear catálogo por email/nombre. |
| **Formato de fechas** | v1 `/Date(ms)/`; v2 segundos. Parser centralizado en `SqlDateService.parseMs()` / `parseSec()`. |
| **Timezone** | La cuenta reporta `timeZone` (Venezuela, UTC-4). Convertir segundos → fecha local del usuario. |
| **Idempotencia** | Clave única `(id_account, activity_id)` + `ON CONFLICT`. |
| **Errores por cuenta** | No abortar todo el *sync* si una cuenta falla. |
| **Rangos de fecha** | Validar `from ≤ to`; no escanear años completos de una vez. |
| **Tokens restantes** | Falta conseguir los tokens de las cuentas 2 y 3. |

---

## 9. Fases de implementación

**Fase 1 — Datos y cliente**
- Entidades `ScrinAccount`, `ScrinTrack`.
- `ScrinService` (`getCommonData`, `getActivities`, parse de fechas) vía `@nestjs/axios` o `fetch`.
- Migración SQL (`sgh_scrin_accounts`, `sgh_scrin_track`).

**Fase 2 — Sincronización y mapeo**
- `SyncService` (catálogo + actividades, dedupe, mapeo a `sgh_users`/`sgh_proyect`/`sgh_activity`).
- Endpoint `POST /sgh/scrin/sync`.

**Fase 3 — Gestión de cuentas**
- CRUD `/sgh/scrin/accounts`.
- `GET /sgh/scrin/tracks`.

**Fase 4 — Frontend (Angular)**
- Pantalla para las 3 cuentas (nombre, token, activa).
- Botón "Sincronizar" con rango de fechas.
- Listado de registros importados.

**Fase 5 — Seguridad / endurecimiento (opcional)**
- Cifrado de tokens en reposo.
- Reintentos con backoff y límite de concurrencia.

---

## 10. Apéndice — Ejemplos de llamadas (Postman / cURL)

> **Nota:** en todos los ejemplos de v2, `X-SSM-Token` lleva el token de la cuenta.
> El token validado para la cuenta 1 es `275281l499d98661e7655e248effa61ddef096c` (usar
> aquí como `<SCRIN_TOKEN>`). No comitear el token real al repo.
>
> **Todos los endpoints v2 son `POST` y requieren dos headers:** `X-SSM-Token` y
> `Content-Type: application/json` (+ `Accept: application/json`). Sin `Content-Type: application/json`
> o sin `Accept: application/json` el servidor responde **500 Server Error** (verificado).
> `GetCommonData` usa `body: {}`.

### 10.1 Empresa / catálogo completo — `GetCommonData`

Devuelve **empresa, empleados (usuarios), proyectos y configuración** en una sola llamada.

```
POST https://scrin.io/api/v2/GetCommonData
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: {}
```

**Respuesta (200):**

```json
{
  "companies": [
    {
      "id": 275281,
      "name": "Tracking for myself",
      "isAdmin": true,
      "isManager": false,
      "employments": [
        {
          "id": 469374,
          "name": "Wilmer Briceño",
          "email": "wilmerbriceno@sigesp.com.ve",
          "registered": true,
          "lastActive": 1775916112,
          "canEdit": true,
          "payRate": null,
          "activityStatus": "offline",
          "role": 0,
          "projects": [
            { "employmentId": 469374, "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e", "payRate": null }
          ]
        },
        {
          "id": 469375,
          "name": "Jesus Cordero",
          "email": "jesusc@sigesp.com.ve",
          "registered": true,
          "lastActive": 1787325723,
          "canEdit": true,
          "payRate": null,
          "activityStatus": "online",
          "role": 0,
          "projects": [
            { "employmentId": 469375, "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e", "payRate": null }
          ]
        }
      ],
      "projects": [
        {
          "id": "c88f409a-21b0-5af0-3bc3-3839692e177e",
          "name": "MIGRACION ANGULAR",
          "color": "#5574A6",
          "clientId": null,
          "endDate": null
        }
      ],
      "config": {
        "autoPauseMinutes": 5,
        "screenshotsPerHour": 3,
        "disableOfflineTime": false,
        "weeklyLimit": 0,
        "weekStartDay": 0,
        "currency": "$"
      },
      "subscription": { "subscriptionType": 0 },
      "timeZone": { "name": "Venezuela Standard Time", "utcOffset": -240 }
    }
  ],
  "currentCompanyId": 275281,
  "now": 1787325720
}
```

| Dato | Uso en SGH |
|------|------------|
| `companies[].name` / `id` | identificar la cuenta/empresa |
| `employments[]` | usuarios → `sgh_users` |
| `projects[]` | proyectos → `sgh_proyect` |
| `employments[].projects[]` | relación empleado ↔ proyecto |
| `config.timeZone` | conversión de segundos → hora local |

---

### 10.2 Proyectos

### Crear o editar proyecto — `EditProject`

Si el `id` existe, edita su nombre; si no, crea un proyecto nuevo.

```
POST https://scrin.io/api/v2/EditProject
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": "f88e3868-dab4-188c-4b1c-658bf952eafc", "name": "Demo project", "companyId": 275281 }
```

```
POST https://scrin.io/api/v2/EditProject
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": "00000000-0000-0000-0000-000000000000", "name": "Nuevo proyecto", "companyId": 275281 }
```

Respuesta: `HTTP/1.1 200 Ok`

### Asignar / desasignar proyectos a empleados — `AssignProject`

```
POST https://scrin.io/api/v2/AssignProject
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: {
  "employmentIds": [469374, 469375],
  "projectIds": ["c88f409a-21b0-5af0-3bc3-3839692e177e"],
  "isAssign": true
}
```

`isAssign: false` → desasigna. Respuesta: `200 Ok`.

### Eliminar proyecto — `DeleteProject`

```
POST https://scrin.io/api/v2/DeleteProject
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": "229e8847-b7b5-e4e3-88cd-9d1bdc3e6450" }
```

Respuesta: `200 Ok`

---

### 10.3 Empleados (usuarios)

### Invitar nuevo usuario — `InviteEmployee`

```
POST https://scrin.io/api/v2/InviteEmployee
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "email": "newuser@sigesp.com.ve" }
```

Respuesta: `200 Ok`

### Renombrar empleado — `SetEmploymentName`

```
POST https://scrin.io/api/v2/SetEmploymentName
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": 469375, "name": "Team leader" }
```

### Fijar tarifa — `SetEmploymentPayRate`

```
POST https://scrin.io/api/v2/SetEmploymentPayRate
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": 469375, "payRate": 3.55 }
```

### Eliminar / ocultar empleado — `DeleteEmployment`

```
POST https://scrin.io/api/v2/DeleteEmployment
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "id": 469375, "archive": true, "isPermanentlyDeleted": false }
```

---

### 10.4 Actividades

### Consultar actividades — `GetActivities`

`from` / `to` en **segundos** desde epoch. Body = array de rangos por empleado.

```
POST https://scrin.io/api/v2/GetActivities
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: [
  { "employmentId": 469375, "from": 1784733720, "to": 1787325720 },
  { "employmentId": 469374, "from": 1784733720, "to": 1787325720 }
]
```

**Respuesta (200):**

```json
[
  {
    "activityId": "e7407627-2fee-4774-a679-e4b375b580a3",
    "id": "e7407627-2fee-4774-a679-e4b375b580a3",
    "employmentId": 469375,
    "note": "Curso Opencode",
    "from": 1784732160,
    "to": 1784735340,
    "offline": false,
    "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e",
    "taskId": null
  }
]
```

### Crear actividad offline — `AddOfflineActivity`

El `id` debe generarlo el cliente (GUID). `from`/`to` en segundos.

```
POST https://scrin.io/api/v2/AddOfflineActivity
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: {
  "id": "888a3caa-9228-feeb-5dd1-b11aa69c0fd5",
  "employmentId": 469375,
  "from": 1784732160,
  "to": 1784735340,
  "note": "Actividad manual",
  "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e"
}
```

### Dividir / corregir actividad — `SplitActivityExact`

```
POST https://scrin.io/api/v2/SplitActivityExact
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: {
  "id": "7579836c-733f-47b9-926b-eda96389d148",
  "items": [
    { "id": "65544b1d-eed9-43d3-7b20-02f903846628", "from": 1784732160, "to": 1784733000, "note": "Parte 1", "projectId": "c88f409a-21b0-5af0-3bc3-3839692e177e" },
    { "from": 1784733000, "to": 1784735340 }
  ]
}
```

---

### 10.5 Configuración — `SetConfigValue`

`key` admite: `autoPauseMinutes`, `screenshotsPerHour`, `screenshotsPerHourMax`,
`disableOfflineTime`, `disableScreenshotNotification`, `weeklyLimit`, `weekStartDay`, `currency`.

```
POST https://scrin.io/api/v2/SetConfigValue
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: { "companyId": 275281, "key": "currency", "value": "USD" }
```

---

### 10.6 Capturas de pantalla — `GetScreenshots`

Body = array de `activityId`.

```
POST https://scrin.io/api/v2/GetScreenshots
X-SSM-Token: <SCRIN_TOKEN>
content-type: application/json
body: ["754521d5-5365-42e3-98c1-20707075a769", "d6f8a2e9-3f8f-46d9-a2c0-d6966dbdd9b5"]
```

Respuesta: lista de capturas con `id`, `activityId`, `width`, `height`, `url`, `thumbUrl`,
`taken` (segundos), `activityLevel` y `applications[]`.

---

### 10.7 Alternativa v1 — `report` (la de Postman)

```
GET https://scrin.io/api/v1/report?token=<SCRIN_TOKEN>&from=2026-07-01&to=2026-07-16
```

---

## 11. Pendientes para llevar a producción

1. **Conseguir los tokens de las cuentas 2 y 3** (solo se tiene el de la cuenta 1).
2. Confirmar **clasificación por defecto** de los registros Scrin dentro de `sgh_activity`.
3. Definir si se importan las actividades `offline` o se marcan aparte.
4. No comitear el token real al repo (usar env var o cifrado).
