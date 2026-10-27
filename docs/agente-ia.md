# Agente de IA del sistema SIGESP (Horas + Cotizaciones)

## 0. Resumen

Asistente conversacional integrado al sistema SIGESP que responde preguntas en
lenguaje natural sobre **Gestión de Horas (SGH)** y **Cotizaciones**, usando
**tool-calling**: el modelo no accede a la base de datos; invoca *herramientas*
que reutilizan los servicios de negocio existentes.

- **Fase 1 (actual): solo lectura.** Consultas de proyectos, horas, actividades
  y cotizaciones. No crea, modifica ni elimina registros.
- **Proveedor LLM:** API compatible con OpenAI (por defecto OpenCode Zen).
- **Seguridad:** el chat requiere JWT y cada herramienta respeta el rol del
  usuario en `sgh_users`.
- **Alcance:** el agente se implementa **únicamente en el backend NestJS**
  (`backend/`). El backend Go **no** se extiende para el agente.
- **Pendiente:** streaming y acciones asistidas (ver §12).

---

## 1. Estado actual (componentes)

| Capa | Archivo | Descripción |
|------|---------|-------------|
| Cliente LLM | `backend/src/agente/llm.service.ts` | Chat completions + `tools`, timeout y manejo de errores |
| Bucle de tool-calling | `backend/src/agente/agente.service.ts` | System prompt, máx. pasos, recolecta herramientas usadas |
| Registro de herramientas | `backend/src/agente/agente.tools.ts` | Une las tools de cotizaciones y de horas |
| Tools de cotizaciones | `backend/src/agente/tools/cotizaciones.tools.ts` | 8 herramientas |
| Tools de horas (SGH) | `backend/src/agente/tools/horas.tools.ts` | 6 herramientas (Fase 1) |
| Tipos | `backend/src/agente/agente.tipos.ts` | `MensajeLlm`, `ContextoHerramienta`, `DefinicionHerramienta` |
| DTO | `backend/src/agente/dto/chat.dto.ts` | `messages` (máx. 30) y `contexto` |
| Controller | `backend/src/agente/agente.controller.ts` | `GET /agente/estado`, `POST /agente/chat` |
| Config | `backend/src/config/env.config.ts` | Bloque `agente` |
| UI | `frontend/src/app/agente/*` | Chat flotante montado en `layout.component.html` |

---

## 2. Arquitectura

```
Usuario (Angular, chat flotante)
        │  POST /api/v1/agente/chat { messages, contexto }
        ▼
AgenteController  ──(JWT global)──►  AgenteService
                                        │
                     bucle de tool-calling (máx. N pasos)
                                        │
                        ┌───────────────┴────────────────┐
                        ▼                                ▼
                  LlmService                       AgenteTools
            (OpenAI-compatible)          (registra y ejecuta herramientas)
                                                 │
                        ┌────────────────────────┼─────────────────────────┐
                        ▼                        ▼                         ▼
             CotizacionesService        ProyectosService          ActividadesService
                                                                    CatalogosService
```

**Principio rector:** el agente **nunca** ejecuta SQL propio ni toca repositorios;
siempre pasa por los servicios de negocio (reutilización, validaciones y permisos
existentes). Si necesitas una consulta nueva, se agrega un método al servicio.

---

## 3. Contrato de una herramienta

```ts
export interface DefinicionHerramienta {
  name: string;                 // verbo_sustantivo, en snake_case
  description: string;          // qué hace y cuándo usarla (clave para el modelo)
  parameters: Record<string, any>; // JSON Schema de argumentos
  sistema: string;              // módulo del árbol de permisos (ej. 'SGH', 'COT')
  pagina: string;               // página/componente requerido (ej. 'actividades')
  execute: (args: any, ctx: ContextoHerramienta) => Promise<any>;
}

export interface ContextoHerramienta {
  login: string;      // login del usuario autenticado (para permisos)
  idUsuario?: number; // id en sec_user (JWT sub)
}
```

- `parameters` se declara en formato **JSON Schema**.
- `execute` recibe `ctx` para aplicar control de acceso.
- El resultado se serializa a JSON y se devuelve al modelo; conviene mantenerlo
  **compacto** (pocas filas, campos relevantes) para no inflar el contexto.

---

## 4. Herramientas disponibles

### 4.1 Cotizaciones (8)

| Herramienta | Descripción |
|-------------|-------------|
| `listar_cotizaciones` | Listado con filtros (estado, texto, fechas, paginación) |
| `obtener_cotizacion` | Detalle completo por id |
| `resumen_cotizaciones` | KPIs: total, por estado, montos, tendencia, top clientes/región |
| `cotizaciones_vencidas` | Vencidas y por vencer según días de alerta |
| `buscar_clientes` | Clientes de cotización por nombre/RIF |
| `listar_regiones` | Regiones activas con precios |
| `listar_plantillas` | Plantillas de cotización |
| `listar_tasas_iva` | Tasas de IVA |

### 4.2 Horas / Proyectos (6) — Fase 1

| Herramienta | Descripción |
|-------------|-------------|
| `listar_proyectos_horas` | Proyectos con cliente, responsable, estado y horas |
| `detalle_proyecto_horas` | Horas plan vs ejecutadas por ítem/proceso (solo activas) + % avance |
| `listar_actividades_horas` | Actividades/horas con filtros y paginación |
| `obtener_actividad_horas` | Detalle completo de una actividad |
| `resumen_horas` | KPIs por usuario / proyecto / cliente en un rango |
| `buscar_clientes_horas` | Clientes del área de horas por nombre/RIF |

### 4.3 Mantis (3)

Requieren el permiso `SGH / mantis_reportes` (el mismo que la pantalla "Reportes Mantis"):

| Herramienta | Descripción |
|-------------|-------------|
| `filtros_mantis` | Catálogos de Mantis: proyectos, usuarios (informador/asignado) y estados, para mapear nombres → IDs |
| `consultar_issues_mantis` | Lista incidencias según filtros (proyecto, estado, informador, asignado, texto, fechas) |
| `resumen_issues_mantis` | Agregados por estado, proyecto, asignado y mes |

---

## 5. Control de acceso

### 5.1 Acceso a módulos (por perfil / permisos)

Cada herramienta declara el **módulo y página** del árbol de permisos que requiere
(`sistema`/`pagina`). El agente solo **expone** (y solo **ejecuta**) las herramientas
de los módulos a los que el usuario tiene acceso:

- Se resuelve con `PermisosService.verificarPermiso(login, sistema, pagina, 'acceso')`,
  que considera el acceso directo del usuario y el de su grupo.
- `adminUser = 1` (SEC) tiene acceso total.
- **Doble validación:** `AgenteTools.permitidas(login)` filtra las herramientas que ve
  el modelo, y `AgenteTools.ejecutar(...)` vuelve a verificar antes de ejecutar.

Mapa de herramientas → módulo:

| Herramienta | Módulo requerido |
|---|---|
| `listar_cotizaciones`, `obtener_cotizacion`, `cotizaciones_vencidas` | COT/cotizaciones |
| `resumen_cotizaciones` | COT/kpis |
| `buscar_clientes` | COT/clientes |
| `listar_regiones` | COT/regiones |
| `listar_plantillas` | COT/plantillas |
| `listar_tasas_iva` | COT/tasas-iva |
| `listar_proyectos_horas`, `detalle_proyecto_horas` | SGH/proyectos |
| `listar_actividades_horas`, `obtener_actividad_horas` | SGH/actividades |
| `resumen_horas` | SGH/reportes |
| `buscar_clientes_horas` | SGH/clientes |
| `filtros_mantis`, `consultar_issues_mantis`, `resumen_issues_mantis` | SGH/mantis_reportes |

Ejemplo real: `wilmerb` (admin) → 14 herramientas; `mariaroa` → 3
(`listar_actividades_horas`, `obtener_actividad_horas`, `resumen_horas`).

### 5.2 Alcance de filas (rol SGH)

Mismo criterio que el resto del SGH (`ActividadesService`, `reporteActividades`):

- **Administrador:** `sgh_users.rol = 'A'` o `'S'` → ve la información de todos.
- **No administrador:** solo sus propios registros (`sgh_activity.id_user`).
- **Login sin perfil SGH:** no ve datos de otros (condición `1 = 0`).

Apoyo implementado:
- `CatalogosService.rolIdPorLogin(login)` → `{ idUser, rol }`.
- `ActividadesService.resumenHoras(..., login)` → agrega horas aplicando el rol.

La identidad llega desde el **JWT** (`req.user.login`), no desde el cuerpo de la
petición, por lo que el usuario no puede suplantar a otro.

---

## 6. Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `AGENTE_ENABLED` | `true` | Activa/desactiva el agente |
| `AGENTE_API_KEY` | *(vacío)* | Clave del proveedor LLM |
| `AGENTE_BASE_URL` | `https://opencode.ai/zen/v1` | Endpoint compatible con OpenAI |
| `AGENTE_MODEL` | `space-bunny-free` | Modelo a usar |
| `AGENTE_TEMPERATURE` | `0.2` | Creatividad (baja = más determinista) |
| `AGENTE_MAX_STEPS` | `5` | Máximo de iteraciones de tool-calling |
| `AGENTE_TIMEOUT_MS` | `60000` | Timeout por llamada al LLM |

> Si `AGENTE_API_KEY` está vacío, `GET /agente/estado` devuelve
> `{ configurado: false }` y el chat muestra *"El asistente no está configurado"*.

---

## 7. Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/agente/estado` | `{ configurado: boolean }` |
| `POST` | `/api/v1/agente/chat` | Conversa; body `{ messages, contexto? }` |

- Protegidos por el **JWT global** (`APP_GUARD` → `JwtAuthGuard`).
- `POST /chat` con `@Throttle` de 20 req/min.
- `messages`: máx. 30; `content`: máx. 8000 caracteres.
- Respuesta: `{ respuesta, pasos, herramientasUsadas }`.

---

## 8. Frontend

- Componente `AgenteChatComponent` (chat flotante) declarado en `app.module.ts`
  y montado en `layout.component.html` (`<app-agente-chat>`).
- Servicio `AgenteService` (`frontend/src/app/agente/agente.service.ts`).
- Envía el historial completo en cada turno (el backend es **stateless**).
- Soporta `contexto` (texto libre) para describir la pantalla actual; aún no se
  envía automáticamente (ver §12).

---

## 9. Fase 1 — cambios realizados

1. `backend/src/sgh/catalogos.service.ts` → nuevo `rolIdPorLogin(login)`.
2. `backend/src/sgh/actividades.service.ts` → nuevo `resumenHoras(...)` con filtro por rol.
3. `backend/src/agente/tools/horas.tools.ts` → **nuevo**, 6 herramientas.
4. `backend/src/agente/agente.tools.ts` → registra las tools de horas.
5. `backend/src/agente/agente.module.ts` → importa `SghModule`.
6. `backend/src/agente/agente.service.ts` → system prompt actualizado.
7. `frontend/src/app/agente/agente-chat.component.ts` → mensaje de bienvenida.

---

## 10. Verificación

- `npm run build` (backend y frontend): **OK**.
- Arranque de la aplicación (contexto NestJS): **DI OK**, 14 herramientas registradas.
- Pruebas de `resumen_horas` contra la base:
  - agrupación `usuario` → 8 filas; `proyecto` → 27; `cliente` → 22.
  - Usuario no administrador (`mariaroa`) → 1 fila: **MARIA ROA, 143.92 h** ✅

---

## 11. Restricciones conocidas

- **Codificación LATIN9 en la base:** los literales **SQL** no admiten caracteres
  UTF-8 (p. ej. el guion largo `—` rompe la consulta). Usar **solo ASCII** en SQL.
  También aplica a parámetros de búsqueda con acentos/no-ASCII.
- **Backend Go:** el agente **no** se replica en `backend-go`. La fuente de verdad
  del agente es **NestJS** (`backend/src/agente`).
- **Stateless:** no hay memoria ni persistencia de conversaciones.
- **Sin streaming:** la respuesta llega completa (no token a token).
- **Sin contexto automático:** el frontend aún no envía ruta/IDs de la pantalla.

---

## 12. Roadmap

### Fase 2 — Acciones asistidas y UX
- Streaming **SSE** de la respuesta.
- **Contexto de pantalla automático** (ruta, `idProyect`, `idActividad`).
- **Citas** de resultados y chips de preguntas sugeridas.
- Acciones de **escritura** con **confirmación explícita** + auditoría
  (crear/editar actividad, crear cotización).

### Fase 3 — Analítica y conocimiento
- Alertas proactivas (proyectos sin horas, cotizaciones por vencer).
- **RAG** (embeddings + `pgvector`) sobre plantillas, normativas y contratos.
- Persistencia de conversaciones por usuario.

---

## 13. Cómo agregar una nueva herramienta

1. Si necesitas una consulta nueva, **agrégala al servicio** de negocio
   (p. ej. `ActividadesService`), no en la tool.
2. Crea la definición en `backend/src/agente/tools/<area>.tools.ts`:
   ```ts
   {
     name: 'mi_herramienta',
     description: 'Qué hace y cuándo usarla.',
     parameters: {
       type: 'object',
       properties: { id: { type: 'integer', description: '...' } },
       required: ['id'],
     },
     execute: async (args, ctx) => {
       // Aplicar permisos con ctx.login si corresponde.
       return { /* resultado compacto */ };
     },
   }
   ```
3. Regístrala en `agente.tools.ts` (si es un área nueva, impórtala y agrégala al arreglo).
4. Si la tool necesita un servicio nuevo, asegúrate de que su módulo lo **exporte**
   e impórtalo en `agente.module.ts`.
5. Recompila (`npm run build`) y verifica el prompt si cambia el alcance.

---

## 14. Buenas prácticas de seguridad

- **Prompt injection:** los resultados de las herramientas son *datos*, nunca
  instrucciones. No ejecutar acciones sugeridas dentro de un resultado.
- **Mínimo privilegio:** cada tool valida permisos con `ctx.login`.
- **Nunca** poner la API key en el frontend; solo en el backend (`.env`).
- **Privacidad:** con un LLM en la nube los datos salen de la infraestructura.
  Evaluar proveedor sin retención/entrenamiento o auto-hospedado (Ollama) para
  información sensible.
- **Costos:** acotar resultados, limitar pasos, aplicar throttle y medir tokens.
- **Auditoría:** registrar herramientas usadas y argumentos (reutilizar el módulo
  `auditoria`).
