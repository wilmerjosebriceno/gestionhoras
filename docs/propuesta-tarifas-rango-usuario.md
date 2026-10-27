# Propuesta de diseño e implementación — Tarifas por Región, Rango de Usuarios y Modalidad

## 1. Requerimiento

1. **Tabla de tarifas** que, reutilizando las **regiones** ya existentes, permita
   definir la tarifa para la combinación:

   **(Región, Rango de usuarios [desde–hasta], Modalidad [PRESENCIAL|ONLINE]) → Tarifa**

2. **Atributo en la cabecera de la cotización** (`cot_budget`) asociado al
   **rango de usuarios desde–hasta**, de modo que al **insertar una actividad**
   el sistema busque la tarifa con: **número de usuarios + región + modalidad**.

Flujo buscado:

```
Cabecera:  nro_user (p.ej. 45)  +  región (CENTRAL)  +  rango (31–50)
Línea:     actividad  +  modalidad (PRESENCIAL)
                 │
                 ▼
        TARIFA = cot_tarifa(región, rango, modalidad)
                 │
                 ▼
        Precio = horas de la actividad × Tarifa
```

---

## 2. Resumen de la solución

| Elemento | Qué se hace |
|---|---|
| **Regiones** | Se reutiliza `cot_region` (ya existe). Se le agrega `code` para identificar zonas (ORIENTAL, CENTRAL, CENTROCCIDENTAL, OCCIDENTAL). |
| **Rango de usuarios** | **Tabla nueva** `cot_rango_usuario` (desde, hasta, descripción). Maestro reutilizable por tarifas y por la cabecera. |
| **Tarifas** | **Tabla nueva** `cot_tarifa` = (región × rango × modalidad) → tarifa. |
| **Cabecera** | `cot_budget` gana `nro_user` y `id_rango` (FK). |
| **Detalle** | `cot_dt_budget` gana `id_tarifa` y `tarifa_aplicada` (snapshot). Ya tiene `id_region` y `modalidad`. |

> Alternativa simple (si no quieres tabla de rangos): poner `usuarios_desde` y
> `usuarios_hasta` directamente en `cot_tarifa` y en `cot_budget`. La propuesta
> recomendada usa un **maestro de rangos** porque la cabecera también lo necesita.

---

## 3. Diseño de tablas

### 3.1 `cot_region` (existente — solo se agrega `code`)
| Columna | Tipo | Nota |
|---|---|---|
| id_region | PK | ya existe |
| id_client | int | ya existe (para zonas globales: NULL) |
| name | varchar(100) | ya existe |
| **code** | varchar(20) | **nuevo**: ORIENTAL / CENTRAL / CENTROCCIDENTAL / OCCIDENTAL |
| price | numeric(18,4) | ya existe (puede quedar como tarifa por defecto/legacy) |
| price_online | numeric(18,4) | ya existe |
| active | smallint | ya existe |

### 3.2 `cot_rango_usuario` (NUEVA) — rango desde/hasta
| Columna | Tipo | Nota |
|---|---|---|
| id_rango | SERIAL PK | |
| desde | int NOT NULL | inicio del rango |
| hasta | int NOT NULL | fin del rango (usar 2000000000 para “sin tope”) |
| descripcion | varchar(60) | p.ej. “31 a 50 usuarios” |
| activo | smallint DEFAULT 1 | |

- `CHECK (hasta >= desde)`
- `UNIQUE (desde, hasta)`
- **Restricción de no solapamiento** (evita rangos ambiguos):
  `EXCLUDE USING gist (int4range(desde, hasta, '[]') WITH &&)`

### 3.3 `cot_tarifa` (NUEVA) — tarifa por región + rango + modalidad
| Columna | Tipo | Nota |
|---|---|---|
| id_tarifa | SERIAL PK | |
| id_region | int NOT NULL | FK → `cot_region` |
| id_rango | int NOT NULL | FK → `cot_rango_usuario` |
| modalidad | varchar(10) NOT NULL | `PRESENCIAL` / `ONLINE` |
| tarifa | numeric(18,4) NOT NULL DEFAULT 0 | $/hora |
| activo | smallint DEFAULT 1 | |

- `UNIQUE (id_region, id_rango, modalidad)` → una sola tarifa por combinación.

### 3.4 `cot_budget` (cabecera) — atributos nuevos
| Columna | Tipo | Nota |
|---|---|---|
| **nro_user** | int | número exacto de usuarios |
| **id_rango** | int FK → `cot_rango_usuario` | rango asociado (snapshot) |
| *(opcional)* usuarios_desde | int | snapshot del rango, por si el maestro cambia |
| *(opcional)* usuarios_hasta | int | snapshot del rango |

### 3.5 `cot_dt_budget` (detalle) — atributos nuevos
| Columna | Tipo | Nota |
|---|---|---|
| **id_tarifa** | int FK → `cot_tarifa` | tarifa usada (trazabilidad) |
| **tarifa_aplicada** | numeric(18,4) | snapshot del $/hora |
| id_region | int | ya existe |
| modalidad | varchar(10) | ya existe (`PRESENCIAL`/`ONLINE`) |
| quantity | numeric | horas de la actividad |

---

## 4. Relaciones

```
                 cot_region
                 (id_region, code, name)
                        │ 1
                        │
                        │ N
   cot_rango_usuario ──N┤ cot_tarifa
   (id_rango,desde,hasta)│ (id_region, id_rango, modalidad, tarifa)
        │ 1             │
        │               │
        │ N             │ N (id_tarifa)
        ▼               ▼
   cot_budget ───1:N──► cot_dt_budget
   (nro_user, id_rango)  (id_region, modalidad, quantity,
                          id_tarifa, tarifa_aplicada)
```

---

## 5. DDL (PostgreSQL, idempotente)

```sql
-- 1) Código de zona en las regiones existentes
ALTER TABLE cot_region ADD COLUMN IF NOT EXISTS code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cot_region_code ON cot_region (code);

-- 2) Maestro de rangos de usuarios
CREATE TABLE IF NOT EXISTS cot_rango_usuario (
  id_rango     SERIAL PRIMARY KEY,
  desde        INT NOT NULL,
  hasta        INT NOT NULL,
  descripcion  VARCHAR(60),
  activo       SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT chk_rango_orden CHECK (hasta >= desde),
  CONSTRAINT uq_rango UNIQUE (desde, hasta)
);

-- No solapamiento de rangos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_cot_rango_no_overlap') THEN
    ALTER TABLE cot_rango_usuario
      ADD CONSTRAINT ex_cot_rango_no_overlap
      EXCLUDE USING gist (int4range(desde, hasta, '[]') WITH &&);
  END IF;
END $$;

-- 3) Tarifas por región + rango + modalidad
CREATE TABLE IF NOT EXISTS cot_tarifa (
  id_tarifa   SERIAL PRIMARY KEY,
  id_region   INT NOT NULL REFERENCES cot_region(id_region)        ON DELETE CASCADE,
  id_rango    INT NOT NULL REFERENCES cot_rango_usuario(id_rango)  ON DELETE CASCADE,
  modalidad   VARCHAR(10) NOT NULL CHECK (modalidad IN ('PRESENCIAL','ONLINE')),
  tarifa      NUMERIC(18,4) NOT NULL DEFAULT 0,
  activo      SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (id_region, id_rango, modalidad)
);
CREATE INDEX IF NOT EXISTS idx_cot_tarifa_lookup
  ON cot_tarifa (id_region, modalidad, id_rango);

-- 4) Cabecera: nro_user + rango
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS nro_user INT;
ALTER TABLE cot_budget ADD COLUMN IF NOT EXISTS id_rango INT
  REFERENCES cot_rango_usuario(id_rango) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cot_budget_nro_user ON cot_budget (nro_user);

-- 5) Detalle: snapshot de la tarifa usada
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS id_tarifa INT
  REFERENCES cot_tarifa(id_tarifa) ON DELETE SET NULL;
ALTER TABLE cot_dt_budget ADD COLUMN IF NOT EXISTS tarifa_aplicada NUMERIC(18,4);
```

---

## 6. Consulta de la tarifa (núcleo del requerimiento)

Dado **nro_user + región + modalidad**, se obtiene la tarifa en una sola consulta:

```sql
SELECT t.id_tarifa, t.tarifa
FROM cot_tarifa t
JOIN cot_rango_usuario r ON r.id_rango = t.id_rango
WHERE t.id_region = :idRegion
  AND t.modalidad = :modalidad
  AND r.desde <= :nroUser AND :nroUser <= r.hasta
  AND t.activo = 1 AND r.activo = 1
LIMIT 1;
```

Y el rango de la cabecera se deriva así:

```sql
SELECT id_rango, descripcion
FROM cot_rango_usuario
WHERE desde <= :nroUser AND :nroUser <= hasta AND activo = 1
LIMIT 1;
```

---

## 7. Implementación backend (NestJS + TypeORM)

### 7.1 Entidades

```ts
@Entity({ name: 'cot_rango_usuario' })
export class CotRangoUsuario {
  @PrimaryGeneratedColumn({ name: 'id_rango' }) idRango: number;
  @Column({ type: 'int' }) desde: number;
  @Column({ type: 'int' }) hasta: number;
  @Column({ type: 'varchar', length: 60, nullable: true }) descripcion?: string;
  @Column({ type: 'smallint', default: 1 }) activo: number;
}

@Entity({ name: 'cot_tarifa' })
export class CotTarifa {
  @PrimaryGeneratedColumn({ name: 'id_tarifa' }) idTarifa: number;
  @Column({ name: 'id_region', type: 'int' }) idRegion: number;
  @Column({ name: 'id_rango', type: 'int' }) idRango: number;
  @Column({ type: 'varchar', length: 10 }) modalidad: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 }) tarifa: number;
  @Column({ type: 'smallint', default: 1 }) activo: number;

  @ManyToOne(() => Region) @JoinColumn({ name: 'id_region' }) region?: Region;
  @ManyToOne(() => CotRangoUsuario) @JoinColumn({ name: 'id_rango' }) rango?: CotRangoUsuario;
}
```

> Registrar ambas en `database.config.ts` (arreglo `entities`).

### 7.2 Servicio de tarifas

```ts
async obtenerTarifa(idRegion: number, nroUser: number, modalidad: string): Promise<CotTarifa | null> {
  return this.tarifaRepo.createQueryBuilder('t')
    .innerJoin(CotRangoUsuario, 'r', 'r.id_rango = t.id_rango')
    .where('t.id_region = :idRegion', { idRegion })
    .andWhere('t.modalidad = :modalidad', { modalidad })
    .andWhere('r.desde <= :nroUser AND :nroUser <= r.hasta', { nroUser })
    .andWhere('t.activo = 1 AND r.activo = 1')
    .getOne();
}

async resolverRango(nroUser: number): Promise<CotRangoUsuario | null> {
  return this.rangoRepo.createQueryBuilder('r')
    .where('r.desde <= :nroUser AND :nroUser <= r.hasta', { nroUser })
    .andWhere('r.activo = 1')
    .getOne();
}
```

### 7.3 Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/cotizaciones/tarifa?idRegion=&nroUser=&modalidad=` | Tarifa a aplicar (para el formulario) |
| `GET` | `/cotizaciones/rango?nroUser=` | Rango sugerido a partir del número de usuarios |
| `GET` | `/cotizaciones/rangos` | Lista de rangos (combo) |
| `GET` | `/cotizaciones/tarifas` | Lista de tarifas (catálogo) |
| `POST/PUT/DELETE` | `/cotizaciones/tarifas/:id` | CRUD de tarifas |

### 7.4 Recalculo server-side (no confiar en el cliente)

Al guardar la cotización, el backend **vuelve a resolver** la tarifa por línea:

```ts
const nroUser = budget.nro_user;
for (const d of detalles) {
  const tarifa = await this.obtenerTarifa(d.idRegion, nroUser, d.modalidad);
  d.idTarifa = tarifa?.idTarifa ?? null;
  d.tarifaAplicada = Number(tarifa?.tarifa ?? 0);
  d.price = d.tarifaAplicada;          // $/hora
  d.subtotal = Number(d.quantity) * d.tarifaAplicada;
}
// luego el recalcular() actual calcula IVA y totales
```

---

## 8. Implementación frontend (Angular)

1. **Cabecera**: campo **N° de usuarios** (`nro_user`). Al escribir, llamar a
   `GET /cotizaciones/rango?nroUser=` y mostrar el rango (31–50) y guardarlo en `id_rango`.
2. **Región**: combo de regiones (zonas).
3. **Al agregar una actividad** o cambiar **región/modalidad**: llamar a
   `GET /cotizaciones/tarifa` con `idRegion + nro_user + modalidad` y asignar
   `d.price`, `d.idTarifa`, `d.tarifaAplicada`.
4. **Catálogo de tarifas**: nueva pestaña en `cot-catalogos` para mantener
   `cot_rango_usuario` y `cot_tarifa` (región, rango, modalidad, tarifa).
5. Reutilizar los métodos actuales `onRegionCambia` y `onModalidadCambia`,
   reemplazando `region.price/priceOnline` por la consulta a `cot_tarifa`.

---

## 9. Seed de la normativa Oct-2026

Rangos:
| desde | hasta | descripción |
|---|---|---|
| 1 | 30 | Hasta 30 usuarios |
| 31 | 50 | 31 a 50 usuarios |
| 51 | 100 | 51 a 100 usuarios |
| 101 | 150 | 101 a 150 usuarios |
| 151 | 2000000000 | Más de 150 (requiere levantamiento) |

Tarifas (mismas en todos los rangos según la normativa):
| Región | PRESENCIAL | ONLINE |
|---|---|---|
| ORIENTAL | 115 | 55 |
| CENTRAL | 90 | 55 |
| CENTROCCIDENTAL | 70 | 55 |
| OCCIDENTAL | 105 | 55 |

> Como la tarifa es constante por región+modalidad, se carga el mismo valor en
> los 5 rangos (4 regiones × 5 rangos × 2 modalidades = 40 filas). Si más adelante
> deciden tarifas por rango, solo se cambian los valores de `cot_tarifa` sin tocar código.

---

## 10. Reglas de integridad y validaciones

- **No solapamiento** de rangos (constraint de exclusión). Ej.: 1–30 y 25–50 → error.
- **Toda combinación** región+rango+modalidad usada debe tener tarifa (validar en el guardado).
- Si no existe tarifa → bloquear el guardado o marcar la línea como “pendiente”.
- `nro_user` > 150 → advertir “requiere levantamiento”.
- Congelar `tarifa_aplicada` en la línea para que cambios futuros de tarifa no alteren cotizaciones emitidas.

---

## 11. Compatibilidad

- Las cotizaciones actuales quedan con `nro_user`/`id_rango` NULL → **legacy**, no se recalculan.
- `cot_region.price` / `price_online` se mantienen (no se eliminan) como respaldo.
- Los cambios son **aditivos** (columnas nuevas y tablas nuevas); no rompen lo existente.

---

## 12. Criterios de aceptación

- [ ] Puedo definir tarifas por **región + rango + modalidad**.
- [ ] En la cotización registro **nro_user** y se resuelve el **rango** (45 → 31–50).
- [ ] Al insertar una actividad, con nro_user + región + modalidad se obtiene **la tarifa correcta**.
- [ ] El precio de la línea = horas × tarifa y queda guardado como snapshot.
- [ ] Rangos solapados son rechazados por la base.
- [ ] Cotizaciones legacy no se alteran.

> Nota: esta propuesta **reemplaza** la parte de tarifas del diseño anterior
> (`cot_tramo` + `cot_tarifa` por región/modalidad). Los archivos 188/189 no están
> aplicados en la base; conviene regenerarlos con este diseño.

---

## 13. Estado de implementación (Fase D)

Implementado y compilando (backend `tsc` y frontend `ng build` en verde):

**Backend**
- `cot-rango-usuario.entity.ts`, `cot-tarifa.entity.ts` (nuevas) + registro en
  `database.config.ts` y `cotizaciones.module.ts`.
- `region.entity.ts` (`code`), `budget.entity.ts` (`nroUser`, `idRango`),
  `cot-dt-budget.entity.ts` (`idTarifa`, `tarifaAplicada`).
- Servicio: CRUD de rangos y tarifas, `resolverRango(nroUser)`,
  `obtenerTarifa(idRegion, nroUser, modalidad)`.
- `mapearDetalle()` resuelve el precio por tarifa (región + rango + modalidad) y
  guarda `idTarifa`/`tarifaAplicada`; `recalcular()` re-resuelve la tarifa
  server-side cuando la cotización tiene `nro_user`.
- DTOs: `CreateRangoUsuarioDto`, `CreateTarifaDto`, y `nroUser`/`idRango`/`idTarifa`.
- Endpoints: `GET/POST/PUT/DELETE /cotizaciones/rangos`,
  `/cotizaciones/tarifas`, `GET /cotizaciones/rango?nroUser=`,
  `GET /cotizaciones/tarifa?idRegion=&nroUser=&modalidad=`.

**Frontend**
- Modelos `CotRangoUsuario`, `CotTarifa`; campos `nroUser`/`idRango` y
  `idTarifa`/`tarifaAplicada`.
- Servicio: métodos de rangos/tarifas + `getRango`/`getTarifa`.
- Formulario: campo **N° de usuarios**, lectura del **rango** resuelto, y
  `aplicarTarifa()` que fija el precio por región + rango + modalidad al agregar
  una actividad o cambiar región/modalidad. Suscribe `nroUser`/`idRango` al guardar.

**Pendiente opcional**
- Catálogo visual (CRUD) de rangos y tarifas en `cot-catalogos`.
- Aviso en UI cuando no exista tarifa para la combinación (p.ej. >150 usuarios).

