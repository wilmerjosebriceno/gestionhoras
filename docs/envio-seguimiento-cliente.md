# Envío manual del seguimiento del ticket al cliente

## Objetivo

En **SOPORTE → detalle del ticket**, el agente decide **manualmente** qué
**comentarios públicos** del caso enviar por correo al **cliente**. Las **notas
internas nunca se envían**: el backend filtra siempre `is_internal = FALSE`.

## Flujo

1. El agente abre el ticket y pulsa **✉ Preparar envío** (panel «Enviar seguimiento al cliente»).
2. Se listan los comentarios del caso:
   - **Públicos** → seleccionables (por defecto, todos marcados).
   - **Internos** → mostrados con la etiqueta **«INTERNO · no se envía»** y **no seleccionables**.
3. Opcionalmente: correo destino (precargado con el del cliente), mensaje introductorio
   e incluir los **documentos adjuntos** del ticket.
4. **Vista previa** (abre el correo en otra pestaña) o **Enviar seguimiento**.
5. El envío queda registrado en el historial del ticket.

## Backend

| Pieza | Detalle |
|---|---|
| DTO | `EnviarSeguimientoDto` (`destinatario`, `mensajeIds[]`, `mensaje`, `incluirAdjuntos`, `previsualizar`) |
| Servicio | `SoporteService.enviarSeguimientoCliente(id, dto, gestor)` |
| Plantillas | `plantillaSeguimiento()` (HTML) y `textoSeguimiento()` (texto plano) |
| Endpoint | `POST /soporte/tickets/:id/enviar-seguimiento` (permiso `SOP/tickets` → `actualizar`) |

### Seguridad (regla clave)

La consulta de comentarios **siempre** aplica:

```sql
WHERE m.ticket_id = $1
  AND m.is_internal = FALSE
  AND m.id = ANY($2::int[])   -- solo si el agente seleccionó ids
```

Aunque el cliente de la API intente incluir ids de notas internas, **se descartan**.
El destinatario por defecto es el correo del solicitante y, si falta, el del cliente
(`public.sgh_client.email`).

## Frontend

- `soporte.service.ts` → `enviarSeguimiento(id, payload)`.
- `ticket-detalle.component.ts` → estado y métodos: `abrirSeguimiento()`, `toggleSeguimiento()`,
  `seleccionCount()`, `enviarSeguimiento()`, `previsualizarSeguimiento()`.
- `ticket-detalle.component.html` → panel **«Enviar seguimiento al cliente»** (con lista de
  comentarios, etiqueta de internos, adjuntos y acciones).

## Notas

- El correo usa el mismo SMTP del módulo (`MAIL_*`). Si no está configurado, el envío
  se reporta como **simulado** (no falla).
- Disponible en **cualquier estado** del ticket (es un seguimiento, no la carta de cierre).
- Validado: backend `tsc` + `npm run build` y frontend `tsc` + `ng build` en verde.
