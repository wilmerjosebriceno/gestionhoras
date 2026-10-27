# Propuesta: incorporar `nro_user` y maestro de tarifas (zona × modalidad) al módulo de Cotizaciones

## 1. Objetivo

Incorporar la normativa SIGESP ERP (Oct-2026) al módulo de cotizaciones,
introduciendo el atributo **`nro_user`** en la cotización como eje del cálculo.
Con `nro_user` el sistema puede:

1. Resolver el **tramo de usuarios** (30 / 50 / 100 / 150).
2. Determinar las **horas** de implantación (presenciales y online).
3. Determinar la **tarifa** por **región + modalidad** (presencial u online).
4. Calcular precio, costo y margen, y **congelar** los valores al emitir.

> Idea rectora: separar **MAESTRO** (región, modalidad, tramo, tarifa, horas, parámetros)
> de **COTIZACIÓN** (nro_user + zona + alcances → líneas calculadas).

---

## 0. Decisiones confirmadas (Oct-2026)

1. La **tarifa** depende solo de **región + modalidad**; `nro_user` solo cambia las horas.
2. **Un (1) alcance** por cotización → columna directa `cot_budget.id_alcance`.
3. `cot_region` es el **maestro global de zonas** (`id_client = NULL`).
4. Fase implementada: **B (estructura) + C (seed)**.

Migraciones generadas y **validadas** (transacción + rollback, idempotentes):
- `backend/src/migrations/1880000000000-cot-normativa-estructura.sql`
- `backend/src/migrations/1890000000000-cot-normativa-seed-oct2026.sql`

---

## 2. Concepto clave

`cot_budget.nro_user` es el disparador:

```
nro_user ──► tramo (T30/T50/T100/T150)
                 │
                 ├─► HORAS   (tramo × alcance) ──► presenciales / online
                 │
                 └─► TARIFA  (región × modalidad × [tramo])  ← tabla que planteas
                                   │
                                   ▼
              Precio = HorasPres × TarifaPres + HorasOnline × TarifaOnline
```

La tabla de tarifas se diseña como **(región, modalidad, tramo opcional)** para que
puedas empezar con tarifa constante por región+modalidad (como la normativa) y,
sin cambiar el modelo, activar tarifas por tramo más adelante.

---

## 3. Estrategia de cambios (por fases)

| Fase | Alcance | Resultado | Riesgo |
|------|---------|-----------|--------|
| **A** | Decisiones de modelado | Definir si la tarifa varía por tramo; alcances múltiples; región global vs por cliente | Bajo |
| **B** | Migración BD (aditiva, nullable) | Tablas maestras + columnas nuevas; no rompe lo existente | Bajo |
| **C** | Seed / carga desde el Excel | Parámetros, tarifas, horas, tramos y alcances cargados | Bajo |
| **D** | Motor de cálculo (backend) | `NormativaService` + endpoints `simular` / `generar` / `parametros` | Medio |
| **E** | Frontend | `nro_user`, región, alcances (chips), “Generar líneas”, panel de margen | Medio |
| **F** | Versionado / congelado | Snapshot de normativa y tarifas; históricos intactos | Medio |
| **G** | Servicios extra | Mantenimiento, actualización, grupos multiplicadores y reportes | Medio |

Regla de oro: **todo cambio de Fase B es aditivo**. Las cotizaciones existentes
quedan con `nro_user = NULL` y `id_normativa = NULL` (legacy) y **no se recalculan**.

---

## 4. Propuesta de MAESTRO (tablas nuevas y ajustes)

### 4.1 `cot_normativa` — versionado
| Columna | Tipo | Nota |
|---|---|---|
| id_normativa | PK | |
| codigo | varchar(30) | p.ej. `OCT-2026` |
| vigencia_desde | date | |
| indice_inflacion | numeric(12,6) | base 1.000000; actualizar con BCV |
| activo | smallint | 1/0 |
| nota | text | |

### 4.2 `cot_tramo` — rango de usuarios
| Columna | Tipo |
|---|---|
| id_tramo | PK |
| code | varchar(10) (`T30`,`T50`,`T100`,`T150`) |
| descripcion | varchar(60) |
| usuarios_min | int |
| usuarios_max | int NULL (abierto) |

### 4.3 `cot_alcance` — alcance de implantación
| Columna | Tipo |
|---|---|
| id_alcance | PK |
| code | varchar(10) (`A1`,`A2`,`A3`,`A4`) |
| descripcion | varchar(80) |
| orden | int |

### 4.4 `cot_actividad` — actividades (tipo de hora)
| Columna | Tipo | Nota |
|---|---|---|
| id_actividad | PK | |
| code | varchar(20) | |
| nombre | text | |
| modalidad | varchar(10) | `PRESENCIAL` / `ONLINE` |
| id_normativa | FK | |
| orden | int | |

### 4.5 `cot_horas_alcance` — totales por tramo/alcance (fuente de verdad)
| Columna | Tipo |
|---|---|
| id_normativa | FK |
| id_tramo | FK |
| id_alcance | FK |
| horas_pres | numeric(10,2) |
| horas_online | numeric(10,2) |

PK compuesta: (`id_normativa`,`id_tramo`,`id_alcance`).

### 4.6 `cot_horas_actividad` — detalle por actividad (tramo 30)
| Columna | Tipo |
|---|---|
| id_normativa | FK |
| id_tramo | FK |
| id_alcance | FK |
| id_actividad | FK |
| horas | numeric(10,2) |

### 4.7 `cot_tarifa` — **tabla región × modalidad** — tu propuesta
| Columna | Tipo | Nota |
|---|---|---|
| id_tarifa | PK | |
| id_normativa | FK | versión |
| id_region | FK | zona geográfica |
| modalidad | varchar(10) | `PRESENCIAL` / `ONLINE` |
| tarifa | numeric(18,4) | $/hora |

Único: (`id_normativa`,`id_region`,`modalidad`).
Resolución: tarifa = fila (normativa activa, región de la cotización, modalidad de la línea).

### 4.8 `cot_parametro` — porcentajes
| clave | valor | uso |
|---|---|---|
| ISLR | 0.01 | retención cliente |
| MUNICIPAL | 0.03 | actividades económicas |
| GOBERNACION | 0.01 | |
| RESP_SOCIAL | 0.03 | |
| FIANZA | 0.10 | sustitutiva de retención |
| INDIRECTOS | 0.35 | sobre ingreso |
| UTILIDAD_MIN | 0.30 | control de margen |

PK: (`id_normativa`,`clave`).

### 4.9 Ajuste a `cot_region`
Hoy `cot_region` tiene `id_client`. Para la normativa las zonas son **globales**
(Oriental/Central/Centroccidental/Occidental). Dos opciones:
- **Recomendada:** usar `cot_region` como maestro de zonas con `id_client = NULL`
  y `price` = tarifa presencial, `price_online` = tarifa online; la tabla `cot_tarifa`
  formaliza el histórico por versión.
- Alternativa: crear `cot_zona` global y dejar `cot_region` como sede del cliente.

---

## 5. Propuesta para la COTIZACIÓN

### 5.1 `cot_budget` (cabecera) — columnas nuevas
| Columna | Tipo | Nota |
|---|---|---|
| nro_user | int | **atributo solicitado** |
| id_tramo | FK | snapshot derivado de `nro_user` |
| id_region | FK | zona geográfica |
| id_normativa | FK | versión congelada |
| tipo_servicio | varchar(20) | `IMPLANTACION`,`MANTENIMIENTO`,`ACTUALIZACION`,`GRUPO_MULT` |
| descuento_pct | numeric(5,2) | |
| horas_pres | numeric(10,2) | total congelado |
| horas_online | numeric(10,2) | total congelado |
| costo_estimado | numeric(18,4) | |
| margen_pct | numeric(5,2) | |
| forma_pago | text | mover el texto de `modalidad` |

### 5.2 `cot_budget.id_alcance` (un alcance por cotización)
Decisión: se descarta la tabla puente N:M. La cabecera lleva `id_alcance`
(FK a `cot_alcance`) para indicar el único alcance de la cotización.

### 5.3 `cot_dt_budget` (líneas) — columnas nuevas
| Columna | Tipo | Nota |
|---|---|---|
| id_actividad | FK | actividad normada |
| horas_pres | numeric(10,2) | |
| horas_online | numeric(10,2) | |
| tarifa_aplicada | numeric(18,4) | snapshot del $/hora |

Se mantienen `quantity` (= horas facturables), `price`, `subtotal`, `tax`, `total`,
`id_region`, `id_tasa_iva`, `modalidad`.

---

## 6. Flujo de cálculo

```
1. Usuario elige cliente y zona (id_region).
2. Ingresa nro_user (p.ej. 45) ─► tramo = T50.
3. Elige tipo_servicio = IMPLANTACION y alcances (chips A1, A2…).
4. El motor:
     horas   = Σ cot_horas_alcance(tramo, alcance)          [pres, online]
     tarifaP = cot_tarifa(region,'PRESENCIAL',tramo ?? NULL)
     tarifaO = cot_tarifa(region,'ONLINE', tramo ?? NULL)
     subtotal = horas.pres*tarifaP + horas.online*tarifaO
  (para tramo 30 se desglosa por cot_horas_actividad)
5. Se generan las líneas de cot_dt_budget (actividad, modalidad, horas, tarifa).
6. recalcular(): IVA/totales (lógica actual intacta) + costo y margen:
     costo = horas.pres*costoPres(region) + horas.online*costoOnl(region)
             + ingreso*(ISLR+MUNICIPAL+GOBERNACION+RESP_SOCIAL+FIANZA)
             + ingreso*INDIRECTOS
     margen = (ingreso_neto - costo) / ingreso_neto
7. Al pasar a ENVIADA: congelar id_normativa, tarifas y horas en las líneas.
```

### Endpoints nuevos
- `GET /cotizaciones/normativa/parametros` → tramos, alcances, actividades, tarifas, parámetros.
- `POST /cotizaciones/simular` → devuelve líneas + horas + costo + margen (no persiste).
- `POST /cotizaciones/generar` → crea la cotización con sus líneas.
- `GET /cotizaciones/tramo?nroUser=45` → tramo sugerido (validación >150 → levantamiento).

---

## 7. DDL de referencia (resumen)

```sql
CREATE TABLE cot_normativa (
  id_normativa SERIAL PRIMARY KEY,
  codigo VARCHAR(30) UNIQUE NOT NULL,
  vigencia_desde DATE NOT NULL,
  indice_inflacion NUMERIC(12,6) DEFAULT 1,
  activo SMALLINT DEFAULT 1,
  nota TEXT
);

CREATE TABLE cot_tramo (
  id_tramo SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(60),
  usuarios_min INT,
  usuarios_max INT
);

CREATE TABLE cot_alcance (
  id_alcance SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  descripcion VARCHAR(80),
  orden INT
);

CREATE TABLE cot_actividad (
  id_actividad SERIAL PRIMARY KEY,
  code VARCHAR(20),
  nombre TEXT,
  modalidad VARCHAR(10) CHECK (modalidad IN ('PRESENCIAL','ONLINE')),
  id_normativa INT REFERENCES cot_normativa(id_normativa),
  orden INT
);

CREATE TABLE cot_tarifa (
  id_tarifa SERIAL PRIMARY KEY,
  id_normativa INT REFERENCES cot_normativa(id_normativa),
  id_region INT REFERENCES cot_region(id_region),
  modalidad VARCHAR(10) CHECK (modalidad IN ('PRESENCIAL','ONLINE')),
  tarifa NUMERIC(18,4) NOT NULL,
  UNIQUE (id_normativa, id_region, modalidad)
);

CREATE TABLE cot_horas_alcance (
  id_normativa INT REFERENCES cot_normativa(id_normativa),
  id_tramo INT REFERENCES cot_tramo(id_tramo),
  id_alcance INT REFERENCES cot_alcance(id_alcance),
  horas_pres NUMERIC(10,2) DEFAULT 0,
  horas_online NUMERIC(10,2) DEFAULT 0,
  PRIMARY KEY (id_normativa, id_tramo, id_alcance)
);

CREATE TABLE cot_horas_actividad (
  id_normativa INT, id_tramo INT, id_alcance INT, id_actividad INT,
  horas NUMERIC(10,2) DEFAULT 0,
  PRIMARY KEY (id_normativa, id_tramo, id_alcance, id_actividad)
);

CREATE TABLE cot_parametro (
  id_normativa INT REFERENCES cot_normativa(id_normativa),
  clave VARCHAR(30),
  valor NUMERIC(18,6),
  descripcion TEXT,
  PRIMARY KEY (id_normativa, clave)
);

ALTER TABLE cot_budget
  ADD COLUMN nro_user INT,
  ADD COLUMN id_tramo INT REFERENCES cot_tramo(id_tramo),
  ADD COLUMN id_region INT REFERENCES cot_region(id_region),
  ADD COLUMN id_normativa INT REFERENCES cot_normativa(id_normativa),
  ADD COLUMN id_alcance INT REFERENCES cot_alcance(id_alcance),
  ADD COLUMN tipo_servicio VARCHAR(20),
  ADD COLUMN descuento_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN horas_pres NUMERIC(10,2),
  ADD COLUMN horas_online NUMERIC(10,2),
  ADD COLUMN costo_estimado NUMERIC(18,4),
  ADD COLUMN margen_pct NUMERIC(5,2),
  ADD COLUMN forma_pago TEXT;

-- (sin tabla puente: un solo alcance por cotización)

ALTER TABLE cot_dt_budget
  ADD COLUMN id_actividad INT REFERENCES cot_actividad(id_actividad),
  ADD COLUMN horas_pres NUMERIC(10,2),
  ADD COLUMN horas_online NUMERIC(10,2),
  ADD COLUMN tarifa_aplicada NUMERIC(18,4);
```

---

## 8. Seed desde el Excel (Fase C)

| Origen (Excel) | Destino |
|---|---|
| Hoja Parámetros → zonas | `cot_region` (Oriental 115/55, Central 90/55, Centrocc. 70/55, Occidental 105/55) |
| Hoja Parámetros → tarifas | `cot_tarifa` (region, modalidad, tramo NULL, tarifa) |
| Hoja Parámetros → % | `cot_parametro` |
| Hoja Detalle30 | `cot_actividad` + `cot_horas_actividad` (tramo T30) |
| Hoja Horas | `cot_horas_alcance` (T30/T50/T100/T150) |
| Hoja Mantenimiento | `cot_mantenimiento` (Fase G) |

---

## 9. Compatibilidad y riesgos

1. **Históricos**: `nro_user`/`id_normativa` NULL ⇒ legacy; nunca recalcular.
2. **Precio**: definir precedencia (`cot_tarifa` > `cot_region` > `cot_template.price`).
3. **IVA vs deducciones**: IVA ya modelado; ISLR/municipal/responsabilidad social son
   retenciones y se muestran aparte.
4. **Región global vs `id_client`**: decidir (ver 4.9).
5. **Indexación**: aplicar `indice_inflacion` de la normativa activa; guardar snapshot.
6. **>150 usuarios**: el motor debe bloquear y pedir levantamiento.

---

## 10. Criterios de aceptación

- [ ] Se registra `nro_user` y se deriva el tramo correcto (45 ⇒ T50).
- [ ] La tarifa se obtiene de `cot_tarifa` por región + modalidad.
- [ ] Las horas se obtienen de `cot_horas_alcance` por tramo + alcance.
- [ ] El precio = horas × tarifa y coincide con la matriz del Excel.
- [ ] Se calculan costo y margen y se valida el mínimo.
- [ ] Sólo `BORRADOR` se recalcula; al emitir se congela la versión.
- [ ] Cotizaciones legacy no se alteran.

---

## 11. Decisiones (resueltas)

1. **Tarifa**: solo varía por región + modalidad; `nro_user` solo cambia las horas. ✅
2. **nro_user exacto + tramo derivado** (se guardan ambos). ✅
3. **Un alcance** por cotización (columna directa, sin tabla puente). ✅
4. `cot_region` pasa a ser **global** (zonas con `id_client = NULL`). ✅

## 12. Estado de implementación

- **Fase B (estructura)**: implementada — `1880000000000-cot-normativa-estructura.sql`.
- **Fase C (seed)**: implementada — `1890000000000-cot-normativa-seed-oct2026.sql`.
- Validación: ejecución en transacción + `ROLLBACK` e idempotencia (seed x2). Conteos:
  11 actividades, 44 horas-actividad, 16 horas-alcance, 8 tarifas, 7 parámetros.
- Pendiente: **Fase D** (motor + entidades TypeORM), **E** (frontend), **F/G**.
