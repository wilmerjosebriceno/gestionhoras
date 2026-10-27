# Proceso: Registro de Actividad (Gestión de Horas — Módulo SGH)

Sistema **Gestión de Horas SIGESP** · Frontend Angular · Backend NestJS · PostgreSQL
El proceso se documenta a partir del código fuente implementado (`backend/src/sgh` y `frontend/src/app/sgh`), no solo de la intención de negocio.

---

## 1. Objetivo del proceso

El **Registro de Actividad** es el núcleo operativo de la gestión de horas: permite a un **consultor** dejar constancia de las **horas trabajadas** en una fecha determinada, desglosadas por **módulo/proceso** e **ítem de actividad**, asociadas a un **cliente** y (opcionalmente) a un **proyecto**. Sirve de insumo para:

- El **dashboard** de horas (indicadores por proyecto).
- Los **reportes** de horas por consultor/proyecto/período (y su exportación PDF).
- El **cronograma** (avance por proceso, comparando horas plan vs. ejecutadas).
- El **recalculo de horas** proyectadas del proyecto (tabla `sgh_proyect_activity`).

La información capturada es la fuente de verdad de las horas; los reportes y el avance del proyecto **derivan** de estos registros.

---

## 2. Contexto arquitectónico

| Capa | Tecnología / ubicación |
|---|---|
| Frontend | Angular (lazy module `SghModule`), Tailwind CSS, SweetAlert2 (`SwalService`) |
| Backend | NestJS, `ActividadesController` + `ActividadesService`, TypeORM, JWT global |
| Base de datos | PostgreSQL (esquema `public`), tablas `sgh_*` |

El módulo se enruta en `/sgh`:

- `/sgh` → `sgh-dashboard`
- `/sgh/actividades` → lista (`ActividadesListComponent`)
- `/sgh/actividades/new` y `/sgh/actividades/:id` → formulario (`ActividadFormComponent`)

La permisología se resuelve por `(sistema='SGH', pagina='actividades')` vía `sec_acceso_user` y el guard de rutas `PermisoGuard`.

---

## 3. Modelo de datos (tablas involucradas)

| Tabla | Rol |
|---|---|
| `sgh_activity` | **Cabecera** de la actividad (numdoc, tipo, cliente, usuario, fecha/hora, responsable, nota, estado, visita, proyecto). |
| `sgh_dt_activity` | **Detalle / líneas de horas**: ítem de actividad, proceso, situación, horas, nota, mantis. PK → `id_activity`. |
| `sgh_id` | Control de **numeración** (prefijo = año) para `numdoc`. |
| `sgh_metadata` | Metadatos opcionales por actividad (campo `file`). Legado. |
| `sgh_activity_attachment` | Documentos adjuntos (PDF/JPG/PNG) por actividad; archivo físico en `storage/actividades/{yyyy}/{numdoc}/`. |
| `sgh_process` | Módulos/procesos (se usan como `id_process` en el detalle). |
| `sgh_type` | Tipos de actividad (referenciados por `id_type`). |
| `sgh_client` | Clientes (referenciados por `id_client`). |
| `sgh_users` | Perfil/los consultores; `rol = 'A'` = administrador. |
| `sgh_estructure_proyect` | Estructura del proyecto (proceso ↔ ítem). |
| `sgh_proyect_activity` | Horas plan/ejecución por estructura del proyecto (se recalcula). |
| `s_cron_proyecto` | Cronograma: `avance` por proceso (se recalcula). |

### Campos principales de `sgh_activity`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_activity` | serial PK | Identificador. |
| `numdoc` | varchar(20) | Código del documento, p. ej. `2026-00000001`. |
| `id_type` | int | Tipo de actividad (`sgh_type`). |
| `id_client` | int | Cliente (`sgh_client`). |
| `id_user` | int | Usuario del sistema de horas (`sgh_users`). |
| `responsible` | varchar(250) | Responsable (se guarda en MAYÚSCULAS). |
| `date_document` | date | Fecha del documento. |
| `hour_document` | time | Hora del documento (autogenerada al crear). |
| `note` | text | Nota de la cabecera. |
| `status` | smallint | `0` activa, `2` anulada. |
| `m_anulado` / `f_anulado` / `t_anulado` | | Motivo/fecha/hora de anulación. |
| `visit` | smallint | Flag "Visita" (0/1). |
| `id_proyect` | int | Proyecto asociado (0 = sin proyecto). |

### Campos de `sgh_dt_activity`

| Columna | Tipo | Descripción |
|---|---|---|
| `id_detail` | PK | Detalle. |
| `id_activity` | FK | Cabecera. |
| `id_item_activity` | int | Ítem de actividad. |
| `id_process` | int | Módulo/proceso. |
| `situation` | varchar | Situación. |
| `hours` | numeric | Horas trabajadas. |
| `note` | text | Nota del detalle. |
| `mantis` | varchar(20) | N.º de incidencia Mantis (opcional). |

---

## 4. Flujo completo del proceso

```
1. Inicio sesión  →  Módulo SGH  →  Menú “Actividades / Horas”
2. Listado de actividades (filtros + paginación)
3. Crear actividad  (o editar una existente)
   ├─ Seleccionar CLIENTE  (buscador)  →  carga sus PROYECTOS
   ├─ Cabecera: tipo, fecha, usuario, responsable, visita, nota
   ├─ Detalle: filas de horas
   │     Ítem de actividad  →  carga sus PROCESOS/MÓDULOS
   │     Por fila: proceso, situación, horas, nota, mantis
   └─ Validación → Guardar (el backend genera numdoc si hace falta)
4. Posguardado: recalcular horas del proyecto + avance del cronograma
5. (Opcional) Imprimir formato PDF
6. Gestión posterior: editar, anular (con motivo) o eliminar desde la lista
```

### 4.1 Numeración automática (`numdoc`)

El backend genera el `numdoc` si no viene explícito, en `ActividadesService.getNumeroID()`:

```
SELECT MAX(id) + 1 FROM sgh_id WHERE prefijo = <año actual>
Guardar esa fila en sgh_id
numdoc = "<año>-<id con 8 dígitos>"
```

- El **prefijo es el año** → numeración independiente por año.
- Se incrementa de forma **secuencial** (guarda la fila con el nuevo `id`).
- Formato final: `2026-00000001`. El frontend lo muestra **readonly**.

### 4.2 Recalculo tras guardar

- Si la actividad tiene `id_proyect` (≠ 0), se llama a `recalcularProyecto(idProyect)`:
  - Actualiza `sgh_proyect_activity.hour_e` sumando `hours` de cada detalle, agrupando por estructura del proyecto (proceso + ítem).
- `recalcularAvanceCronograma(idProyect)` actualiza `s_cron_proyecto.avance` = `horas_ejecutadas / horas_plan * 100` (para procesos con `avance_modelo = -1`).

---

## 5. Pantalla: Listado de Actividades

Acceso: **SGH → Procesos → Actividades / Horas** (`/sgh/actividades`).

- **Filtros**: número de documento, fecha inicial y fecha final (rango). Se aplican con el botón *Buscar*.
- **Paginación**: 50 registros por página, con controles de inicio/anterior/siguiente/fin.
- **Acciones por fila**: Editar, Imprimir (PDF), Anular (pide motivo), Eliminar (pide confirmación).
- **Indicador ADJUNTO**: columna con el número de documentos adjuntos vigentes (📎 n) que enlaza al formulario; `—` cuando no hay. El conteo lo entrega `getCatalogo` (`adjuntosCount`).
- **Visibilidad por rol**: solo el perfil `rol = 'A'` (o `'S'`) del usuario en `sgh_users` ve **todas**; cualquier otro perfil solo ve **sus propias** actividades (filtro `doc.id_user = <su id>`).

---

## 6. Pantalla: Formulario de Actividad / Horas

Acceso: `Nueva Actividad / Horas` o entrando a una existente (`/sgh/actividades/:id`).

### 6.1 Selección de Cliente

Componente `app-cliente-picker` (buscador). Al elegir cliente se habilita el select de **Proyecto** con los proyectos de ese cliente (`proyectosDelCliente`). El cliente es **obligatorio**.

### 6.2 Cabecera — "Datos de la Actividad"

| Campo | Tipo | Regla |
|---|---|---|
| Nro. Documento | readonly | Autogenerado por el backend (no editado por el usuario). |
| Tipo | select (`sgh_type`) | Opcional. |
| Fecha Documento | date | **Obligatorio**. |
| Usuario | readonly | El usuario SGH actual (por defecto). |
| Proyecto | select | Opcional (se llena tras elegir cliente). |
| Responsable | text | **Obligatorio** (máx. 250). |
| Visita | toggle | Flag 0/1. |
| Nota | textarea | Opcional. |

### 6.3 Detalle de Horas

Componente `app-detalle-horas` → grilla dinámica de filas. Cada fila:

| Columna | Regla |
|---|---|
| Ítem de actividad | **Obligatorio**. Al seleccionarlo se cargan sus procesos. |
| Módulo/Proceso | **Obligatorio** (≥ 1) — se obtiene de `procesosDelItem(idItem)`. |
| Situación | **Obligatorio** (se edita en ventana amplia; valor `"0"` cuenta como vacío). |
| Horas | **Obligatoria y > 0**. |
| Nota | **Obligatoria** (igual que situación; `"0"` = vacío). |
| Mantis | Opcional (máx. 20). |

- Se pueden agregar varias filas (botón *Agregar*) o quitar (*Quitar*).
- Al cambiar el Ítem se **resetea** el Proceso y se recargan sus opciones.

### 6.4 Validaciones

Se ejecutan **cliente** (puras, en `actividad.validators.ts`) antes de enviar al backend:

- Cabecera: cliente, responsable y fecha del documento obligatorios.
- Detalle: mínimo 1 fila; por fila: proceso, ítem, horas > 0, situación y nota obligatorias.
- Errores se muestran en un bloque ámbar bajo la grilla y vía SweetAlert.

---

## 7. Endpoints del backend (`/api/v1/sgh/actividades`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listado paginado con filtros `numdoc`, `fecini`, `fecfin`, `page`, `pageSize`. Aplica filtro por rol del usuario autenticado. |
| GET | `/:id` | Detalle completo (cabecera + client/tipo/usuario + `detalles` + `metadata`). |
| POST | `/` | Crea la actividad (numdoc autogenerado, hora actual, `status=0`). |
| PUT | `/:id` | Actualiza cabecera y detalle (inserta/actualiza líneas por `idDetail`). |
| POST | `/:id/anular` | Marca `status=2` con motivo (`m_anulado`), fecha (`f_anulado`) y hora (`t_anulado`). |
| DELETE | `/:id` | Elimina detalle, metadatos y cabecera; recalcula el proyecto. |
| GET | `/reporte` | Reporte plano de actividades con filtros (`fecini`, `fecfin`, `idType`, `idProcess`, `idUser`, `idClient`). Aplica control por rol. |
| GET | `/reporte/pdf` | Igual que `/reporte` pero devuelve el **PDF**. |
| GET | `/:id/pdf` | PDF del formato de una actividad. |
| POST | `/:id/recalcular` | Recalcula `sgh_proyect_activity` del proyecto. |
| GET | `/:id/attachments` | Lista los documentos adjuntos vigentes de la actividad. |
| POST | `/:id/attachments` | Sube 1..N archivos (multipart, campo `archivos`): PDF/JPG/PNG, 5 MB c/u, máx. 10. |
| GET | `/:id/attachments/:adjuntoId` | Descarga un adjunto con sesión. |
| DELETE | `/:id/attachments/:adjuntoId` | Baja lógica + borrado físico del adjunto. |

> Al **anular** una actividad se eliminan físicamente sus archivos adjuntos (baja lógica en BD);
> al **eliminar** la actividad se borran también sus registros y la carpeta.

### Control de acceso por rol (reportes y listado)

En `ActividadesService.reporteActividades(params, login)`:

- Usuario con `sgh_users.rol = 'A'` (Administrador) → ve los reportes de **todos**. Si envía `idUser`, lo usa como filtro opcional.
- Cualquier otro perfil → se **fuerza** `users.id_user = <su id>` aunque el frontend envíe otro. Si el login no existe en `sgh_users`, la condición se vuelve imposible (`1 = 0`) → no ve datos.

> En el listado (`getCatalogo`) la regla es similar: `rol` `'A'` o `'S'` ven todo; el resto solo lo suyo.

---

## 8. PDF del formato (funcionalidad)

- `PdfReportsService.actividad(actividad)` genera el formato en PDF.
- El frontend usa `abrirPdf(blob, filename)` para abrirlo en una pestaña nueva.
- Tras guardar, el sistema ofrece **imprimir el formato** (pregunta con SweetAlert).
- En la edición existe el botón "Imprimir formato".

---

## 9. Detalle de implementación en código

| Responsabilidad | Archivo |
|---|---|
| Flujo del formulario (coordinación cabecera + detalle) | `frontend/src/app/sgh/actividades/actividad-form.component.ts` |
| Lógica de carga/guardado/catálogo del formulario | `frontend/src/app/sgh/actividades/actividad-form.service.ts` |
| Grilla de detalle de horas | `frontend/src/app/sgh/actividades/detalle-horas/` |
| Buscador de clientes | `frontend/src/app/sgh/actividades/cliente-picker/` |
| Validaciones puras de negocio | `frontend/src/app/sgh/actividades/actividad.validators.ts` |
| Listado + paginación + anular/eliminar/imprimir | `frontend/src/app/sgh/actividades/actividades-list.component.ts` |
| API de actividades | `backend/src/sgh/actividades.service.ts` y `actividades.controller.ts` |
| DTOs (create/update/anular) | `backend/src/sgh/dto/actividad.dto.ts` |
| Entidades | `backend/src/sgh/entities/actividad.entity.ts`, `detalle-actividad.entity.ts`, etc. |
| Reporte PDF | `backend/src/sgh/pdf-reports.service.ts` |

---

## 10. Reglas de negocio resumidas

1. El **documento** (numdoc) se autogenera por año y **no es editable**.
2. La **cantidad se registra en horas** (> 0 por fila).
3. Cliente y responsable y fecha son obligatorios; el detalle requiere al menos 1 fila.
4. **Situación** y **nota** no pueden ser vacías ni igual a `"0"`.
5. Seleccionar el **ítem** carga el **proceso**; ambos son requeridos en cada fila.
6. `status = 0` (activa) al crear; al anular pasa a `2` guardando motivo/fecha/hora.
7. Las horas registradas **recalculan** el proyecto (`sgh_proyect_activity`) y el **avance** del cronograma.
8. Solo roles `'A'`/`'S'` (`sgh_users`) ven datos de todos; el resto solo lo propio.

---

## 11. Notas y recomendaciones

- Al **editar** (PUT) el detalle: las filas con `idDetail` existente se actualizan; las filas nuevas sin `idDetail` se insertan.
- Al **eliminar** se borran en cascada el detalle y los metadatos antes de quitar la cabecera, y se recalcula el proyecto.
- La anulación **no elimina** datos: conserva el registro marcado en `status=2` con motivo, lo que permite auditoría.
- El proyecto se asocia desde la cabecera; si no se selecciona, la actividad sigue existiendo pero no recalcula horas de proyecto.
- La **moneda/total** no aplica en este módulo: las horas son la métrica; los montos corresponden al módulo COT (cotizaciones), que reutiliza los procesos para valorar horas.
- No hay totalizador monetario en la actividad: la valorización por horas se aprovecha en el módulo de **Cotizaciones** (precio por hora según región/modalidad).
