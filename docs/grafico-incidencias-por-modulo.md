# Gráfico de incidencias por módulo (Soporte)

Documento de evaluación y propuesta. **Estado: FASE 1 y FASE 2 IMPLEMENTADAS** (categorías existentes con código, gráfico en la bandeja con desglose abiertos/cerrados, y clic en la barra para filtrar).

Sistema **SIGESP** · Frontend Angular 21 + Highcharts · Backend NestJS · PostgreSQL (`sigespweb`).

---

## 1. Objetivo

Incorporar en el módulo de Soporte un **gráfico de barras** con el **número de incidencias por módulo**
(ej.: SCG Contabilidad, SPG Presupuesto, SCA Compras, SIN Inventario, SNM Nómina...), con la
posibilidad de filtrar por rango de fechas y por estado.

---

## 2. Evaluación de factibilidad

| Punto | Hallazgo |
|---|---|
| Librería de gráficos | **Ya disponible**: `highcharts@13` y ya se usa en `mantis-dashboard` (barras, columnas, pie). No hay que instalar nada. |
| Patrón existente | `@ViewChild('chartX')` + `Highcharts.chart(el, {...})` + `renderCharts()` / `destroyCharts()`. Reutilizable tal cual. |
| Datos del ticket | `sigespweb.tickets.category_id` → `sigespweb.ticket_categories` (jerárquica por `padre_id`). |
| Endpoint de KPIs | `SoporteService.estadisticas()` ya devuelve `porEstado` y `porPrioridad`; agregar `porModulo`/`porCategoria` es directo. |
| **Dato "módulo"** | **No hay un catálogo de módulos con código SIGESP** (SCG/SPG). Lo más cercano son las categorías **hijo de "Software": `ERP Contabilidad`, `ERP Presupuesto`, `ERP Compras`, `ERP Inventario`, `ERP Nómina`**. También existe el campo obligatorio de Mantis **«MODULOS ERP»**, pero su valor **no se persiste** en la base local. |
| Datos actuales | 13 tickets, **todos sin `category_id`** y todos de tipo `incidente`. Hoy el gráfico mostraría 13 en «Sin categoría». |

**Conclusión:** técnicamente es viable y de bajo costo. El único punto a decidir es **cuál es la fuente
oficial del "módulo"**, porque hoy no existe como tal.

---

## 3. Opciones de fuente del dato

### Opción A — Usar las categorías existentes (rápida, sin migración)
Graficar por categoría, agrupando los hijos bajo su categoría padre. Los "módulos ERP" ya son
subcategorías de *Software*.

- **Pro:** cero migración; funciona con lo que ya hay.
- **Contra:** nombres genéricos (`ERP Contabilidad`) sin el código corporativo (`SCG`); depende de
  que el analista categorice el ticket.

### Opción B — Catálogo de módulos dedicado (recomendada para nomenclatura SCG/SPG)
Nueva tabla `sigespweb.ticket_modulos` (código + nombre + etiqueta) y columna `modulo_id` en `tickets`.

- **Pro:** códigos exactos y reportes estables a futuro; permite lista desplegable en el formulario.
- **Contra:** requiere capturar el módulo al crear el ticket (nuevo campo).

### Opción C — Derivar del campo Mantis «MODULOS ERP»
Persistir el valor del campo personalizado al enviar a Mantis (hoy se envía pero no se guarda).

- **Pro:** aprovecha un dato que el analista **ya digita**.
- **Contra:** solo aplica a tickets enviados a Mantis y a proyectos que tengan ese campo.

### Recomendación
**Híbrida por fases:**
1. **Fase 1 (inmediata):** Opción A → gráfico «Incidencias por módulo/categoría» con el agrupamiento
   padre/hijo. Se ve valor desde ya.
2. **Fase 2:** Opción B → catálogo con códigos SCG/SPG y `modulo_id` en el ticket, con la lista en el
   formulario. El gráfico pasa a usar el catálogo.
3. **Fase 3 (opcional):** Opción C → al enviar a Mantis, guardar automáticamente el módulo elegido.

---

## 4. Propuesta técnica

### 4.1 Backend

**Endpoint nuevo** (sin tocar los existentes):

```
GET /soporte/stats/por-modulo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&estado=
```

Respuesta:

```json
{
  "modulos": [
    { "modulo": "SCG Contabilidad", "codigo": "SCG", "total": 12, "abiertos": 3, "cerrados": 9 },
    { "modulo": "SPG Presupuesto",  "codigo": "SPG", "total": 5,  "abiertos": 2, "cerrados": 3 }
  ],
  "sinCategoria": 4
}
```

**SQL (Fase 1, con categorías):**

```sql
SELECT COALESCE(pc.nombre, c.nombre, 'Sin categoría') AS modulo,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE t.state NOT IN ('resuelto','cerrado','cancelado'))::int AS abiertos,
       COUNT(*) FILTER (WHERE t.state IN ('resuelto','cerrado'))::int AS cerrados
  FROM sigespweb.tickets t
  LEFT JOIN sigespweb.ticket_categories c  ON c.id = t.category_id
  LEFT JOIN sigespweb.ticket_categories pc ON pc.id = c.padre_id
 WHERE ($1::date IS NULL OR t.created_at >= $1)
   AND ($2::date IS NULL OR t.created_at < ($2::date + 1))
 GROUP BY 1
 ORDER BY total DESC;
```

**Migración (Fase 2):**

```sql
CREATE TABLE IF NOT EXISTS sigespweb.ticket_modulos (
  id       SERIAL PRIMARY KEY,
  codigo   VARCHAR(10)  NOT NULL UNIQUE,
  nombre   VARCHAR(80)  NOT NULL,
  etiqueta VARCHAR(120),
  orden    INTEGER NOT NULL DEFAULT 0,
  activo   BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE sigespweb.tickets
  ADD COLUMN IF NOT EXISTS modulo_id INTEGER REFERENCES sigespweb.ticket_modulos(id);
```

Seeder de módulos iniciales: SCG Contabilidad, SPG Presupuesto, SCA Compras, SIN Inventario,
SNM Nómina (ampliable).

### 4.2 Frontend

Nuevo bloque de gráfico reutilizando el patrón de `mantis-dashboard`:

```ts
@ViewChild('chartModulo') chartModulo?: ElementRef;

private graficoModulo(): Highcharts.Chart {
  const datos = [...(this.porModulo ?? [])].slice(0, 12).reverse();
  return Highcharts.chart(this.chartModulo!.nativeElement, {
    chart: { type: 'bar', height: 360 },
    title: { text: 'Incidencias por módulo', style: { fontSize: '13px' } },
    xAxis: { categories: datos.map((d) => d.modulo), labels: { style: { fontSize: '10px' } } },
    yAxis: { title: { text: 'Incidencias' }, allowDecimals: false },
    legend: { enabled: true },
    plotOptions: { bar: { dataLabels: { enabled: true } } },
    series: [
      { type: 'bar', name: 'Abiertos', data: datos.map((d) => d.abiertos), color: '#f59e0b' },
      { type: 'bar', name: 'Cerrados', data: datos.map((d) => d.cerrados), color: '#10b981' },
    ],
    credits: { enabled: false },
  });
}
```

- Método en `SoporteService` (frontend): `statsPorModulo(filtros)`.
- Contenedor HTML: `<div class="bg-white rounded-xl border border-gray-200 p-4"><div #chartModulo></div></div>`.
- Click en una barra → filtra la bandeja por ese módulo/categoría (valor agregado).

### 4.3 Ubicación en la interfaz

Dos alternativas (se puede hacer cualquiera o ambas):

- **A. En `tickets-bandeja`** (pantalla principal de Soporte), debajo de los KPIs y del panel de
  alertas. Es donde el usuario ya trabaja. **Recomendado.**
- **B. En una nueva pestaña «Dashboard»** dentro de Soporte (`/soporte/dashboard`), junto a los KPIs.
  Más ordenado si crecerán más gráficos.

---

## 5. Estimación de esfuerzo

| Fase | Trabajo | Estimado |
|---|---|---|
| Fase 1 (categorías) | Endpoint + query + gráfico + ubicación | 0.5 – 1 día |
| Fase 2 (catálogo SCG/SPG) | Migración + seeder + campo en formulario + filtro | 1 – 1.5 días |
| Fase 3 (Mantis) | Guardar «MODULOS ERP» al enviar | 0.5 día |

---

## 6. Decisiones confirmadas

1. **Fuente del módulo**: **Opción A** — usar las categorías existentes (los módulos ERP son
   categorías). *(Fase 1 implementada.)*
2. **Ubicación**: **bandeja de Soporte** (`/soporte/tickets`), debajo de los KPIs y del panel de alertas.
3. **Métricas**: **desglose abiertos/cerrados** por módulo.

Queda pendiente, si se desea, la Fase 2 (catálogo con códigos SCG/SPG) y la Fase 3 (Mantis).

---

## 7. Implementación (Fase 1)

### Backend
`SoporteService.estadisticas()` ahora devuelve también `porModulo`:

```json
"porModulo": [
  { "modulo": "ERP Contabilidad", "total": 12, "abiertos": 3, "cerrados": 9 },
  { "modulo": "Sin categoria",    "total": 4,  "abiertos": 2, "cerrados": 0 }
]
```

Se agrupa por la **categoría asignada al ticket** (no por su padre), para que cada módulo ERP sea su
propia barra. Los tickets sin categoría se agrupan en «Sin categoria».

### Frontend
- `TicketStats` (servicio) incluye `porModulo`.
- `tickets-bandeja` renderiza con **Highcharts** un gráfico de **barras** «Incidencias por módulo»
  con dos series (**Abiertos** ámbar / **Cerrados** verde), top 12, etiquetas de datos y tooltip.
- Se destruye el gráfico en `ngOnDestroy` para evitar fugas.

### Verificación
Consulta probada contra la base local: hoy devuelve `Sin categoria: 13` (6 abiertos), porque los
tickets aún no están categorizados. Backend y frontend compilan sin errores.

---

## 7b. Fase 2 implementada (código de módulo + filtro por clic)

### Código en las categorías
Se agregó `codigo` a `sigespweb.ticket_categories` (migración `1920000000000-soporte-categoria-codigo.sql`,
idempotente) y se sembraron los códigos de los módulos ERP:

| Categoría | Código |
|---|---|
| ERP Contabilidad | SCG |
| ERP Presupuesto | SPG |
| ERP Compras | SCA |
| ERP Inventario | SIN |
| ERP Nómina | SNM |

El gráfico muestra el código sin el prefijo «ERP» (p. ej. **«SCG Contabilidad»**). El backend también
asegura la columna y los códigos al arrancar (`SoporteSchemaService`).

### Filtro por clic
- Al hacer **clic en una barra** del gráfico se filtra la bandeja por ese módulo/categoría.
- Se agregó el filtro **Módulo** a la bandeja (`QueryTicketsDto.categoryId`) y al servicio frontend.
- La tarjeta de "Sin categoría" no es filtrable por id (no aplica).

### Edición de la categoría
Como el detalle del ticket no permitía editar la categoría, se agregó una tarjeta **«Clasificación»**
en el detalle con el desplegable **Módulo / Categoría** (usa el endpoint `PATCH /soporte/tickets/:id`).
El desplegable del formulario de creación también muestra el código.

### Endpoint de catálogo
`GET /soporte/catalogs` ya devuelve `categorias` con el nuevo campo `codigo`.

---

## 8. Observación importante

Con los datos actuales (**13 tickets, todos sin categoría**) el gráfico aparecería casi vacío
(«Sin categoría»). Para que sea útil hay que **categorizar los tickets** o adoptar la Opción B/C.
```
