# Consulta Monitor de Horas (Scrin) — multiusuario

## 0. Resumen

Pantalla y API de **solo lectura** para consultar, por rango de fechas, las
actividades de Scrin de **uno o varios usuarios** que tengan **token** e
**ID Scrin** asignado. Reutiliza el mismo flujo del Monitor de Horas
(consulta a Scrin → staging → tabla), pero permite elegir el/los usuarios.

- **Solo lectura:** no marca registros ni genera/procesa resúmenes.
- **Multiusuario:** se consulta usuario por usuario, aislando errores.
- **Fuente:** Scrin en vivo; lo consultado se guarda en `sgh_scrin_activity`.

---

## 1. Objetivo

Permitir a un supervisor/administrador ver las horas registradas en Scrin por
varios colaboradores sin depender de que cada uno entre a importarlas.

---

## 2. Endpoints

Base: `GET/POST /api/v1/sgh/scrin/monitor`

| Método | Ruta | Body / Query | Descripción |
|--------|------|--------------|-------------|
| `GET` | `/consulta/usuarios` | — | Usuarios con token + ID Scrin (`idUser`, `login`, `nameUser`, `scrinCompanyId`, `scrinEmploymentId`, `tokenPreview`) |
| `POST` | `/consulta/fetch` | `{ idUsers: number[], from, to }` | Consulta Scrin con el token de cada usuario y guarda en staging |
| `GET` | `/consulta/actividades` | `?idUsers=1,2&from&to` | Filas de staging para la tabla (con `userName`) |

### Respuesta de `/consulta/fetch`
```json
{
  "resultados": [
    { "idUser": 41, "nameUser": "MARIA ROA", "ok": true, "from": "2026-09-01", "to": "2026-09-24",
      "fetched": 12, "inserted": 8, "duplicates": 4 },
    { "idUser": 2, "nameUser": "AARON NAVARRO", "ok": false, "error": "No tiene token Scrin configurado" }
  ]
}
```
> Un error en un usuario **no** interrumpe a los demás.

---

## 3. Reglas de acceso

- **Administrador SGH** (`sgh_users.rol = 'A'` o `'S'`): consulta a **cualquiera**.
- **No administrador:** el backend **fuerza** su propio `idUser` (aunque envíe
  otros); `/consulta/usuarios` solo lo devuelve a él.
- El token **nunca** se expone: solo `tokenPreview` (últimos 4 dígitos).

---

## 4. Flujo

```
Frontend: selecciona usuarios + rango → "Consultar Scrin"
        │
        ├─ POST /consulta/fetch  (por cada usuario: token propio + employmentId)
        │      └─ Scrin → sgh_scrin_activity (orIgnore: deduplica)
        │
        └─ GET /consulta/actividades → tabla (read-only)
```

---

## 5. Frontend

- Componente: `frontend/src/app/sgh/consulta-monitor-horas/consulta-monitor-horas.component.{ts,html}`
- Ruta: `/sgh/monitor-horas-consulta`
- Menú: **Gestión de Horas → Monitor de Horas (Consulta)**
- Servicio: `frontend/src/app/sgh/services/monitor-horas.service.ts`
  (`consultaUsuarios`, `consultaFetch`, `consultaActividades`)

La pantalla incluye: **desplegable de usuarios** (con filtro de texto) y botón
**Agregar**; los elegidos se muestran como **etiquetas (chips)** que se pueden
quitar; rango desde/hasta; botón **Consultar Scrin**; chips de resultado por
usuario; y tabla con Usuario, Proyecto Scrin, Empleado, Fecha, Inicio, Fin,
Duración, Offline y Nota (más el total de horas).

---

## 6. Exportación

- Botón **Exportar CSV** (habilitado cuando hay filas).
- Utilidad genérica: `frontend/src/app/core/utils/csv.util.ts` (`descargarCsv`).
- Formato: separador `;` y BOM UTF-8 → **abre directo en Excel** con acentos.

---

## 7. Permisos

Nodo en el árbol de seguridad:

```xml
<item nombre="Consulta Monitor de Horas" pagina="monitor_horas_consulta"/>
```

- Backend: `backend/permisos/xml/sec_arbol_sgh.xml`
- Go (dato, por consistencia del árbol): `backend-go/resources/permisos/xml/sec_arbol_sgh.xml`
- Frontend: `permisos.map.ts` → `'/sgh/monitor-horas-consulta': { sistema: 'SGH', pagina: 'monitor_horas_consulta' }`

> Hay que **asignar** la página `monitor_horas_consulta` a los grupos/usuarios
> para que el menú aparezca.

---

## 8. Verificación

- Builds backend y frontend: **OK**.
- Runtime (contexto NestJS):
  - Admin (`wilmerb`) → 2 usuarios con Scrin: `aaronn`, `mariaroa`.
  - No-admin (`mariaroa`) → solo ella misma.
  - `consultaActividades('mariaroa', [])` → 86 registros propios, con `userName`.

---

## 9. Restricciones y notas

- **Secuencial:** consultar N usuarios realiza N llamadas a Scrin; con muchos
  usuarios puede tardar. El resultado por usuario se devuelve igual.
- **Staging compartido:** lo consultado queda en `sgh_scrin_activity` (mismo
  `id_user`); registros ya importados aparecen como *duplicados*.
- **Datos por verificar:** cada usuario debe tener un `scrin_employment_id`
  real (no el ID de cuenta/empresa), o la consulta fallará/trará datos ajenos.
- **Codificación LATIN9:** no usar caracteres UTF-8 en SQL (ver `docs/agente-ia.md`).

---

## 10. Cómo extender

- **Exportar PDF:** reutilizar `PdfReportsService` (`pdfmake`) con un endpoint
  `GET /consulta/pdf` y `abrirPdf` en el frontend.
- **Filtro por proyecto/estado:** pasar más filtros a `/consulta/actividades`.
- **Comparar con lo procesado:** cruzar `sgh_scrin_activity.sync_status` /
  `id_activity` con `sgh_activity`.
