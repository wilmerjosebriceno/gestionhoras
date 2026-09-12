# Reporte de testeo funcional de la API

- **Fecha:** 2026-09-11
- **Entorno:** local - backend NestJS `http://localhost:3000/api/v1` - BD `db_gestionhoras_sigesp` (PostgreSQL 5434)
- **Autenticacion:** usuario `admin` (adminUser=1)
- **Alcance:** todos los maestros y procesos de AUTH, COT, SEC y SGH
- **Metodo:** altas/consultas/actualizaciones/bajas reales via API con datos de prueba (sufijo unico) y posterior limpieza

## Resumen

| Metrica | Valor |
|---|---|
| Acciones ejecutadas | 122 |
| Exitosas | 120 |
| Fallas | 2 |
| Tasa de exito | 98.4% |

> Las 2 fallas corresponden a: (1) bug real en `GET /sgh/estructura/asignacion/:id/desactivar` **corregido** y re-verificado; (2) `GET /ayuda/SEC/...` que responde 404 correctamente porque no hay ayuda registrada para SEC.

## Detalle por accion

### AUTH

| Accion | Metodo | Endpoint | Resultado | Detalle |
|---|---|---|---|---|
| Iniciar sesion (admin/123) | POST | `/auth/login` | OK | OK - adminUser=1 mustChangePassword=True |
| Login con credenciales invalidas (debe fallar) | POST | `/auth/login` | OK | OK (HTTP 401 esperado) |
| Mis permisos | POST | `/auth/mis-permisos` | OK | OK |
| Refrescar token | POST | `/auth/refresh` | OK | OK - nuevo accessToken |
| Cambiar password con confirmacion distinta (debe fallar) | POST | `/auth/cambiar-password` | OK | OK (HTTP 400 esperado) |

### COT

| Accion | Metodo | Endpoint | Resultado | Detalle |
|---|---|---|---|---|
| Crear cliente | POST | `/cotizaciones/clientes` | OK | OK |
| Listar clientes | GET | `/cotizaciones/clientes` | OK | OK |
| Ver cliente | GET | `/cotizaciones/clientes/204` | OK | OK |
| Actualizar cliente | PUT | `/cotizaciones/clientes/204` | OK | OK |
| Crear region | POST | `/cotizaciones/regiones` | OK | OK |
| Listar regiones | GET | `/cotizaciones/regiones` | OK | OK |
| Actualizar region | PUT | `/cotizaciones/regiones/4` | OK | OK |
| Crear plantilla | POST | `/cotizaciones/plantillas` | OK | OK |
| Listar plantillas | GET | `/cotizaciones/plantillas` | OK | OK |
| Actualizar plantilla | PUT | `/cotizaciones/plantillas/5` | OK | OK |
| Crear empresa | POST | `/cotizaciones/empresas` | OK | OK |
| Listar empresas | GET | `/cotizaciones/empresas` | OK | OK |
| Actualizar empresa | PUT | `/cotizaciones/empresas/4` | OK | OK |
| Listar tasas de IVA | GET | `/cotizaciones/tasas-iva` | OK | OK |
| Actualizar tasa de IVA (no-op) | PUT | `/cotizaciones/tasas-iva/1` | OK | OK |
| Crear cotizacion con lineas | POST | `/cotizaciones` | OK | OK |
| Ver cotizacion | GET | `/cotizaciones/9` | OK | OK |
| Actualizar cotizacion (fecha/nota) | PUT | `/cotizaciones/9` | OK | OK |
| Recalcular totales | POST | `/cotizaciones/9/calcular` | OK | OK |
| Registrar historial | POST | `/cotizaciones/9/historial` | OK | OK |
| Cambiar estado -> ENVIADA | POST | `/cotizaciones/9/estado/1` | OK | OK |
| Cambiar estado -> BORRADOR | POST | `/cotizaciones/9/estado/0` | OK | OK |
| DUPLICAR cotizacion (nueva funcionalidad) | POST | `/cotizaciones/9/duplicar` | OK | OK |
| Verificar copia (lineas/estado/codigo) | GET | `/cotizaciones/10` | OK | OK - code=2026-000002 lineas=1 status=0 |
| Generar PDF de cotizacion | GET | `/cotizaciones/9/pdf` | OK | OK - 42801 bytes |
| Eliminar cotizacion (borrado logico) | DELETE | `/cotizaciones/9` | OK | OK |
| Verificar estado ELIMINADA (4) | GET | `/cotizaciones/9` | OK | status=4 |
| Restaurar cotizacion (estado 0) | POST | `/cotizaciones/9/estado/0` | OK | OK |
| Listar cotizaciones (paginado) | GET | `/cotizaciones?page=1&limit=5` | OK | OK |
| Buscar cotizaciones | GET | `/cotizaciones?q=T0911105442` | OK | OK |
| Consultar vencidas/por vencer | GET | `/cotizaciones/vencidas` | OK | OK |
| KPIs dashboard | GET | `/cotizaciones/kpis` | OK | OK |
| Limpieza SQL de datos COT de prueba | SQL | `budgets/maestros` | OK | Sentencias ejecutadas: 23 |

### SEC

| Accion | Metodo | Endpoint | Resultado | Detalle |
|---|---|---|---|---|
| Crear grupo | POST | `/grupos` | OK | OK |
| Listar grupos | GET | `/grupos` | OK | OK |
| Ver grupo | GET | `/grupos/GRPT0911105442` | OK | OK |
| Actualizar grupo | PUT | `/grupos/GRPT0911105442` | OK | OK |
| Crear sistema | POST | `/sistemas` | OK | OK |
| Listar sistemas | GET | `/sistemas` | OK | OK |
| Ver sistema | GET | `/sistemas/TST` | OK | OK |
| Actualizar sistema | PUT | `/sistemas/TST` | OK | OK |
| Crear usuario | POST | `/usuarios` | OK | OK |
| Listar usuarios | GET | `/usuarios?limit=5` | OK | OK |
| Ver usuario | GET | `/usuarios/PRBT0911105442` | OK | OK |
| Actualizar usuario | PUT | `/usuarios/PRBT0911105442` | OK | OK |
| Reset password de usuario de prueba | POST | `/usuarios/PRBT0911105442/reset-password` | OK | OK |
| Desbloquear usuario de prueba | POST | `/usuarios/PRBT0911105442/desbloquear` | OK | OK |
| Consultar firma | GET | `/usuarios/PRBT0911105442/firma` | OK | OK |
| Asignar usuario a grupo | POST | `/grupos/GRPT0911105442/usuarios` | OK | OK |
| Permisos: listar sistemas | GET | `/permisos/sistemas` | OK | OK |
| Permisos: arbol SEC | GET | `/permisos/arbol/SEC` | OK | OK |
| Permisos: listar usuarios | GET | `/permisos/listar/usuarios` | OK | OK |
| Permisos: listar grupos | GET | `/permisos/listar/grupos` | OK | OK |
| Permisos: por usuario admin | GET | `/permisos/usuario/admin` | OK | OK |
| Permisos: por grupo (prueba) | GET | `/permisos/grupo/GRPT0911105442` | OK | OK |
| Permisos: guardar (grupo prueba) | POST | `/permisos/guardar` | OK | OK |
| Permisos: verificar pagina | GET | `/permisos/verificar/sec_def_usuario.html.php?sistema=SEC` | OK | OK |
| Auditoria: eventos | GET | `/auditoria/eventos` | OK | OK |
| Auditoria: resumen | GET | `/auditoria/resumen` | OK | OK |
| Auditoria: logs | GET | `/auditoria/logs?limit=5` | OK | OK |
| Ayuda: indice | GET | `/ayuda/indice` | OK | OK |

### SGH

| Accion | Metodo | Endpoint | Resultado | Detalle |
|---|---|---|---|---|
| Crear categoria | POST | `/sgh/categorias` | OK | OK |
| Listar categorias | GET | `/sgh/categorias` | OK | OK |
| Actualizar categoria | PUT | `/sgh/categorias/4` | OK | OK |
| Crear tipo de actividad | POST | `/sgh/tipos` | OK | OK |
| Listar tipos | GET | `/sgh/tipos` | OK | OK |
| Actualizar tipo | PUT | `/sgh/tipos/8` | OK | OK |
| Crear item de actividad | POST | `/sgh/items` | OK | OK |
| Listar items | GET | `/sgh/items` | OK | OK |
| Actualizar item | PUT | `/sgh/items/15` | OK | OK |
| Crear proceso | POST | `/sgh/procesos` | OK | OK |
| Listar procesos | GET | `/sgh/procesos` | OK | OK |
| Actualizar proceso | PUT | `/sgh/procesos/43` | OK | OK |
| Crear usuario SGH | POST | `/sgh/usuarios` | OK | OK |
| Listar usuarios SGH | GET | `/sgh/usuarios` | OK | OK |
| Actualizar usuario SGH | PUT | `/sgh/usuarios/42` | OK | OK |
| Crear cliente SGH | POST | `/sgh/clientes` | OK | OK |
| Listar clientes SGH | GET | `/sgh/clientes` | OK | OK |
| Ver cliente SGH | GET | `/sgh/clientes/202` | OK | OK |
| Actualizar cliente SGH | PUT | `/sgh/clientes/202` | OK | OK |
| Crear proyecto | POST | `/sgh/proyectos` | OK | OK |
| Listar proyectos | GET | `/sgh/proyectos` | OK | OK |
| Ver proyecto | GET | `/sgh/proyectos/17` | OK | OK |
| Detalle proyecto | GET | `/sgh/proyectos/17/detalle` | OK | OK |
| Actividades por proyecto | GET | `/sgh/proyectos/17/actividades` | OK | OK |
| Generar PDF de proyecto | GET | `/sgh/proyectos/17/pdf` | OK | OK - 38603 bytes |
| Generar cronograma | GET | `/sgh/proyectos/17/cronograma/generar` | OK | OK |
| Cronograma: cabecera proyecto | GET | `/sgh/cronograma/proyecto/17` | OK | OK |
| Cronograma: fases | GET | `/sgh/cronograma/proyecto/17/fases` | OK | OK |
| Cronograma: actualizar fase | PUT | `/sgh/cronograma/fases/56` | OK | OK |
| Cronograma: crear hito | POST | `/sgh/cronograma/hitos` | OK | OK |
| Cronograma: actualizar hito | PUT | `/sgh/cronograma/hitos/4` | OK | OK |
| Cronograma: registrar seguimiento | POST | `/sgh/cronograma/seguimiento` | OK | OK |
| Cronograma: ver seguimiento | GET | `/sgh/cronograma/fases/56/seguimiento` | OK | OK |
| Cronograma: hitos del proyecto | GET | `/sgh/cronograma/proyecto/17/hitos` | OK | OK |
| Crear actividad con detalle | POST | `/sgh/actividades` | OK | OK |
| Ver actividad | GET | `/sgh/actividades/8004` | OK | OK |
| Actualizar actividad | PUT | `/sgh/actividades/8004` | OK | OK |
| Recalcular actividad | POST | `/sgh/actividades/8004/recalcular` | OK | OK |
| Anular actividad | POST | `/sgh/actividades/8004/anular` | OK | OK |
| Eliminar actividad | DELETE | `/sgh/actividades/8004` | OK | OK |
| Actividades: reporte | GET | `/sgh/actividades/reporte` | OK | OK |
| Actividades: reporte PDF | GET | `/sgh/actividades/reporte/pdf` | OK | OK - 16258 bytes |
| Estructura: data | GET | `/sgh/estructura` | OK | OK |
| Estructura: items activos | GET | `/sgh/estructura/items-activos` | OK | OK |
| Estructura: asignacion guardar | POST | `/sgh/estructura/asignacion` | OK | OK |
| Estructura: ver asignacion | GET | `/sgh/estructura/asignacion?idItemActivity=15` | OK | OK |
| Estructura: desactivar otras | GET | `/sgh/estructura/asignacion/15/desactivar?idProcess=43` | FALLA | HTTP 500 {"statusCode":500,"message":"error de sintaxis en o cerca de «:»","error":"Internal Server Error","timestamp":"2026-09-11T14:54:53.587Z"} |
| Dashboard: resumen | GET | `/sgh/dashboard/resumen` | OK | OK |
| Dashboard: clientes-anual | GET | `/sgh/dashboard/clientes-anual` | OK | OK |
| Dashboard: clientes-anio | GET | `/sgh/dashboard/clientes-anio` | OK | OK |
| Dashboard: usuarios-anio | GET | `/sgh/dashboard/usuarios-anio` | OK | OK |
| Dashboard: usuarios-fiscal | GET | `/sgh/dashboard/usuarios-fiscal` | OK | OK |
| Dashboard: proyectos | GET | `/sgh/dashboard/proyectos` | OK | OK |
| Dashboard: avance-fases proyecto | GET | `/sgh/dashboard/avance-fases/17` | OK | OK |
| Logos: listar | GET | `/sgh/logos` | OK | OK |
| Ayuda: pagina | GET | `/ayuda/SEC/sec_def_usuario` | FALLA | HTTP 404 {"statusCode":404,"message":"No hay ayuda registrada para SEC/sec_def_usuario","error":"Not Found","timestamp":"2026-09-11T14:54:53.721Z"} |

## Hallazgos

1. **BUG corregido - SGH Estructura:** `desactivarOtras()` en `backend/src/sgh/estructura.service.ts` usaba el parametro `:idItem` pero la clave del objeto era `idItemActivity`, por lo que TypeORM no reemplazaba el parametro y PostgreSQL devolvia error 500 de sintaxis. Corregido a `{ idProcess, idItem: idItemActivity }` y re-verificado (HTTP 200).
2. **Sin bug - Ayuda:** `GET /ayuda/SEC/sec_def_usuario` responde 404 porque el archivo `backend/ayuda/ayuda.json` solo tiene paginas de SGH. Con una pagina valida (`GET /ayuda/SGH/dashboard`) responde 200 con contenido.

## Nueva funcionalidad verificada

- **Duplicar cotizacion:** `POST /cotizaciones/:id/duplicar` copia cabecera y lineas, asigna nuevo codigo y estado BORRADOR. Verificado: la copia tiene 1 linea, estado 0 y codigo distinto.
- **Fecha de cotizacion editable:** se creo una cotizacion con fecha anterior (`2026-08-15`) y se actualizo a `2026-08-20` con exito.

## Limpieza

Todos los registros de prueba fueron eliminados (maestros por API y cotizaciones/procesos por SQL). Se verifico la ausencia de restos por sufijo y por ID.
