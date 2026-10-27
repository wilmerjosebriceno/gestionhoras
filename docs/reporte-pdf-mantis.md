# Reporte PDF de Casos Mantis (módulo SOPORTE)

## 1. Requerimiento

En **SOPORTE → Dashboard Mantis**, agregar una opción para **imprimir un reporte
PDF elegante**, parametrizado por **proyecto** y **rango de fechas (desde–hasta)**,
que muestre:

- Por cada caso: **#Mantis, fecha y hora del caso, Proyecto, Asunto, Estatus y Prioridad**.
- Debajo de cada caso, en filas **más reducidas**, la información de los
  **comentarios asociados** (autor/“responsable”, **fecha y hora**, y texto del comentario).

---

## 2. Estado actual (lo que ya existe)

| Pieza | Situación |
|---|---|
| Espejo local | `sigespweb.mantis_issue` guarda **solo la cabecera** (id, summary, proyecto, estatus, prioridad, severidad, responsable, informador, fechas, reaperturas). **No guarda comentarios.** |
| Comentarios/notas | Se leen **en vivo** desde Mantis con `GET /issues/:id` → `issue.notes` (id, reporter, created_at, text). Ya usado por `seguimientoCaso()`. |
| Filtros del dashboard | `desde`, `hasta`, `projectId`, `handlerId`, `reporterId`, `statusId`, `reopened`. |
| Generación de PDF | Ya se usa **pdfmake** en `PdfReportsService` (SGH) y `pdf-cotizacion.service.ts` (COT). |
| Export actual | CSV de `casos` y `resumen` (`/soporte/mantis/export`). |
| Permisos | `SOP / mantis` con acciones `seleccionar` y `actualizar`. |

---

## 3. Alcance propuesto

1. **Backend:** nuevo `MantisReporteService` + endpoint `GET /soporte/mantis/reporte/pdf`.
2. **Frontend:** botón **🖨 PDF** en la barra de exportación del dashboard (+ método en `SoporteService`).
3. **Datos de comentarios:** en vivo (Fase 1) y opción de espejo de notas (Fase 2) para volumen alto.
4. **PDF elegante** con encabezado de marca, KPIs y detalle caso→comentarios.

---

## 4. Presentación del reporte (diseño visual)

### 4.1 Estructura en 3 bloques

1. **Encabezado** (marca SIGESP + título + parámetros del reporte).
2. **Resumen** (chips/KPIs: total, abiertos, cerrados, sin asignar, por prioridad).
3. **Detalle por caso** → fila del caso + filas de comentarios indentadas.

### 4.2 Maqueta (esquema)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  SIGESP, C.A.                                       [LOGO]                     │
│  REPORTE DE CASOS · MESA DE AYUDA (MANTIS)                                     │
│  Proyecto: TELECOM   ·   Período: 01/09/2026 – 30/09/2026                      │
│  Generado: 08/10/2026 10:30   ·   Responsable: (Todos)                         │
├───────────────────────────────────────────────────────────────────────────────┤
│  Total 42  ·  Abiertos 18  ·  Cerrados 24  ·  Sin asignar 5                    │
│  Prioridad: Alta 9 · Media 21 · Baja 12                                        │
├───────┬──────────────┬──────────┬────────────────────────┬──────────┬─────────┤
│#Mantis│ Fecha/Hora   │ Proyecto │ Asunto                 │ Estatus  │ Priorid.│
├───────┼──────────────┼──────────┼────────────────────────┼──────────┼─────────┤
│ 12345 │ 12/09 14:05  │ TELECOM  │ Error al generar rep.  │ assigned │ high    │
│       │ ↳ 12/09 14:30 · J. Pérez · "Se revisó el log…"                        │
│       │ ↳ 13/09 09:12 · M. López · "Aplicado parche en…"                      │
├───────┼──────────────┼──────────┼────────────────────────┼──────────┼─────────┤
│ 12360 │ 15/09 09:40  │ TELECOM  │ Solicitud de usuario    │ new      │ normal  │
│       │ ↳ 15/09 10:05 · M. Roa · "Pendiente validación…"                      │
└───────┴──────────────┴──────────┴────────────────────────┴──────────┴─────────┘
 Página 1 de N                                        SIGESP · Generado por el sistema
```

> El detalle de comentarios va **en letra más pequeña y gris**, indentado, con
> **fecha/hora + autor + texto**. Se puede activar/desactivar con un parámetro.

### 4.3 Estilo
- **Marca:** azul SIGESP `#0F2F5F`, acento `#2E6FBF`, gris `#F1F5F9`.
- Encabezado de tabla fijo por página (`repeatHeaderRows`).
- Casos alternan fondo muy claro para separar bloques.
- Estatus/prioridad con “pill” de color (verde/ámbar/rojo).
- Pie con `Página X de Y` y fecha de generación.

---

## 5. Origen de los comentarios (decisión técnica)

### Opción A — En vivo (recomendada Fase 1)
- Se leen las **cabeceras desde el espejo** (rápido) y las **notas en vivo** por caso.
- Concurrencia limitada (p. ej. 8 en paralelo) y **tope** (p. ej. 250 casos) con aviso.
- Ventaja: comentarios siempre frescos; **sin cambios de esquema**.
- Desventaja: depende de Mantis y tarda más si hay muchos casos.

### Opción B — Espejo de notas (Fase 2, optimización)
- Nueva tabla `sigespweb.mantis_issue_note` (id, issue_id, autor, created_at, text, is_private),
  poblada en la sincronización (si el listado de Mantis ya trae `notes`; si no, con
  `getIssue` en lote con concurrencia).
- Ventaja: reporte instantáneo y desacoplado de Mantis.

---

## 6. Backend (propuesta)

### 6.1 Nuevo servicio `backend/src/soporte/mantis-reporte.service.ts`
```
generarPdf(filtros): Promise<Buffer>
  1) casos = mantisDashboard.listarCasos({...filtros, limit: tope})   // espejo
  2) si incluirNotas: por cada caso, getIssue(id) -> notes (concurrencia)
  3) ensamblar docDefinition (pdfmake)
  4) pdfDoc.pipe(...) -> Buffer
```
- Reutiliza `MantisDashboardService` (espejo) y `MantisClientService` (notas).
- Fechas formateadas `dd/mm/aaaa HH:MM`.
- `pdfmake`: `pageMargins`, `header`, `footer` con `(currentPage, pageCount)`,
  `content` = bloque encabezado + tabla de KPIs + tabla de casos con `colSpan`
  para las filas de comentarios.

### 6.2 Endpoint
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/soporte/mantis/reporte/pdf` | PDF de casos + comentarios según filtros |

Query: `desde, hasta, projectId, handlerId, reporterId, statusId, reopened, incluirNotas (0/1), incluirCerrados (0/1)`.
Permiso: `SOP/mantis` → `seleccionar`.
Respuesta: `application/pdf`, `Content-Disposition: inline; filename="mantis-<proyecto>_<desde>_<hasta>.pdf"`.

### 6.3 Logo
`SghModule` no exporta `LogosService` (y `SghModule` importa `SoporteModule`, no se
puede invertir sin ciclo). Opciones: (a) encabezado con marca en colores, sin imagen;
(b) leer el archivo de logo desde `backend/storage/logos/` o una ruta en `.env`
(`SOPORTE_LOGO_PATH`) y embeberlo en base64.

---

## 7. Frontend (propuesta)

- `soporte.service.ts`: `reportePdfMantis(filtros): Observable<Blob>`.
- `mantis-dashboard.component.ts`: `exportarPdf()` → usa los filtros actuales y abre el
  PDF con `abrirPdf(blob, nombre)`.
- `mantis-dashboard.component.html`: nuevo botón **🖨 PDF** junto a `📥 Casos` / `📊 Resumen`.
- (Opcional) mini-modal con casillas: **incluir comentarios** y **incluir cerrados**.

---

## 8. Parámetros y decisiones

1. ¿Incluir **todos** los casos o solo **abiertos**? (parámetro `incluirCerrados`).
2. ¿Incluir **texto** de los comentarios o solo **autor + fecha/hora**? (`incluirNotas`, y un modo “compacto”).
3. ¿Tope de casos por PDF? (sugerido 250 con aviso).
4. ¿Logo en imagen o encabezado tipográfico?

---

## 9. Criterios de aceptación

- [ ] Botón **PDF** en el dashboard con los filtros de proyecto y rango vigentes.
- [ ] El PDF muestra, por caso: **#Mantis, fecha/hora, proyecto, asunto, estatus, prioridad, responsable**.
- [ ] Debajo de cada caso, filas reducidas con **comentarios: autor, fecha/hora y texto**.
- [ ] Encabezado/pie elegantes, paginación y KPIs en el resumen.
- [ ] Respeta los permisos `SOP/mantis`.
- [ ] Si Mantis no responde para un caso, se indica “(sin comentarios)” sin romper el reporte.

---

## 10. Fases sugeridas

1. **Fase 1:** endpoint + botón + PDF con comentarios en vivo (Opción A).
2. **Fase 2 (opcional):** espejo de notas + caché para reportes masivos.
3. **Fase 3 (opcional):** envío por correo del mismo PDF y firma/pie corporativo.

---

## 11. Estado de implementación (Fase 1) — listo

Decisiones aplicadas: **comentarios con texto**, **todos los casos** (abiertos y cerrados),
**encabezado tipográfico** (sin imagen).

**Backend**
- `backend/src/soporte/mantis-reporte.service.ts` (nuevo): `generarPdf()` con pdfmake;
  cabeceras desde el espejo + notas en vivo (concurrencia 8, tope `MANTIS_REPORTE_MAX` = 300).
- `soporte.controller.ts`: `GET /soporte/mantis/reporte/pdf` (permiso `SOP/mantis`).
- `soporte.module.ts`: `MantisReporteService` registrado.

**Frontend**
- `soporte.service.ts`: `reportePdfMantis()`.
- `mantis-dashboard.component.ts`: `exportarPdf()`.
- `mantis-dashboard.component.html`: botón **🖨 PDF** junto a `📥 Casos` / `📊 Resumen`.

**Validación**
- Backend `tsc` + `npm run build`: ✅
- Frontend `tsc` + `ng build`: ✅

**Notas de uso**
- Los comentarios se leen **en vivo** de Mantis (el espejo no los guarda): el PDF puede
  tardar según el número de casos; con más de 300 se recorta y se avisa en el propio PDF.
- Fase 2 (espejo de notas) queda como optimización si se requieren reportes masivos.

