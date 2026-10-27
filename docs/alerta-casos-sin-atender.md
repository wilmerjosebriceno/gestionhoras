# Propuesta: Alerta de casos sin atender (> 24 h laborables) — Módulo Soporte

Sistema **SIGESP** · Frontend Angular · Backend NestJS · PostgreSQL (`sigespweb`)
Documento de análisis y diseño. **Estado: IMPLEMENTADO** (decisiones confirmadas en la sección 11).

---

## 1. Objetivo

Detectar los **casos (tickets) que no han sido atendidos dentro de las 24 horas
siguientes a su registro**, contando **solo días laborables (lunes a viernes)**,
para:

1. **Mostrarlos en pantalla** en el módulo de Soporte (bandeja de tickets).
2. **Enviarlos por correo** a `calidad@sigesp.com.ve` (configurable).

---

## 2. Análisis del estado actual

| Elemento existente | Ubicación | Uso para la alerta |
|---|---|---|
| Tabla `sigespweb.tickets` | `ticket.entity.ts` | `created_at`, `state`, `first_response_at`, `assignee_id`, `priority`, `number`, `title`, `requester_name`. |
| Estados | `soporte.constants.ts` | `nuevo, asignado, en_progreso, en_espera, resuelto, cerrado, cancelado`. |
| "Primera respuesta" | `tickets.first_response_at` (se setea al primer mensaje **no interno**) | **Base de la definición de "atendido".** |
| SLA | `ticket_sla_policies` + `response_due_at`, `sla_response_breached` | Ya existe, pero en **minutos calendario**, no días laborables. |
| Correo | `SoporteMailService.enviar()` (nodemailer, SMTP `MAIL_*`) | Reutilizable tal cual. |
| Tareas periódicas | `MantisSyncService` con `setInterval` + `OnApplicationBootstrap` | **Patrón existente** (no hay `@nestjs/schedule` instalado). |
| Bandeja / KPIs | `tickets-bandeja` (frontend) y `SoporteService.estadisticas()` | Punto donde se mostrará la alerta. |

**Conclusión:** ya existe la materia prima (fecha de registro, primera respuesta,
estados, correo y un patrón de job periódico). No hace falta infraestructura nueva;
solo una lógica de **calendario laborable**, una **tabla de control** y la UI.

---

## 3. Definición de "no atendido"

Regla implementada:

> Un ticket está **sin atender** si:
> - `first_response_at IS NULL` (nunca se respondió), **y**
> - `state` = `nuevo` (es decir, no pasó a `asignado`/`en_progreso`), **y**
> - ya transcurrieron **24 horas laborables** desde `created_at`.

**Atendido** = `first_response_at` seteado **o** estado `asignado`/`en_progreso`
(cualquiera de los dos). Se incluyen **todos** los casos (con o sin responsable).

---

## 4. Cálculo de las 24 horas laborables

Se crea una utilidad **`BusinessCalendar`** (backend) que:

- Cuenta solo **lunes a viernes** (configurable: `1,2,3,4,5`).
- Trabaja en **zona horaria `America/Caracas`**.
- Calcula `addWorkingHours(fecha, 24)` → **fecha límite**:

```
addWorkingHours(created_at, 24):
  d = created_at
  while (24 h pendientes):
    d = d + 1 día
    si d es fin de semana -> continuar (no consume)
    si no -> consumir 24 h
  return d
```

Ejemplos:

| Registro | Fecha límite (24 h laborables) |
|---|---|
| Lunes 10:00 | Martes 10:00 |
| Jueves 16:00 | Viernes 16:00 |
| **Viernes 17:00** | **Lunes 17:00** (se omiten sáb/dom) |
| Sábado 09:00 | Martes 00:00 |
| Domingo 20:00 | Martes 00:00 |

> **Fase 2 (opcional):** jornada parcial (p. ej. 8:00–17:00) y **feriados** en una
> tabla `sigespweb.feriados`. En la fase 1 se consideran días completos L-V.

---

## 5. Modelo de datos (nuevo)

Tabla de control para **no repetir correos** y auditar:

```sql
CREATE TABLE IF NOT EXISTS sigespweb.ticket_alertas (
  id                SERIAL PRIMARY KEY,
  ticket_id         INTEGER NOT NULL REFERENCES sigespweb.tickets(id) ON DELETE CASCADE,
  tipo              VARCHAR(30) NOT NULL DEFAULT 'sin_atender_24h',
  detectado_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_limite      TIMESTAMPTZ,
  horas_transcurridas NUMERIC(10,2),
  correo_enviado_at TIMESTAMPTZ,
  destinatarios     TEXT,
  UNIQUE (ticket_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_ticket_alertas_tipo ON sigespweb.ticket_alertas (tipo, correo_enviado_at);
```

La `UNIQUE (ticket_id, tipo)` garantiza **idempotencia** (un correo por caso y tipo,
salvo política de reenvío diario que se configure).

---

## 6. Backend — componentes

| Componente | Archivo propuesto | Responsabilidad |
|---|---|---|
| Utilidad de calendario | `backend/src/soporte/business-calendar.ts` | `addWorkingHours`, `workingHoursBetween`, `esLaborable`. |
| Servicio de alertas | `backend/src/soporte/alertas.service.ts` | Detectar casos, registrar, enviar correo. |
| Scheduler | (dentro de `AlertasService`, `setInterval` + `OnApplicationBootstrap`) | Revisa periódicamente en días laborables. |
| Endpoints | `soporte.controller.ts` | Listado para pantalla, resumen y envío manual. |
| Config | `env.config.ts` / `.env` | Parámetros de la alerta. |
| Migración | `backend/src/migrations/<ts>-soporte-alertas.sql` | Crea `ticket_alertas`. |

### 6.1 Consulta base

```sql
SELECT t.id, t.number, t.title, t.priority, t.state,
       t.requester_name, t.assignee_id, t.created_at,
       u.username AS responsable
  FROM sigespweb.tickets t
  LEFT JOIN sigespweb.usuarios u ON u.id = t.assignee_id
 WHERE t.first_response_at IS NULL
   AND t.state NOT IN ('resuelto','cerrado','cancelado')
 ORDER BY t.created_at ASC;
```

El filtro de **24 h laborables** se aplica en el servicio con `BusinessCalendar`
(así la regla queda en un solo lugar y es testeable).

### 6.2 Endpoints (bajo `/soporte`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/soporte/alertas/sin-atender` | Lista de casos vencidos (para la pantalla). |
| GET | `/soporte/alertas/resumen` | Contador total (para badge/KPI). |
| POST | `/soporte/alertas/enviar` | Dispara el correo manualmente (pruebas/forzar). |
| GET | `/soporte/alertas` | Historial de alertas generadas. |

Permisos: `@RequierePermiso({ sistema: 'SOP', pagina: 'tickets', permiso: 'seleccionar' })`
(envío manual: `actualizar`).

### 6.3 Envío de correo

- Reutiliza `SoporteMailService.enviar()`.
- Destinatario `SOPORTE_ALERTA_CORREO` (por defecto `calidad@sigesp.com.ve`).
- Un correo por corrida con **todos los casos nuevos** (tabla HTML con: número,
  título, prioridad, cliente/solicitante, fecha de registro, fecha límite, horas,
  responsable) y enlace al detalle.
- Al enviar, se marca `correo_enviado_at` en `ticket_alertas`.

### 6.4 Programación

- Job `setInterval` cada `SOPORTE_ALERTA_CRON_MIN` (por defecto 60 min).
- Solo actúa en **días laborables** y a partir de `SOPORTE_ALERTA_HORA`
  (por defecto **08:00**), **una vez al día** (resumen diario).
- **Idempotente**: cada caso se envía una sola vez (aunque el job corra más veces).

---

## 7. Frontend — Módulo Soporte

En **`tickets-bandeja`** (bandeja principal de Soporte):

1. **Panel de alerta** destacado (rojo/ámbar) cuando hay casos sin atender:
   - Encabezado: *"⚠ Casos sin atender > 24 h laborables (N)"*.
   - Tabla: Número · Título · Prioridad · Solicitante/cliente · Registrado ·
     Fecha límite · Horas transcurridas · Responsable · *(Ver)*.
   - Botón **"Enviar alerta por correo"** (llama al endpoint manual).
2. **KPIs**: nueva tarjeta *"Sin atender > 24 h"* junto a Totales/Abiertos/Sin asignar.
3. **Badge en el menú** de Soporte con el contador (opcional).
4. Auto-refresco cada 5 min.

Archivos: `tickets-bandeja.component.ts/html`, `services/soporte.service.ts`.

---

## 8. Configuración (`.env`)

```env
# Alerta de casos sin atender
SOPORTE_ALERTA_HORAS=24
SOPORTE_ALERTA_CORREO=calidad@sigesp.com.ve
SOPORTE_ALERTA_CRON_MIN=60
SOPORTE_ALERTA_DIAS=1,2,3,4,5
SOPORTE_ALERTA_REPETIR=false
SOPORTE_ALERTA_TZ=America/Caracas
```

---

## 9. Casos borde y consideraciones

- **Atendido** = `first_response_at` seteado (primer mensaje no interno). Si el
  primer contacto es un cambio de estado sin mensaje, no cuenta como atención
  (a confirmar).
- **Feriados**: fase 2 con tabla/config. Fase 1 solo fines de semana.
- **Zona horaria**: cálculo en `America/Caracas` para no depender del TZ del server.
- **Idempotencia**: `UNIQUE (ticket_id, tipo)` evita correos duplicados; política de
  reenvío diario opcional.
- **Rendimiento**: índice sugerido en `tickets (created_at)` + el filtro
  `first_response_at IS NULL AND state NOT IN (...)`. Volumen bajo.
- **Reapertura**: un ticket reabierto ya tiene `first_response_at`, por lo que no
  vuelve a alertar (si se quiere, usar "desde la última reapertura").
- **Seguridad**: endpoints con `SOP/tickets`.

---

## 10. Plan de implementación por fases

| Fase | Entregable |
|---|---|
| 1 | Migración `ticket_alertas` + `BusinessCalendar` (con pruebas de fin de semana). |
| 2 | `AlertasService` (detección + registro) y endpoints de pantalla. |
| 3 | Envío de correo a `calidad@sigesp.com.ve` + scheduler + registro de envíos. |
| 4 | UI: panel, KPI y botón de envío en `tickets-bandeja`. |
| 5 | Pruebas (viernes/lunes, feriados, idempotencia) y documentación. |

---

## 11. Decisiones confirmadas

1. **"Atendido"**: `first_response_at` **o** paso a `asignado`/`en_progreso` (1C).
2. **Alcance**: todos los tickets sin atender, con o sin responsable (2A).
3. **Correo**: **resumen diario** a hora fija (08:00), días laborables (3B).
4. **Reenvío**: **un solo correo por caso**, sin repetir (4A).
5. **Cómputo**: solo **lunes a viernes**, 24 h por día laborable (5A).
6. **Destinatarios**: solo `calidad@sigesp.com.ve` (6A).
