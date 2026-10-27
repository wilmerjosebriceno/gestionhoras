# Propuesta: Adjuntos (PDF / JPG) en el Registro de Actividad — Módulo SGH

Sistema **Gestión de Horas SIGESP** · Frontend Angular · Backend NestJS · PostgreSQL
Documento de diseño previo a implementación. Complementa `docs/registro-actividad.md`.

> **Estado: IMPLEMENTADO.** Ver artefactos en la sección 9.

---

## 1. Objetivo

Permitir que cada **Registro de Actividad** (`sgh_activity`) pueda llevar **documentos soporte**
(PDF, JPG/JPEG y PNG) cargados desde el formulario de Actividad/Horas, y almacenados en el
**sistema de carpetas del servidor** de forma ordenada por actividad, con su registro de
metadatos en base de datos para listar, descargar y eliminar.

Casos de uso: evidencias de visita, actas firmadas, capturas de incidencias, soportes de horas,
PDF de Mantis, etc.

---

## 2. Diagnóstico del estado actual

| Punto | Situación hoy |
|---|---|
| `sgh_activity` | No tiene campo de adjuntos. |
| `sgh_metadata` | Guarda **un solo** `file` (varchar 500) por actividad; sin mime/tamaño/hash/auditoría. Poco flexible para varios archivos. |
| `ActividadesService.create/update` | Solo persiste `dto.file` (string) vía `setFileInDatabase()`. No hay subida real de archivos. |
| Frontend `ActividadFormService` | Transporta `file` como string; **no hay input de archivo** ni subida multipart. |
| Patrón ya existente | El módulo **SOPORTE** ya resuelve exactamente esto para tickets: `FilesInterceptor` + `memoryStorage`, carpeta por documento, tabla `ticket_attachments` con hash y baja lógica. **Se reutiliza ese patrón.** |

> Decisión: **no reutilizar** `sgh_metadata` como contenedor de adjuntos (es 1:1 y sin metadatos).
> Se crea una tabla dedicada y se mantiene `sgh_metadata` por compatibilidad hacia atrás.

---

## 3. Estructura de carpetas propuesta

Raíz configurable por variable de entorno, con valor por defecto dentro del backend:

```env
SGH_ACTIVIDADES_STORAGE_ROOT=            # vacío => <backend>/storage/actividades
```

Organización **por año y por actividad**, usando el `numdoc` (código legible y estable,
autogenerado por año) como carpeta de la actividad:

```
<backend>/storage/actividades/
└── 2026/
    ├── 2026-00000001/
    │   ├── m1x8k2a17f3b.pdf
    │   ├── m1x8k2a29c1d.jpg
    │   └── m1x8k2b0e77a.png
    └── 2026-00000002/
        └── m1x8k3c4d90e.pdf
```

Reglas de nombrado:

- **Carpeta actividad** = `{yyyy}/{numdoc}` (año del `date_document` o del prefijo del numdoc).
  - Subcarpetas por año evitan directorios con miles de entradas.
  - El `numdoc` es legible para soporte/backup y no es editable por el usuario.
- **Nombre físico** = `Date.now().toString(36) + randomHex + extensión`.
  - Evita colisiones, caracteres inseguros y sobrescrituras.
  - El **nombre original** se conserva en base de datos (`filename`).
- **Alcance:** los adjuntos se asocian **solo a nivel de actividad** (`id_activity`), no a líneas
  de horas (`sgh_dt_activity`).

Alternativa considerada: carpeta por `id_activity` (`2026/12345/`). Se descarta como clave de
carpeta por ser menos legible; el `id_activity` igual queda registrado en BD.

---

## 4. Modelo de datos

Nueva tabla (esquema `public`, como el resto de `sgh_*`):

```sql
CREATE TABLE IF NOT EXISTS sgh_activity_attachment (
  id             SERIAL PRIMARY KEY,
  id_activity    INTEGER NOT NULL,
  filename       VARCHAR(255) NOT NULL,        -- nombre original
  stored_name    VARCHAR(500) NOT NULL,        -- ruta relativa dentro de la raíz
  carpeta        VARCHAR(255) NOT NULL,        -- {yyyy}/{numdoc}
  mimetype       VARCHAR(150) NOT NULL,
  size_bytes     BIGINT NOT NULL,
  hash_sha256    CHAR(64) NULL,
  uploaded_by    INTEGER NULL,                 -- sgh_users.id_user (opcional)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ NULL              -- baja lógica
);

CREATE INDEX IF NOT EXISTS idx_sgh_attach_activity
  ON sgh_activity_attachment (id_activity) WHERE deleted_at IS NULL;
```

Se implementa como **migración idempotente** siguiendo la convención numérica existente, p. ej.:

```
backend/src/migrations/1870000000000-sgh-activity-attachment.sql
```

Y auto-reparación de esquema al arrancar (patrón `ActividadesSchemaService`), opcional pero
coherente con el proyecto.

---

## 5. Backend — endpoints y servicios

Base: `/api/v1/sgh/actividades` (en `actividades.controller.ts`).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/:id/attachments` | Sube 1..N archivos (multipart, campo `archivos`). PDF/JPG/JPEG/PNG. |
| GET | `/:id/attachments` | Lista los adjuntos vigentes de la actividad. |
| GET | `/:id/attachments/:adjuntoId` | Descarga el archivo (con sesión). |
| DELETE | `/:id/attachments/:adjuntoId` | Baja lógica + borrado físico. |

- Permisología: `@RequierePermiso({ sistema: 'SGH', pagina: 'actividades', permiso: ... })`
  (insertar/actualizar/seleccionar) igual que el módulo SOPORTE.
- Interceptor (reutiliza el patrón de soporte):

```ts
@UseInterceptors(FilesInterceptor('archivos', 10, {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null,
    ['application/pdf','image/jpeg','image/png'].includes(file.mimetype)),
}))
```

- Validaciones en servicio: mime permitido, buffer no vacío, tamaño máximo, extensión saneada,
  pertenencia de la actividad, `hash_sha256`.
- Guardado: `fs.mkdir(dir, { recursive: true })` + `fs.writeFile` + `INSERT`.
- **Anulación de la actividad:** se eliminan **físicamente** los archivos de la carpeta y se
  marcan los registros con baja lógica (`deleted_at`), liberando espacio en disco.
- **Eliminación de la actividad:** se borran los adjuntos (lógicos + físicos) junto con la carpeta.

> Nota: `sgh_metadata.file` se **mantiene sin cambios** como campo legado; no forma parte del
> nuevo flujo de adjuntos ni se migra automáticamente.

Nuevos artefactos:

| Responsabilidad | Archivo |
|---|---|
| Entidad | `backend/src/sgh/entities/activity-attachment.entity.ts` |
| Servicio de adjuntos | `backend/src/sgh/activity-attachments.service.ts` |
| Endpoints | `backend/src/sgh/actividades.controller.ts` |
| Migración | `backend/src/migrations/1870000000000-sgh-activity-attachment.sql` |
| Registro en módulo | `backend/src/sgh/sgh.module.ts` |

---

## 6. Frontend — integración

- `ActividadFormService`: métodos `subirAdjuntos(id, files)`, `listarAdjuntos(id)`,
  `descargarAdjunto(id, adjuntoId)`, `eliminarAdjunto(id, adjuntoId)` usando `FormData`.
- `SghService`: los mismos endpoints con `HttpClient`.
- `actividad-form.component.html`: sección **"Documentos adjuntos"** dentro del formulario:
  - Aviso si es actividad nueva: **guardar primero** para habilitar la carga (el `id`/`numdoc`
    se generan en el backend).
  - `<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png">`, lista de archivos con nombre,
    tamaño y acciones *Ver/Descargar* y *Eliminar*.
- `actividades-list.component`: columna **"Adjunto"** con el conteo (📎 n) de documentos
  vigentes; el listado (`getCatalogo`) lo entrega como `adjuntosCount`.
- `actividad-form.component.ts`: componentes/estado para la lista de adjuntos y mensajes
  (`SwalService`).

---

## 7. Flujo de guardado (importante)

```
Nueva actividad:
  1. Usuario completa cabecera + detalle
  2. Guardar  ──►  POST /sgh/actividades  (backend genera id + numdoc)
  3. Con el id devuelto, se habilita "Documentos adjuntos"
  4. Subir archivos  ──►  POST /sgh/actividades/:id/attachments
     (se crea la carpeta {yyyy}/{numdoc}/ y se escriben los archivos)

Actividad existente:
  1. GET /:id  (incluye adjuntos)
  2. Subir/eliminar adjuntos en cualquier momento
```

> Por diseño, los adjuntos **siempre** se suben contra una actividad ya persistida, porque la
> carpeta depende del `numdoc` que genera el backend. Esto también evita archivos huérfanos.

---

## 8. Seguridad y validaciones

- Mimes permitidos: `application/pdf`, `image/jpeg`, `image/png`.
- Límite por archivo: **5 MB**; máximo **10 archivos** por carga.
- Nombre físico aleatorio; nunca se usa el nombre del usuario como ruta (evita path traversal).
- Descarga con nombre original vía `res.download(ruta, filename)` y control de sesión.
- Baja lógica (`deleted_at`) + borrado físico; hash SHA-256 para integridad/deduplicación futura.
- Auditoría: `uploaded_by`, `created_at`.

---

## 9. Plan de implementación por fases

| Fase | Entregable |
|---|---|
| 1 | Migración `sgh_activity_attachment` + entidad + auto-reparación de esquema. |
| 2 | `ActivityAttachmentsService` (guardar/listar/descargar/eliminar) + endpoints en `ActividadesController`. |
| 3 | `SghService`/`ActividadFormService` con métodos multipart y `FormData`. |
| 4 | UI: sección "Documentos adjuntos" en `actividad-form.component.html` + estilos. |
| 5 | Pruebas (PDF/JPG, límites, permisos, descarga, borrado) y actualización de `docs/registro-actividad.md`. |

---

## 10. Decisiones confirmadas

1. **Alcance del vínculo:** solo a nivel de **actividad** (`id_activity`). No se vincula a líneas
   de horas.
2. **Tipos permitidos:** PDF, JPG/JPEG y PNG.
3. **Límite:** 5 MB por archivo, máximo 10 archivos por carga.
4. **Retención al anular:** se **eliminan físicamente** los archivos y se marca baja lógica en BD.
5. **`sgh_metadata.file`:** se mantiene como campo **legado**, sin migrar.
