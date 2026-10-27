import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ActualizarActividadDto,
  ActualizarAsignacionDto,
  ActualizarMiembroDto,
  ActualizarProyectoDto,
  ActualizarRecursoDto,
  CrearActividadDto,
  CrearAsignacionDto,
  CrearCalendarioDto,
  CrearDependenciaDto,
  CrearExcepcionDto,
  CrearMiembroDto,
  CrearParteHoraDto,
  CrearProyectoDto,
  CrearRecursoDto,
  CrearRolDto,
  GuardarAsignacionHorasDto,
  QueryAsignacionDto,
  QueryParteHoraDto,
  QueryProyectoDto,
} from './dto/gpi.dto';
import {
  Calendario,
  Excepciones,
  consumirHoras,
  diaInfo,
  fromIdx,
  nextWorkingIdx,
  ordenTopologico,
  toIdx,
} from './gpi-scheduler';

/** Normaliza para columnas nullable: '' -> null; undefined se mantiene undefined
 *  (para que los UPDATE parciales omitan el campo). pg traduce undefined a NULL. */
const nz = (v: unknown): unknown => (v === undefined ? undefined : v === '' ? null : v);

@Injectable()
export class GpiService {
  constructor(private readonly dataSource: DataSource) {}

  /* ==================== Proyectos ==================== */

  async listarProyectos(f: QueryProyectoDto) {
    const cond: string[] = ['p.activo = TRUE'];
    const val: unknown[] = [];
    if (f.search?.trim()) {
      val.push(`%${f.search.trim()}%`);
      cond.push(`(p.codigo ILIKE $${val.length} OR p.nombre ILIKE $${val.length})`);
    }
    if (f.estado) {
      val.push(f.estado);
      cond.push(`p.estado = $${val.length}::gpi.estado_proyecto`);
    }
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const page = Math.max(f.page ?? 1, 1);
    const offset = (page - 1) * limit;
    val.push(limit, offset);

    const filas = await this.dataSource.query(
      `SELECT p.id_proyecto, p.codigo, p.nombre, p.descripcion, p.estado, p.prioridad,
              p.fecha_ini_plan, p.fecha_fin_plan, p.fecha_ini_real, p.fecha_fin_real,
              p.horas_estimadas, p.horas_reales, p.avance_pct, p.id_gerente,
              r.nombre AS gerente_nombre,
              (SELECT COUNT(*) FROM gpi.actividad a
                WHERE a.id_proyecto = p.id_proyecto AND a.activo)::int AS actividades,
              (SELECT COUNT(*) FROM gpi.proyecto_miembro m
                WHERE m.id_proyecto = p.id_proyecto AND m.activo)::int AS miembros,
              COUNT(*) OVER () AS total
         FROM gpi.proyecto p
         LEFT JOIN gpi.recurso r ON r.id_recurso = p.id_gerente
        WHERE ${cond.join(' AND ')}
        ORDER BY p.codigo
        LIMIT $${val.length - 1} OFFSET $${val.length}`,
      val,
    );
    const total = filas.length ? Number(filas[0].total) : 0;
    return { data: filas.map(({ total: _t, ...x }: any) => x), total, page, limit, totalPaginas: Math.max(1, Math.ceil(total / limit)) };
  }

  async obtenerProyecto(id: number) {
    const filas = await this.dataSource.query(
      `SELECT p.*, r.nombre AS gerente_nombre
         FROM gpi.proyecto p
         LEFT JOIN gpi.recurso r ON r.id_recurso = p.id_gerente
        WHERE p.id_proyecto = $1`,
      [id],
    );
    if (!filas.length) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return filas[0];
  }

  async crearProyecto(dto: CrearProyectoDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.proyecto
         (codigo, nombre, descripcion, id_area, id_gerente, estado, prioridad,
          fecha_ini_plan, fecha_fin_plan, horas_estimadas)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6,'planificado')::gpi.estado_proyecto, COALESCE($7,3),
               $8::date,$9::date, COALESCE($10,0))
       RETURNING id_proyecto`,
      [dto.codigo.trim(), dto.nombre.trim(), nz(dto.descripcion), nz(dto.idArea), nz(dto.idGerente),
       nz(dto.estado), nz(dto.prioridad), nz(dto.fechaIniPlan), nz(dto.fechaFinPlan), nz(dto.horasEstimadas)],
    );
    return this.obtenerProyecto(filas[0].id_proyecto);
  }

  async actualizarProyecto(id: number, dto: ActualizarProyectoDto) {
    await this.obtenerProyecto(id);
    const campos: string[] = [];
    const val: unknown[] = [];
    const set = (col: string, v: unknown, cast = '') => {
      if (v === undefined) return;
      val.push(v);
      campos.push(`${col} = $${val.length}${cast}`);
    };
    set('nombre', dto.nombre?.trim());
    set('descripcion', dto.descripcion === undefined ? undefined : nz(dto.descripcion));
    set('id_area', nz(dto.idArea));
    set('id_gerente', nz(dto.idGerente));
    set('estado', nz(dto.estado), '::gpi.estado_proyecto');
    set('prioridad', nz(dto.prioridad));
    set('fecha_ini_plan', nz(dto.fechaIniPlan), '::date');
    set('fecha_fin_plan', nz(dto.fechaFinPlan), '::date');
    set('fecha_ini_real', nz(dto.fechaIniReal), '::date');
    set('fecha_fin_real', nz(dto.fechaFinReal), '::date');
    set('horas_estimadas', nz(dto.horasEstimadas));
    set('avance_pct', nz(dto.avancePct));
    if (!campos.length) return this.obtenerProyecto(id);
    val.push(id);
    await this.dataSource.query(
      `UPDATE gpi.proyecto SET ${campos.join(', ')}, updated_at = NOW() WHERE id_proyecto = $${val.length}`,
      val,
    );
    return this.obtenerProyecto(id);
  }

  async eliminarProyecto(id: number) {
    await this.dataSource.query(`UPDATE gpi.proyecto SET activo = FALSE, updated_at = NOW() WHERE id_proyecto = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Recursos ==================== */

  async listarRecursos() {
    return this.dataSource.query(
      `SELECT id_recurso, id_usuario, nombre, email, cargo, tipo, area,
              capacidad_semanal, tarifa_hora, activo
         FROM gpi.recurso WHERE activo = TRUE ORDER BY nombre`,
    );
  }

  async crearRecurso(dto: CrearRecursoDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.recurso (id_usuario, nombre, email, cargo, tipo, area, capacidad_semanal, tarifa_hora)
       VALUES ($1,$2,$3,$4, COALESCE($5,'consultor')::gpi.tipo_recurso, $6, COALESCE($7,40), $8)
       RETURNING id_recurso`,
      [nz(dto.idUsuario), dto.nombre.trim(), nz(dto.email), nz(dto.cargo), nz(dto.tipo),
       nz(dto.area), nz(dto.capacidadSemanal), nz(dto.tarifaHora)],
    );
    return { id_recurso: filas[0].id_recurso };
  }

  async actualizarRecurso(id: number, dto: ActualizarRecursoDto) {
    const campos: string[] = [];
    const val: unknown[] = [];
    const set = (col: string, v: unknown, cast = '') => {
      if (v === undefined) return;
      val.push(v);
      campos.push(`${col} = $${val.length}${cast}`);
    };
    set('nombre', dto.nombre?.trim());
    set('email', dto.email === undefined ? undefined : nz(dto.email));
    set('cargo', nz(dto.cargo));
    set('tipo', nz(dto.tipo), '::gpi.tipo_recurso');
    set('area', nz(dto.area));
    set('capacidad_semanal', nz(dto.capacidadSemanal));
    set('tarifa_hora', nz(dto.tarifaHora));
    set('activo', dto.activo);
    if (!campos.length) return { ok: true };
    val.push(id);
    await this.dataSource.query(
      `UPDATE gpi.recurso SET ${campos.join(', ')}, updated_at = NOW() WHERE id_recurso = $${val.length}`,
      val,
    );
    return { ok: true };
  }

  async eliminarRecurso(id: number) {
    await this.dataSource.query(`UPDATE gpi.recurso SET activo = FALSE, updated_at = NOW() WHERE id_recurso = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Roles ==================== */

  async listarRoles() {
    return this.dataSource.query(`SELECT id_rol, codigo, nombre, activo FROM gpi.rol ORDER BY nombre`);
  }

  async crearRol(dto: CrearRolDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.rol (codigo, nombre) VALUES ($1,$2)
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id_rol`,
      [dto.codigo.trim().toUpperCase(), dto.nombre.trim()],
    );
    return { id_rol: filas[0].id_rol };
  }

  /* ==================== Miembros ==================== */

  async listarMiembros(proyectoId: number) {
    return this.dataSource.query(
      `SELECT m.id_miembro, m.id_proyecto, m.id_recurso, m.id_rol, m.dedicacion_pct,
              m.horas_asignadas, m.fecha_alta, m.fecha_baja, m.activo,
              r.nombre AS recurso_nombre, r.tipo AS recurso_tipo, ro.nombre AS rol_nombre
         FROM gpi.proyecto_miembro m
         JOIN gpi.recurso r ON r.id_recurso = m.id_recurso
         LEFT JOIN gpi.rol ro ON ro.id_rol = m.id_rol
        WHERE m.id_proyecto = $1 AND m.activo = TRUE
        ORDER BY r.nombre`,
      [proyectoId],
    );
  }

  async crearMiembro(proyectoId: number, dto: CrearMiembroDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.proyecto_miembro (id_proyecto, id_recurso, id_rol, dedicacion_pct, fecha_alta)
       VALUES ($1,$2,$3, COALESCE($4,100), COALESCE($5::date, CURRENT_DATE))
       ON CONFLICT (id_proyecto, id_recurso)
       DO UPDATE SET id_rol = EXCLUDED.id_rol, dedicacion_pct = EXCLUDED.dedicacion_pct, activo = TRUE
       RETURNING id_miembro`,
      [proyectoId, dto.idRecurso, nz(dto.idRol), nz(dto.dedicacionPct), nz(dto.fechaAlta)],
    );
    return { id_miembro: filas[0].id_miembro };
  }

  async actualizarMiembro(id: number, dto: ActualizarMiembroDto) {
    const campos: string[] = [];
    const val: unknown[] = [];
    const set = (col: string, v: unknown, cast = '') => {
      if (v === undefined) return;
      val.push(v);
      campos.push(`${col} = $${val.length}${cast}`);
    };
    set('id_rol', nz(dto.idRol));
    set('dedicacion_pct', nz(dto.dedicacionPct));
    set('fecha_baja', nz(dto.fechaBaja), '::date');
    set('activo', dto.activo);
    if (!campos.length) return { ok: true };
    val.push(id);
    await this.dataSource.query(`UPDATE gpi.proyecto_miembro SET ${campos.join(', ')} WHERE id_miembro = $${val.length}`, val);
    return { ok: true };
  }

  async eliminarMiembro(id: number) {
    await this.dataSource.query(`UPDATE gpi.proyecto_miembro SET activo = FALSE WHERE id_miembro = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Actividades ==================== */

  async listarActividades(proyectoId: number) {
    return this.dataSource.query(
      `SELECT a.id_actividad, a.id_proyecto, a.id_padre, a.codigo_wbs, a.nombre, a.descripcion,
              a.tipo, a.id_responsable, a.estado, a.prioridad,
              a.fecha_ini_plan, a.fecha_fin_plan, a.fecha_ini_real, a.fecha_fin_real,
              a.fecha_ini_base, a.fecha_fin_base, a.horas_base,
              a.horas_estimadas, a.horas_reales, a.avance_pct, a.orden,
              r.nombre AS responsable_nombre,
              (SELECT COALESCE(SUM(x.horas_estimadas),0) FROM gpi.asignacion x
                WHERE x.id_actividad = a.id_actividad AND x.activo)::numeric AS horas_asignadas
         FROM gpi.actividad a
         LEFT JOIN gpi.recurso r ON r.id_recurso = a.id_responsable
        WHERE a.id_proyecto = $1 AND a.activo = TRUE
        ORDER BY a.orden, a.id_actividad`,
      [proyectoId],
    );
  }

  async crearActividad(dto: CrearActividadDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.actividad
         (id_proyecto, id_padre, codigo_wbs, nombre, descripcion, tipo, id_responsable, estado,
          prioridad, fecha_ini_plan, fecha_fin_plan, horas_estimadas, orden)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6,'tarea')::gpi.tipo_actividad, $7,
               COALESCE($8,'pendiente')::gpi.estado_actividad, COALESCE($9,3),
               $10::date,$11::date, COALESCE($12,0), COALESCE($13,0))
       RETURNING id_actividad`,
      [dto.idProyecto, nz(dto.idPadre), nz(dto.codigoWbs), dto.nombre.trim(), nz(dto.descripcion),
       nz(dto.tipo), nz(dto.idResponsable), nz(dto.estado), nz(dto.prioridad),
       nz(dto.fechaIniPlan), nz(dto.fechaFinPlan), nz(dto.horasEstimadas), nz(dto.orden)],
    );
    return { id_actividad: filas[0].id_actividad };
  }

  async actualizarActividad(id: number, dto: ActualizarActividadDto) {
    const campos: string[] = [];
    const val: unknown[] = [];
    const set = (col: string, v: unknown, cast = '') => {
      if (v === undefined) return;
      val.push(v);
      campos.push(`${col} = $${val.length}${cast}`);
    };
    set('nombre', dto.nombre?.trim());
    set('descripcion', dto.descripcion === undefined ? undefined : nz(dto.descripcion));
    set('tipo', nz(dto.tipo), '::gpi.tipo_actividad');
    set('id_responsable', nz(dto.idResponsable));
    set('estado', nz(dto.estado), '::gpi.estado_actividad');
    set('prioridad', nz(dto.prioridad));
    set('fecha_ini_plan', nz(dto.fechaIniPlan), '::date');
    set('fecha_fin_plan', nz(dto.fechaFinPlan), '::date');
    set('fecha_ini_real', nz(dto.fechaIniReal), '::date');
    set('fecha_fin_real', nz(dto.fechaFinReal), '::date');
    set('horas_estimadas', nz(dto.horasEstimadas));
    set('avance_pct', nz(dto.avancePct));
    set('orden', nz(dto.orden));
    if (!campos.length) return { ok: true };
    val.push(id);
    await this.dataSource.query(
      `UPDATE gpi.actividad SET ${campos.join(', ')}, updated_at = NOW() WHERE id_actividad = $${val.length}`,
      val,
    );
    return { ok: true };
  }

  async eliminarActividad(id: number) {
    await this.dataSource.query(`UPDATE gpi.actividad SET activo = FALSE, updated_at = NOW() WHERE id_actividad = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Dependencias ==================== */

  async listarDependencias(proyectoId: number) {
    return this.dataSource.query(
      `SELECT d.id_dependencia, d.id_actividad, d.id_predecesora, d.tipo, d.lag_dias
         FROM gpi.actividad_dependencia d
         JOIN gpi.actividad a ON a.id_actividad = d.id_actividad
        WHERE a.id_proyecto = $1`,
      [proyectoId],
    );
  }

  async crearDependencia(dto: CrearDependenciaDto) {
    if (dto.idActividad === dto.idPredecesora) {
      throw new BadRequestException('Una actividad no puede depender de sí misma');
    }
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.actividad_dependencia (id_actividad, id_predecesora, tipo, lag_dias)
       VALUES ($1,$2, COALESCE($3,'FS')::gpi.tipo_dependencia, COALESCE($4,0))
       ON CONFLICT (id_actividad, id_predecesora)
       DO UPDATE SET tipo = EXCLUDED.tipo, lag_dias = EXCLUDED.lag_dias
       RETURNING id_dependencia`,
      [dto.idActividad, dto.idPredecesora, nz(dto.tipo), nz(dto.lagDias)],
    );
    return { id_dependencia: filas[0].id_dependencia };
  }

  async eliminarDependencia(id: number) {
    await this.dataSource.query(`DELETE FROM gpi.actividad_dependencia WHERE id_dependencia = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Asignaciones ==================== */

  async listarAsignaciones(f: QueryAsignacionDto) {
    const cond: string[] = ['x.activo = TRUE'];
    const val: unknown[] = [];
    if (f.actividadId) {
      val.push(f.actividadId);
      cond.push(`x.id_actividad = $${val.length}`);
    }
    if (f.proyectoId) {
      val.push(f.proyectoId);
      cond.push(`a.id_proyecto = $${val.length}`);
    }
    return this.dataSource.query(
      `SELECT x.id_asignacion, x.id_actividad, x.id_miembro, x.horas_estimadas,
              x.fecha_ini, x.fecha_fin, x.porcentaje, x.activo,
              a.nombre AS actividad_nombre, a.id_proyecto,
              r.id_recurso, r.nombre AS recurso_nombre,
              (SELECT COALESCE(SUM(h.horas_estimadas),0) FROM gpi.asignacion_horas h
                WHERE h.id_asignacion = x.id_asignacion)::numeric AS horas_distribuidas
         FROM gpi.asignacion x
         JOIN gpi.actividad a ON a.id_actividad = x.id_actividad
         JOIN gpi.proyecto_miembro m ON m.id_miembro = x.id_miembro
         JOIN gpi.recurso r ON r.id_recurso = m.id_recurso
        WHERE ${cond.join(' AND ')}
        ORDER BY a.orden, r.nombre`,
      val,
    );
  }

  async crearAsignacion(dto: CrearAsignacionDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.asignacion (id_actividad, id_miembro, horas_estimadas, fecha_ini, fecha_fin, porcentaje)
       VALUES ($1,$2, COALESCE($3,0), $4::date, $5::date, $6)
       ON CONFLICT (id_actividad, id_miembro)
       DO UPDATE SET horas_estimadas = EXCLUDED.horas_estimadas, fecha_ini = EXCLUDED.fecha_ini,
                     fecha_fin = EXCLUDED.fecha_fin, porcentaje = EXCLUDED.porcentaje, activo = TRUE
       RETURNING id_asignacion`,
      [dto.idActividad, dto.idMiembro, nz(dto.horasEstimadas), nz(dto.fechaIni), nz(dto.fechaFin), nz(dto.porcentaje)],
    );
    return { id_asignacion: filas[0].id_asignacion };
  }

  async actualizarAsignacion(id: number, dto: ActualizarAsignacionDto) {
    const campos: string[] = [];
    const val: unknown[] = [];
    const set = (col: string, v: unknown, cast = '') => {
      if (v === undefined) return;
      val.push(v);
      campos.push(`${col} = $${val.length}${cast}`);
    };
    set('horas_estimadas', nz(dto.horasEstimadas));
    set('fecha_ini', nz(dto.fechaIni), '::date');
    set('fecha_fin', nz(dto.fechaFin), '::date');
    set('porcentaje', nz(dto.porcentaje));
    set('activo', dto.activo);
    if (!campos.length) return { ok: true };
    val.push(id);
    await this.dataSource.query(`UPDATE gpi.asignacion SET ${campos.join(', ')} WHERE id_asignacion = $${val.length}`, val);
    return { ok: true };
  }

  async eliminarAsignacion(id: number) {
    await this.dataSource.query(`UPDATE gpi.asignacion SET activo = FALSE WHERE id_asignacion = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Horas estimadas por fecha ==================== */

  async obtenerHorasAsignacion(asignacionId: number) {
    return this.dataSource.query(
      `SELECT id, id_asignacion, fecha, horas_estimadas
         FROM gpi.asignacion_horas WHERE id_asignacion = $1 ORDER BY fecha`,
      [asignacionId],
    );
  }

  /** Reemplaza la distribucion diaria de horas de una asignacion y recalcula totales. */
  async guardarHorasAsignacion(asignacionId: number, dto: GuardarAsignacionHorasDto) {
    const asign = await this.dataSource.query(
      `SELECT id_asignacion, id_actividad FROM gpi.asignacion WHERE id_asignacion = $1`,
      [asignacionId],
    );
    if (!asign.length) throw new NotFoundException(`Asignación ${asignacionId} no encontrada`);
    const idActividad = asign[0].id_actividad;

    await this.dataSource.transaction(async (tx) => {
      await tx.query(`DELETE FROM gpi.asignacion_horas WHERE id_asignacion = $1`, [asignacionId]);
      for (const h of dto.horas || []) {
        const horas = Number(h.horas) || 0;
        if (!h.fecha || horas <= 0) continue;
        await tx.query(
          `INSERT INTO gpi.asignacion_horas (id_asignacion, fecha, horas_estimadas)
           VALUES ($1,$2::date,$3)`,
          [asignacionId, h.fecha, horas],
        );
      }
      await tx.query(
        `UPDATE gpi.asignacion x
            SET horas_estimadas = (SELECT COALESCE(SUM(h.horas_estimadas),0)
                                     FROM gpi.asignacion_horas h WHERE h.id_asignacion = x.id_asignacion)
          WHERE x.id_asignacion = $1`,
        [asignacionId],
      );
      // Recalcular total de la actividad como suma de sus asignaciones.
      await tx.query(
        `UPDATE gpi.actividad a
            SET horas_estimadas = (SELECT COALESCE(SUM(x.horas_estimadas),0)
                                     FROM gpi.asignacion x
                                    WHERE x.id_actividad = a.id_actividad AND x.activo)
          WHERE a.id_actividad = $1`,
        [idActividad],
      );
    });
    return this.obtenerHorasAsignacion(asignacionId);
  }

  /* ==================== Partes de horas (real) ==================== */

  async listarPartesHoras(f: QueryParteHoraDto) {
    const cond: string[] = [];
    const val: unknown[] = [];
    if (f.asignacionId) {
      val.push(f.asignacionId);
      cond.push(`p.id_asignacion = $${val.length}`);
    }
    if (f.proyectoId) {
      val.push(f.proyectoId);
      cond.push(`a.id_proyecto = $${val.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    return this.dataSource.query(
      `SELECT p.id, p.id_asignacion, p.fecha, p.horas, p.descripcion, p.estado,
              p.aprobado_por, p.aprobado_at,
              a.nombre AS actividad_nombre, r.nombre AS recurso_nombre
         FROM gpi.parte_horas p
         JOIN gpi.asignacion x ON x.id_asignacion = p.id_asignacion
         JOIN gpi.actividad a ON a.id_actividad = x.id_actividad
         JOIN gpi.proyecto_miembro m ON m.id_miembro = x.id_miembro
         JOIN gpi.recurso r ON r.id_recurso = m.id_recurso
         ${where}
        ORDER BY p.fecha DESC`,
      val,
    );
  }

  async crearParteHora(dto: CrearParteHoraDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.parte_horas (id_asignacion, fecha, horas, descripcion)
       VALUES ($1,$2::date,$3,$4)
       ON CONFLICT (id_asignacion, fecha)
       DO UPDATE SET horas = EXCLUDED.horas, descripcion = EXCLUDED.descripcion
       RETURNING id`,
      [dto.idAsignacion, dto.fecha, dto.horas, nz(dto.descripcion)],
    );
    return { id: filas[0].id };
  }

  async aprobarParteHora(id: number, aprobadoPor?: number) {
    await this.dataSource.query(
      `UPDATE gpi.parte_horas SET estado = 'aprobado', aprobado_por = $2, aprobado_at = NOW() WHERE id = $1`,
      [id, nz(aprobadoPor)],
    );
    return { ok: true };
  }

  /* ==================== Vistas: Gantt y carga ==================== */

  async gantt(proyectoId: number) {
    const [proyecto, actividades, dependencias] = await Promise.all([
      this.obtenerProyecto(proyectoId),
      this.listarActividades(proyectoId),
      this.listarDependencias(proyectoId),
    ]);
    return { proyecto, actividades, dependencias };
  }

  async carga(proyectoId: number, desde?: string, hasta?: string) {
    const val: unknown[] = [proyectoId];
    let rango = '';
    if (desde) {
      val.push(desde);
      rango += ` AND fecha >= $${val.length}::date`;
    }
    if (hasta) {
      val.push(hasta);
      rango += ` AND fecha <= $${val.length}::date`;
    }
    return this.dataSource.query(
      `SELECT r.id_recurso, r.nombre AS recurso, v.fecha, SUM(v.horas_estimadas)::numeric AS horas
         FROM gpi.v_horas_actividad_fecha v
         JOIN gpi.recurso r ON r.id_recurso = v.id_recurso
        WHERE v.id_proyecto = $1${rango}
        GROUP BY r.id_recurso, r.nombre, v.fecha
        ORDER BY r.nombre, v.fecha`,
      val,
    );
  }

  /* ==================== Catalogos para selects ==================== */

  async catalogos() {
    const [recursos, roles] = await Promise.all([this.listarRecursos(), this.listarRoles()]);
    return { recursos, roles };
  }

  /* ==================== Calendario ==================== */

  async listarCalendarios(proyectoId?: number) {
    const cond = proyectoId ? 'id_proyecto = $1' : 'id_proyecto IS NULL';
    const val = proyectoId ? [proyectoId] : [];
    return this.dataSource.query(
      `SELECT id_calendario, id_proyecto, nombre, lunes, martes, miercoles, jueves, viernes,
              sabado, domingo, horas_por_dia
         FROM gpi.calendario WHERE ${cond} ORDER BY id_calendario`,
      val,
    );
  }

  async crearCalendario(dto: CrearCalendarioDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.calendario
         (id_proyecto, nombre, lunes, martes, miercoles, jueves, viernes, sabado, domingo, horas_por_dia)
       VALUES ($1,$2, COALESCE($3,TRUE),COALESCE($4,TRUE),COALESCE($5,TRUE),COALESCE($6,TRUE),
               COALESCE($7,TRUE),COALESCE($8,FALSE),COALESCE($9,FALSE), COALESCE($10,8))
       RETURNING id_calendario`,
      [nz(dto.idProyecto), dto.nombre.trim(), dto.lunes, dto.martes, dto.miercoles, dto.jueves,
       dto.viernes, dto.sabado, dto.domingo, nz(dto.horasPorDia)],
    );
    return { id_calendario: filas[0].id_calendario };
  }

  async listarExcepciones(idCalendario: number) {
    return this.dataSource.query(
      `SELECT id, id_calendario, fecha, laborable, horas, motivo
         FROM gpi.calendario_excepcion WHERE id_calendario = $1 ORDER BY fecha`,
      [idCalendario],
    );
  }

  async crearExcepcion(idCalendario: number, dto: CrearExcepcionDto) {
    const filas = await this.dataSource.query(
      `INSERT INTO gpi.calendario_excepcion (id_calendario, fecha, laborable, horas, motivo)
       VALUES ($1,$2::date, COALESCE($3,FALSE), COALESCE($4,0), $5)
       ON CONFLICT (id_calendario, fecha)
       DO UPDATE SET laborable = EXCLUDED.laborable, horas = EXCLUDED.horas, motivo = EXCLUDED.motivo
       RETURNING id`,
      [idCalendario, dto.fecha, dto.laborable, nz(dto.horas), nz(dto.motivo)],
    );
    return { id: filas[0].id };
  }

  async eliminarExcepcion(id: number) {
    await this.dataSource.query(`DELETE FROM gpi.calendario_excepcion WHERE id = $1`, [id]);
    return { ok: true };
  }

  /* ==================== Programacion (calendario + dependencias) ==================== */

  private async cargarCalendario(proyectoId: number): Promise<{ cal: Calendario; exc: Excepciones }> {
    const cals = await this.listarCalendarios(proyectoId);
    let cal: any = cals[0];
    if (!cal) {
      const glob = await this.dataSource.query(
        `SELECT * FROM gpi.calendario WHERE id_proyecto IS NULL ORDER BY id_calendario LIMIT 1`,
      );
      cal = glob[0] ?? {
        lunes: true, martes: true, miercoles: true, jueves: true, viernes: true,
        sabado: false, domingo: false, horas_por_dia: 8,
      };
    }
    const exc: Excepciones = new Map();
    if (cal.id_calendario) {
      const ex = await this.listarExcepciones(cal.id_calendario);
      for (const e of ex) {
        exc.set(String(e.fecha).slice(0, 10), { laborable: !!e.laborable, horas: Number(e.horas) || 0 });
      }
    }
    return { cal, exc };
  }

  /**
   * Recalcula las fechas plan de las actividades usando el calendario
   * (dias laborables, feriados y horas/dia), las horas estimadas y las
   * dependencias (finish-to-start).
   */
  async programar(proyectoId: number, fechaInicio?: string) {
    const { cal, exc } = await this.cargarCalendario(proyectoId);
    const acts = await this.dataSource.query(
      `SELECT id_actividad, tipo, horas_estimadas, orden
         FROM gpi.actividad WHERE id_proyecto = $1 AND activo
        ORDER BY orden, id_actividad`,
      [proyectoId],
    );
    const deps = await this.dataSource.query(
      `SELECT d.id_actividad, d.id_predecesora, d.lag_dias
         FROM gpi.actividad_dependencia d
         JOIN gpi.actividad a ON a.id_actividad = d.id_actividad
        WHERE a.id_proyecto = $1`,
      [proyectoId],
    );
    const proj = await this.obtenerProyecto(proyectoId);
    const ids = acts.map((a: any) => a.id_actividad);
    const orden = ordenTopologico(ids, deps);
    const startDefault = fechaInicio
      ? toIdx(fechaInicio)
      : proj.fecha_ini_plan
        ? toIdx(proj.fecha_ini_plan)
        : toIdx(new Date().toISOString());

    const preds = new Map<number, Array<{ id: number; lag: number }>>();
    for (const d of deps) {
      if (!preds.has(d.id_actividad)) preds.set(d.id_actividad, []);
      preds.get(d.id_actividad)!.push({ id: d.id_predecesora, lag: Number(d.lag_dias) || 0 });
    }

    const ini = new Map<number, number>();
    const fin = new Map<number, number>();
    for (const id of orden) {
      const act = acts.find((a: any) => a.id_actividad === id);
      if (!act) continue;
      let start = startDefault;
      for (const p of preds.get(id) || []) {
        const pf = fin.get(p.id);
        if (pf != null) start = Math.max(start, pf + 1 + p.lag);
      }
      start = nextWorkingIdx(start, cal, exc);
      const horas = Number(act.horas_estimadas) || 0;
      const f = horas > 0 ? consumirHoras(start, horas, cal, exc) : start;
      ini.set(id, start);
      fin.set(id, f);
    }

    await this.dataSource.transaction(async (tx) => {
      for (const id of orden) {
        if (!ini.has(id)) continue;
        await tx.query(
          `UPDATE gpi.actividad SET fecha_ini_plan = $2::date, fecha_fin_plan = $3::date, updated_at = NOW()
            WHERE id_actividad = $1`,
          [id, fromIdx(ini.get(id)!), fromIdx(fin.get(id)!)],
        );
      }
      if (ini.size) {
        const minI = Math.min(...[...ini.values()]);
        const maxF = Math.max(...[...fin.values()]);
        await tx.query(
          `UPDATE gpi.proyecto SET fecha_ini_plan = $2::date, fecha_fin_plan = $3::date, updated_at = NOW()
            WHERE id_proyecto = $1`,
          [proyectoId, fromIdx(minI), fromIdx(maxF)],
        );
      }
    });

    return { programadas: ini.size, actividades: await this.listarActividades(proyectoId) };
  }

  /**
   * Nivelacion de recursos: empuja el exceso de horas de cada recurso a los
   * dias laborables siguientes con capacidad libre (capacidad diaria =
   * capacidad_semanal / 5). Reconstruye `asignacion_horas`.
   */
  async nivelar(proyectoId: number) {
    const { cal, exc } = await this.cargarCalendario(proyectoId);
    const recursos = await this.dataSource.query(
      `SELECT DISTINCT r.id_recurso, r.nombre, r.capacidad_semanal
         FROM gpi.proyecto_miembro m
         JOIN gpi.recurso r ON r.id_recurso = m.id_recurso
        WHERE m.id_proyecto = $1 AND m.activo`,
      [proyectoId],
    );

    let totalBloques = 0;
    const resumen: any[] = [];

    for (const rec of recursos) {
      const cap = (Number(rec.capacidad_semanal) || 40) / 5;
      if (cap <= 0) continue;

      const rows = await this.dataSource.query(
        `SELECT h.id_asignacion, h.fecha, h.horas_estimadas
           FROM gpi.asignacion_horas h
           JOIN gpi.asignacion x ON x.id_asignacion = h.id_asignacion
           JOIN gpi.proyecto_miembro m ON m.id_miembro = x.id_miembro
          WHERE m.id_recurso = $1 AND m.id_proyecto = $2 AND h.horas_estimadas > 0
          ORDER BY h.fecha, h.id`,
        [rec.id_recurso, proyectoId],
      );
      if (!rows.length) continue;

      const byDay = new Map<number, Array<{ id_asignacion: number; horas: number }>>();
      let minIdx = Infinity;
      for (const r of rows) {
        const idx = toIdx(r.fecha);
        minIdx = Math.min(minIdx, idx);
        if (!byDay.has(idx)) byDay.set(idx, []);
        byDay.get(idx)!.push({ id_asignacion: r.id_asignacion, horas: Number(r.horas_estimadas) });
      }
      const maxDay = Math.max(...byDay.keys());

      const result = new Map<string, number>();
      let carry: Array<{ id_asignacion: number; horas: number }> = [];
      let idx = nextWorkingIdx(minIdx, cal, exc);
      let guard = 0;
      while ((idx <= maxDay || carry.length) && guard++ < 100000) {
        const info = diaInfo(idx, cal, exc);
        if (!info.laborable || info.horas <= 0) {
          idx++;
          continue;
        }
        const items = [...(byDay.get(idx) || []), ...carry];
        carry = [];
        let free = cap;
        for (const it of items) {
          if (free <= 0) {
            carry.push(it);
            continue;
          }
          const put = Math.min(it.horas, free);
          if (put > 0) {
            const key = `${it.id_asignacion}|${idx}`;
            result.set(key, (result.get(key) || 0) + put);
          }
          free -= put;
          const resto = it.horas - put;
          if (resto > 0) carry.push({ id_asignacion: it.id_asignacion, horas: resto });
        }
        idx++;
      }

      const asigIds = [...new Set(rows.map((r: any) => r.id_asignacion))];
      if (!asigIds.length) continue;

      await this.dataSource.transaction(async (tx) => {
        await tx.query(`DELETE FROM gpi.asignacion_horas WHERE id_asignacion = ANY($1::int[])`, [asigIds]);
        for (const [key, horas] of result) {
          const [idAsig, idxStr] = key.split('|');
          await tx.query(
            `INSERT INTO gpi.asignacion_horas (id_asignacion, fecha, horas_estimadas)
             VALUES ($1, $2::date, $3)`,
            [Number(idAsig), fromIdx(Number(idxStr)), horas],
          );
        }
        await tx.query(
          `UPDATE gpi.asignacion x
              SET horas_estimadas = (SELECT COALESCE(SUM(h.horas_estimadas),0)
                                       FROM gpi.asignacion_horas h WHERE h.id_asignacion = x.id_asignacion)
            WHERE x.id_asignacion = ANY($1::int[])`,
          [asigIds],
        );
      });

      totalBloques += result.size;
      resumen.push({ recurso: rec.nombre, capacidad_dia: cap, asignaciones: asigIds.length, bloques: result.size });
    }

    await this.dataSource.query(
      `UPDATE gpi.actividad a
          SET horas_estimadas = (SELECT COALESCE(SUM(x.horas_estimadas),0)
                                   FROM gpi.asignacion x WHERE x.id_actividad = a.id_actividad AND x.activo)
        WHERE a.id_proyecto = $1`,
      [proyectoId],
    );

    return { resumen, totalBloques, actividades: await this.listarActividades(proyectoId) };
  }

  /* ==================== Linea base (baseline) ==================== */

  async guardarBaseline(proyectoId: number) {
    await this.obtenerProyecto(proyectoId);
    await this.dataSource.transaction(async (tx) => {
      await tx.query(
        `UPDATE gpi.actividad
            SET fecha_ini_base = fecha_ini_plan, fecha_fin_base = fecha_fin_plan, horas_base = horas_estimadas
          WHERE id_proyecto = $1 AND activo`,
        [proyectoId],
      );
      await tx.query(
        `UPDATE gpi.proyecto
            SET fecha_ini_base = fecha_ini_plan, fecha_fin_base = fecha_fin_plan, baseline_at = NOW()
          WHERE id_proyecto = $1`,
        [proyectoId],
      );
    });
    return { ok: true, actividades: await this.listarActividades(proyectoId) };
  }

  /* ==================== Dashboard / KPIs ==================== */

  async dashboard() {
    const filas = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE activo)::int AS proyectos,
         COUNT(*) FILTER (WHERE activo AND estado = 'en_ejecucion')::int AS en_ejecucion,
         COUNT(*) FILTER (WHERE activo AND estado = 'planificado')::int AS planificados,
         COUNT(*) FILTER (WHERE activo AND estado = 'en_pausa')::int AS en_pausa,
         COUNT(*) FILTER (WHERE activo AND estado = 'cerrado')::int AS cerrados,
         COALESCE(SUM(horas_estimadas) FILTER (WHERE activo), 0)::numeric AS horas_estimadas,
         COALESCE(SUM(horas_reales) FILTER (WHERE activo), 0)::numeric AS horas_reales,
         COALESCE(ROUND(AVG(avance_pct) FILTER (WHERE activo), 1), 0)::numeric AS avance_promedio
       FROM gpi.proyecto`,
    );
    const porEstado = await this.dataSource.query(
      `SELECT estado, COUNT(*)::int AS total FROM gpi.proyecto WHERE activo GROUP BY estado ORDER BY estado`,
    );
    const proyectos = await this.dataSource.query(
      `SELECT id_proyecto, codigo, nombre, estado, horas_estimadas, horas_reales, avance_pct,
              fecha_ini_plan, fecha_fin_plan
         FROM gpi.proyecto WHERE activo ORDER BY codigo`,
    );
    const porRecurso = await this.dataSource.query(
      `SELECT r.nombre AS recurso, COALESCE(SUM(x.horas_estimadas), 0)::numeric AS horas
         FROM gpi.recurso r
         LEFT JOIN gpi.proyecto_miembro m ON m.id_recurso = r.id_recurso AND m.activo
         LEFT JOIN gpi.asignacion x ON x.id_miembro = m.id_miembro AND x.activo
        WHERE r.activo
        GROUP BY r.nombre ORDER BY horas DESC`,
    );
    const actividadesEstado = await this.dataSource.query(
      `SELECT estado, COUNT(*)::int AS total FROM gpi.actividad WHERE activo GROUP BY estado ORDER BY estado`,
    );
    const vencidos = await this.dataSource.query(
      `SELECT codigo, nombre, fecha_fin_plan, avance_pct
         FROM gpi.proyecto
        WHERE activo AND fecha_fin_plan IS NOT NULL AND fecha_fin_plan < CURRENT_DATE
          AND estado NOT IN ('cerrado', 'cancelado')
        ORDER BY fecha_fin_plan`,
    );
    const desviacion = await this.dataSource.query(
      `SELECT p.codigo, p.nombre, (p.fecha_fin_plan - p.fecha_fin_base) AS desviacion_dias
         FROM gpi.proyecto p
        WHERE p.activo AND p.fecha_fin_base IS NOT NULL AND p.fecha_fin_plan IS NOT NULL
          AND p.fecha_fin_plan <> p.fecha_fin_base
        ORDER BY desviacion_dias DESC`,
    );
    const sinAvance = await this.dataSource.query(
      `SELECT codigo, nombre FROM gpi.proyecto
        WHERE activo AND estado = 'en_ejecucion' AND avance_pct = 0 ORDER BY codigo`,
    );
    const sinCalendario = await this.dataSource.query(
      `SELECT p.codigo, p.nombre
         FROM gpi.proyecto p
        WHERE p.activo AND NOT EXISTS (SELECT 1 FROM gpi.calendario c WHERE c.id_proyecto = p.id_proyecto)
        ORDER BY p.codigo`,
    );

    return {
      resumen: filas[0] ?? {},
      porEstado,
      proyectos,
      porRecurso,
      actividadesEstado,
      alertas: { vencidos, desviacion, sinAvance, sinCalendario },
    };
  }
}
