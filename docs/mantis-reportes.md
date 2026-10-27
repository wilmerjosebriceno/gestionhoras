# Reportes Inteligentes de Mantis (módulo de Horas / SGH)

Pantalla integrada en el módulo de Horas que consulta **MantisBT 2.28.0** vía su REST API
(solo lectura) y permite filtrar, visualizar en tabla, graficar en dashboard e
generar un análisis ejecutivo con IA.

## 1. Configuración (`.env` del backend)

```
MANTIS_BASE_URL=https://tu-servidor/mantis      # raíz de la instalación de Mantis
MANTIS_API_TOKEN=tu_api_token_de_mantis         # "Mi cuenta" -> "API Tokens"
MANTIS_TIMEOUT_MS=15000
```

El cliente construye la ruta REST como `MANTIS_BASE_URL + /api/rest`.

**Autenticación:** la REST API de Mantis 2.28 usa el encabezado
`Authorization: <API_TOKEN>` (el token generado en *Mi cuenta → Tokens API*, sin
prefijo `Bearer`). Se envió tal cual desde `MANTIS_API_TOKEN`.

## 2. Backend (NestJS) — `src/mantis/`

Nuevo `MantisModule`, independiente, que reutiliza `LlmService` (del `AgenteModule`)
para el análisis IA.

- `mantis-client.service.ts` — cliente REST (`fetch` + timeout). Métodos:
  `getProjects`, `getUsers(projectId?)`, `getStatuses` (desde `status_enum_string`),
  `searchIssues(filtros)` (paginado + filtrado local por estado/informador/asignado/fechas).
- `mantis.service.ts` — lógica de negocio:
  - `filtros()` → catálogos precargados (proyectos, usuarios, estados).
  - `consultar(dto)` → issues normalizados.
  - `resumen(dto)` → agregados para el dashboard.
  - `analizar(dto)` → prompt a `LlmService` con el conjunto filtrado.
- `dto/mantis.dto.ts` — `MantisConsultaDto` (validado por el `ValidationPipe` global).
- `mantis.controller.ts` — endpoints bajo `/api/v1/sgh/mantis`, protegidos por
  `@RequierePermiso({ sistema:'SGH', pagina:'mantis_reportes', permiso:'seleccionar' })`.

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/sgh/mantis/filtros` | Proyectos, usuarios y estados para los selects |
| POST | `/sgh/mantis/consultar` | Tabla de incidencias según filtros |
| POST | `/sgh/mantis/resumen` | Datos agregados para el dashboard |
| POST | `/sgh/mantis/analizar` | Análisis ejecutivo generado con IA |

## 3. Permisos

- Nodo agregado en `backend/permisos/xml/sec_arbol_sgh.xml`:
  `<item nombre="Reportes Mantis" pagina="mantis_reportes"/>` (menú *Procesos*).
- Asignar el permiso `mantis_reportes` (acción `seleccionar`) a los grupos que deban
  acceder. Un usuario `adminUser = 1` lo tiene implícito.
- No toca `backend-go`/`frontend-go` (mantenerlos intactos por decisión del proyecto).

## 4. Frontend (Angular) — `src/app/sgh/mantis-reportes/`

- `mantis.service.ts` — llamadas HTTP al backend.
- `mantis-reportes.component.ts` / `.html` — pantalla con:
  - **Filtros precargados** desde Mantis al entrar (proyecto, informador, asignado, estatus, texto, rango de fechas).
  - **Tabla** de incidencias (ID, resumen, proyecto, informador, asignado, estado, prioridad, fecha).
  - **Dashboard** con Highcharts: pastel por estado, barras Top proyectos, columnas Top asignados, línea de tendencia por mes.
  - **Análisis IA**: botón que envía el filtro al backend y muestra el análisis en lenguaje natural.
  - **Exportar CSV**.
- Ruta `/sgh/mantis-reportes` → `permisos.map.ts` (`SGH/mantis_reportes`).
- Ítem de menú en `core/config/menu.config.ts`.

## 5. Notas de diseño

- **Solo lectura**: no se crea ni modifica nada en Mantis; el token es de servicio.
- **Filtrado robusto**: se envía `project_id` + `search` al servidor y el resto
  (estado, informador, asignado, fechas) se aplica localmente para no depender de
  variaciones en los nombres de parámetros de la API REST entre instalaciones.
- **Límite**: se recuperan hasta 1000 issues (paginando) para el reporte.
- **IA**: usa el mismo `LlmService`/modelo configurado (`AGENTE_*`); si no está
  configurado, el backend devuelve un mensaje claro en lugar de fallar.

## 6. Próximos pasos sugeridos
- Asignar el permiso `mantis_reportes` a los grupos correspondientes.
- (Opcional) Cruce con horas SGH usando el campo `detalle_actividad.mantis`.

## 7. Agente IA (ya disponible)

El asistente de IA del sistema puede consultar Mantis por lenguaje natural. Se agregaron 3
herramientas bajo el permiso `SGH/mantis_reportes`:

- `filtros_mantis` — catálogos (proyectos, usuarios, estados) para mapear nombres a IDs.
- `consultar_issues_mantis` — lista incidencias con filtros.
- `resumen_issues_mantis` — agregados por estado/proyecto/asignado/mes.

El agente solo expone estas herramientas al perfil que tenga el permiso `mantis_reportes`
(mismo criterio de la pantalla). Ver `docs/agente-ia.md` §4.3.
