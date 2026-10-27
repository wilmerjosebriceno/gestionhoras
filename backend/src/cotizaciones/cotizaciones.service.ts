import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { CotClient } from './entities/cot-client.entity';
import { Region } from './entities/region.entity';
import { CotTemplate } from './entities/cot-template.entity';
import { Budget } from './entities/budget.entity';
import { CotDtBudget } from './entities/cot-dt-budget.entity';
import { CotBudgetHistory } from './entities/cot-budget-history.entity';
import { Correlativo } from './entities/cot-correlativo.entity';
import { CotEmpresa } from './entities/cot-empresa.entity';
import { CotTasaIva } from './entities/cot-tasa-iva.entity';
import { CotRangoUsuario } from './entities/cot-rango-usuario.entity';
import { CotTarifa } from './entities/cot-tarifa.entity';
import { CreateBudgetDto, BudgetDetailDto } from './dto/budget.dto';
import { CreateCotClientDto, CreateRegionDto, CreateCotTemplateDto, CreateEmpresaDto, CreateTasaIvaDto, CreateRangoUsuarioDto, CreateTarifaDto } from './dto/master.dto';

const IVA_DEFAULT = 16; // % por defecto cuando la línea no tiene tasa asociada (alícuota más alta)
const ESTADO_ELIMINADA = 4; // borrado lógico de cotizaciones

@Injectable()
export class CotizacionesService {
  constructor(
    @InjectRepository(CotClient) private readonly clientRepo: Repository<CotClient>,
    @InjectRepository(Region) private readonly regionRepo: Repository<Region>,
    @InjectRepository(CotTemplate) private readonly templateRepo: Repository<CotTemplate>,
    @InjectRepository(Budget) private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(CotDtBudget) private readonly dtRepo: Repository<CotDtBudget>,
    @InjectRepository(CotBudgetHistory) private readonly histRepo: Repository<CotBudgetHistory>,
    @InjectRepository(Correlativo) private readonly correlativoRepo: Repository<Correlativo>,
    @InjectRepository(CotEmpresa) private readonly empresaRepo: Repository<CotEmpresa>,
    @InjectRepository(CotTasaIva) private readonly tasaRepo: Repository<CotTasaIva>,
    @InjectRepository(CotRangoUsuario) private readonly rangoRepo: Repository<CotRangoUsuario>,
    @InjectRepository(CotTarifa) private readonly tarifaRepo: Repository<CotTarifa>,
  ) {}

  /* ============ CLIENTE ============ */
  /**
   * Lista los clientes activos. Si recibe `q`, filtra por NOMBRE o RIF
   * (sin distinguir mayusculas y ignorando guiones/puntos del RIF, de modo que
   * buscar "G-20008147-3" tambien encuentra el RIF guardado como "G200081473").
   */
  async listarClientes(q?: string): Promise<CotClient[]> {
    const termino = (q ?? '').trim();
    const qb = this.clientRepo
      .createQueryBuilder('c')
      .where('c.active = :active', { active: 1 })
      .orderBy('c.name_client', 'ASC');

    if (termino) {
      const condiciones = ['c.name_client ILIKE :like', 'c.rif ILIKE :like'];
      const params: Record<string, string> = { like: `%${termino}%` };
      const rifNormalizado = termino.replace(/[^a-zA-Z0-9]/g, '');
      if (rifNormalizado) {
        condiciones.push(
          "regexp_replace(coalesce(c.rif, ''), '[^a-zA-Z0-9]', '', 'g') ILIKE :rifLike",
        );
        params['rifLike'] = `%${rifNormalizado}%`;
      }
      qb.andWhere(`(${condiciones.join(' OR ')})`, params);
    }

    return qb.getMany();
  }

  /**
   * Sincroniza los clientes FORMALES (sgh_client) hacia cot_client.
   * - Inserta los que aun no existen (por id_sgh_client).
   * - Actualiza los existentes con los datos del maestro sgh_client.
   * - Activa los que estaban inactivos y vuelven a existir en sgh_client.
   * No toca los clientes informales (id_sgh_client IS NULL).
   * Como respaldo existe el trigger trg_sincronizar_cot_cliente; este metodo
   * permite una resincronizacion manual completa.
   */
  async sincronizarClientes(): Promise<{ insertados: number; actualizados: number }> {
    const formales: any[] = await this.clientRepo.manager.query(
      `SELECT id_client, rif, name, adress, email, contac_tel, contac_name, active
       FROM public.sgh_client`,
    );
    let insertados = 0;
    let actualizados = 0;
    for (const f of formales) {
      const existe = await this.clientRepo.findOne({ where: { idSghClient: f.id_client } });
      const data = {
        rif: (f.rif || '').slice(0, 50) || null,
        nameClient: (f.name || '').slice(0, 300) || null,
        adressClient: f.adress || null,
        contactName: f.contac_name || null,
        contactPhone: (f.contac_tel || '').slice(0, 100) || null,
        contactEmail: f.email || null,
        active: f.active ?? 1,
        idSghClient: f.id_client,
      };
      if (existe) {
        await this.clientRepo.update({ idClient: existe.idClient }, data);
        actualizados++;
      } else {
        await this.clientRepo.save(this.clientRepo.create(data));
        insertados++;
      }
    }
    return { insertados, actualizados };
  }

  async crearCliente(dto: CreateCotClientDto): Promise<CotClient> {
    const e = this.clientRepo.create({ ...dto, active: dto.active ?? 1 });
    return this.clientRepo.save(e);
  }
  async getCliente(id: number): Promise<CotClient> {
    const c = await this.clientRepo.findOne({ where: { idClient: id }, relations: ['regiones'] });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }
  async actualizarCliente(id: number, dto: Partial<CreateCotClientDto>): Promise<CotClient> {
    const c = await this.clientRepo.findOne({ where: { idClient: id } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    Object.assign(c, dto);
    return this.clientRepo.save(c);
  }
  async eliminarCliente(id: number): Promise<void> {
    const c = await this.clientRepo.findOne({ where: { idClient: id } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    await this.clientRepo.remove(c);
  }

  /* ============ REGION ============ */
  async listarRegiones(incluirInactivos = false): Promise<Region[]> {
    const where: any = {};
    if (!incluirInactivos) where.active = 1;
    return this.regionRepo.find({ where, order: { name: 'ASC' }, relations: ['client'] });
  }
  async crearRegion(dto: CreateRegionDto): Promise<Region> {
    const e = this.regionRepo.create({ ...dto, code: dto.code || null, active: dto.active ?? 1 });
    return this.regionRepo.save(e);
  }
  async actualizarRegion(id: number, dto: Partial<CreateRegionDto>): Promise<Region> {
    const r = await this.regionRepo.findOne({ where: { idRegion: id } });
    if (!r) throw new NotFoundException('Región no encontrada');
    if (dto.idClient !== undefined) r.idClient = dto.idClient;
    if (dto.name !== undefined) r.name = dto.name;
    if (dto.code !== undefined) r.code = dto.code || null;
    if (dto.description !== undefined) r.description = dto.description;
    if (dto.price !== undefined) r.price = Number(dto.price);
    if (dto.priceOnline !== undefined) r.priceOnline = Number(dto.priceOnline);
    if (dto.active !== undefined) r.active = dto.active;
    return this.regionRepo.save(r);
  }
  async eliminarRegion(id: number): Promise<void> {
    const r = await this.regionRepo.findOne({ where: { idRegion: id } });
    if (!r) throw new NotFoundException('Región no encontrada');
    await this.regionRepo.remove(r);
  }

  /* ============ PLANTILLA ============ */
  async listarPlantillas(): Promise<CotTemplate[]> {
    return this.templateRepo.find({ order: { name: 'ASC' } });
  }
  async crearPlantilla(dto: CreateCotTemplateDto): Promise<CotTemplate> {
    return this.templateRepo.save(dto);
  }
  async actualizarPlantilla(id: number, dto: Partial<CreateCotTemplateDto>): Promise<CotTemplate> {
    const t = await this.templateRepo.findOne({ where: { idTemplate: id } });
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    if (dto.code !== undefined) t.code = dto.code;
    if (dto.name !== undefined) t.name = dto.name;
    if (dto.price !== undefined) t.price = Number(dto.price);
    if (dto.hours !== undefined) t.hours = Number(dto.hours);
    return this.templateRepo.save(t);
  }
  async eliminarPlantilla(id: number): Promise<void> {
    const t = await this.templateRepo.findOne({ where: { idTemplate: id } });
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    await this.templateRepo.remove(t);
  }

  /* ============ EMPRESA ============ */
  async listarEmpresas(): Promise<CotEmpresa[]> {
    return this.empresaRepo.find({ order: { company: 'ASC' } });
  }
  async crearEmpresa(dto: CreateEmpresaDto): Promise<CotEmpresa> {
    return this.empresaRepo.save(dto);
  }
  async actualizarEmpresa(id: number, dto: Partial<CreateEmpresaDto>): Promise<CotEmpresa> {
    const e = await this.empresaRepo.findOne({ where: { idEmpresa: id } });
    if (!e) throw new NotFoundException('Empresa no encontrada');
    if (dto.company !== undefined) e.company = dto.company;
    if (dto.telephone !== undefined) e.telephone = dto.telephone;
    if (dto.email !== undefined) e.email = dto.email;
    if (dto.web !== undefined) e.web = dto.web;
    if (dto.logo !== undefined) e.logo = dto.logo;
    if (dto.prefix !== undefined) e.prefix = dto.prefix;
    return this.empresaRepo.save(e);
  }
  async eliminarEmpresa(id: number): Promise<void> {
    const e = await this.empresaRepo.findOne({ where: { idEmpresa: id } });
    if (!e) throw new NotFoundException('Empresa no encontrada');
    await this.empresaRepo.remove(e);
  }

  /* ============ TASAS DE IVA (parámetros) ============ */
  async listarTasas(incluirInactivos = false): Promise<CotTasaIva[]> {
    if (incluirInactivos) return this.tasaRepo.find({ order: { orden: 'ASC', idTasaIva: 'ASC' } });
    return this.tasaRepo.find({ where: { activo: 1 }, order: { orden: 'ASC', idTasaIva: 'ASC' } });
  }
  async actualizarTasa(id: number, dto: Partial<CreateTasaIvaDto>): Promise<CotTasaIva> {
    const t = await this.tasaRepo.findOne({ where: { idTasaIva: id } });
    if (!t) throw new NotFoundException('Tasa de IVA no encontrada');
    if (dto.nombre !== undefined) t.nombre = dto.nombre;
    if (dto.porcentaje !== undefined) t.porcentaje = Number(dto.porcentaje);
    if (dto.activo !== undefined) t.activo = dto.activo;
    if (dto.orden !== undefined) t.orden = dto.orden;
    return this.tasaRepo.save(t);
  }

  /* ============ RANGOS DE USUARIOS ============ */
  async listarRangos(): Promise<CotRangoUsuario[]> {
    return this.rangoRepo.find({ order: { desde: 'ASC' } });
  }
  async crearRango(dto: CreateRangoUsuarioDto): Promise<CotRangoUsuario> {
    return this.rangoRepo.save(this.rangoRepo.create({ ...dto, activo: dto.activo ?? 1 }));
  }
  async actualizarRango(id: number, dto: Partial<CreateRangoUsuarioDto>): Promise<CotRangoUsuario> {
    const r = await this.rangoRepo.findOne({ where: { idRango: id } });
    if (!r) throw new NotFoundException('Rango de usuarios no encontrado');
    if (dto.desde !== undefined) r.desde = Number(dto.desde);
    if (dto.hasta !== undefined) r.hasta = Number(dto.hasta);
    if (dto.descripcion !== undefined) r.descripcion = dto.descripcion;
    if (dto.activo !== undefined) r.activo = dto.activo;
    return this.rangoRepo.save(r);
  }
  async eliminarRango(id: number): Promise<void> {
    const r = await this.rangoRepo.findOne({ where: { idRango: id } });
    if (!r) throw new NotFoundException('Rango de usuarios no encontrado');
    await this.rangoRepo.remove(r);
  }

  /** Devuelve el rango que contiene el número de usuarios indicado. */
  async resolverRango(nroUser: number): Promise<CotRangoUsuario | null> {
    if (nroUser == null) return null;
    return this.rangoRepo.createQueryBuilder('r')
      .where('r.desde <= :nroUser AND :nroUser <= r.hasta', { nroUser })
      .andWhere('r.activo = 1')
      .orderBy('r.desde', 'ASC')
      .getOne();
  }

  /** Resuelve el id del rango a partir de un id explícito o del número de usuarios. */
  private async resolverIdRango(idRango?: number | null, nroUser?: number | null): Promise<number | null> {
    if (idRango != null) return idRango;
    if (nroUser != null) {
      const r = await this.resolverRango(nroUser);
      return r?.idRango ?? null;
    }
    return null;
  }

  /* ============ TARIFAS (región + rango + modalidad) ============ */
  async listarTarifas(incluirInactivos = false): Promise<CotTarifa[]> {
    const where: any = {};
    if (!incluirInactivos) where.activo = 1;
    return this.tarifaRepo.find({ where, relations: ['region', 'rango'], order: { idTarifa: 'ASC' } });
  }
  async crearTarifa(dto: CreateTarifaDto): Promise<CotTarifa> {
    return this.tarifaRepo.save(this.tarifaRepo.create({
      idRegion: dto.idRegion,
      idRango: dto.idRango,
      modalidad: dto.modalidad,
      tarifa: Number(dto.tarifa ?? 0),
      activo: dto.activo ?? 1,
    }));
  }
  async actualizarTarifa(id: number, dto: Partial<CreateTarifaDto>): Promise<CotTarifa> {
    const t = await this.tarifaRepo.findOne({ where: { idTarifa: id } });
    if (!t) throw new NotFoundException('Tarifa no encontrada');
    if (dto.idRegion !== undefined) t.idRegion = Number(dto.idRegion);
    if (dto.idRango !== undefined) t.idRango = Number(dto.idRango);
    if (dto.modalidad !== undefined) t.modalidad = dto.modalidad;
    if (dto.tarifa !== undefined) t.tarifa = Number(dto.tarifa);
    if (dto.activo !== undefined) t.activo = dto.activo;
    return this.tarifaRepo.save(t);
  }
  async eliminarTarifa(id: number): Promise<void> {
    const t = await this.tarifaRepo.findOne({ where: { idTarifa: id } });
    if (!t) throw new NotFoundException('Tarifa no encontrada');
    await this.tarifaRepo.remove(t);
  }

  /**
   * Núcleo del requerimiento: obtiene la tarifa por
   * REGIÓN + RANGO (según el número de usuarios) + MODALIDAD.
   * Se usa al insertar una actividad (línea de cotización).
   */
  async obtenerTarifa(idRegion: number, nroUser: number, modalidad: string): Promise<CotTarifa | null> {
    if (idRegion == null || nroUser == null || !modalidad) return null;
    return this.tarifaRepo.createQueryBuilder('t')
      .innerJoinAndSelect('t.rango', 'r', 'r.desde <= :nroUser AND :nroUser <= r.hasta', { nroUser })
      .leftJoinAndSelect('t.region', 'reg')
      .where('t.id_region = :idRegion', { idRegion })
      .andWhere('t.modalidad = :modalidad', { modalidad: String(modalidad).toUpperCase() })
      .andWhere('t.activo = 1 AND r.activo = 1')
      .getOne();
  }

  /** Resuelve el % de IVA efectivo de una línea a partir de su tasa asociada (o del % legacy). */
  private resolverPorcentaje(d: CotDtBudget, mapTasas: Map<number, number>): number {
    if (d.idTasaIva != null && mapTasas.has(d.idTasaIva)) return Number(mapTasas.get(d.idTasaIva) ?? 0);
    return Number(d.tax ?? IVA_DEFAULT) || 0;
  }

  /** Construye una línea de detalle resolviendo precio, descripción y tasa de IVA desde el catálogo. */
  private async mapearDetalle(d: BudgetDetailDto, idBudget: number, nroUser?: number | null): Promise<CotDtBudget> {
    const e = new CotDtBudget();
    e.idBudget = idBudget;
    e.idTemplate = d.idTemplate;
    e.secuencia = d.secuencia ?? 0;
    e.description = d.description ?? null;
    e.idRegion = d.idRegion ?? null;
    e.modalidad = d.modalidad ?? null;
    e.quantity = Number(d.quantity ?? 0) || 0;
    // IVA: si viene idTasaIva, resolver el % desde el catálogo; si no, usar el % indicado o el default
    if (d.idTasaIva != null) {
      const t = await this.tasaRepo.findOne({ where: { idTasaIva: d.idTasaIva } });
      if (!t) throw new BadRequestException(`La tasa de IVA ${d.idTasaIva} no existe`);
      e.idTasaIva = t.idTasaIva;
      e.tax = Number(t.porcentaje) || 0;
    } else if (d.tax != null) {
      e.tax = Number(d.tax) || 0;
    } else {
      e.tax = IVA_DEFAULT;
    }
    // Plantilla: precio por defecto y autocompletar descripción
    const tpl = await this.templateRepo.findOne({ where: { idTemplate: d.idTemplate } });
    if (!e.description && tpl?.name) e.description = tpl.name;
    // Precio: 1) tarifa (región + rango por nro_user + modalidad); 2) región; 3) plantilla
    let price = Number(d.price ?? 0) || 0;
    const tarifa = await this.obtenerTarifa(d.idRegion as number, nroUser as number, d.modalidad as string);
    if (tarifa) {
      e.idTarifa = tarifa.idTarifa;
      e.tarifaAplicada = Number(tarifa.tarifa);
      price = Number(tarifa.tarifa);
    } else if ((!price || price === 0) && d.idRegion) {
      const reg = await this.regionRepo.findOne({ where: { idRegion: d.idRegion } });
      const esOnline = (d.modalidad || '').toUpperCase() === 'ONLINE';
      price = Number(esOnline ? reg?.priceOnline : reg?.price) || 0;
    }
    if (!price) price = Number(tpl?.price ?? 0) || 0;
    e.price = price;
    return e;
  }

  /* ============ PRESUPUESTO / COTIZACION ============ */
  async listarBudgets(filtros?: {
    status?: number;
    idClient?: number;
    q?: string;
    de?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Budget[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = Math.max(1, filtros?.page ?? 1);
    const limit = Math.min(200, Math.max(1, filtros?.limit ?? 15));

    // Si hay búsqueda por texto, resolver clientes con nombre coincidente (sin join en el budget)
    let clientIds: number[] | null = null;
    if (filtros?.q?.trim()) {
      const found = await this.clientRepo.find({ where: { nameClient: Like(`%${filtros.q.trim()}%`) }, select: ['idClient'] as any });
      clientIds = found.map((c) => c.idClient);
    }

    // build de la consulta sobre cot_budget (sin joins => paginación simple y estable)
    const build = () => {
      const qb = this.budgetRepo.createQueryBuilder('b');
      if (filtros?.status !== undefined) qb.andWhere('b.status = :s', { s: filtros.status });
      else qb.andWhere('(b.status IS NULL OR b.status <> :eliminada)', { eliminada: ESTADO_ELIMINADA });
      if (filtros?.idClient) qb.andWhere('b.id_client = :cid', { cid: filtros.idClient });
      if (filtros?.de) qb.andWhere('b.date_budget >= :de', { de: filtros.de });
      if (filtros?.hasta) qb.andWhere('b.date_budget <= :ha', { ha: filtros.hasta });
      if (filtros?.q?.trim()) {
        const q = `%${filtros.q.trim()}%`;
        if (clientIds && clientIds.length) {
          qb.andWhere('(b.code_budget ILIKE :q OR b.id_client IN (:...cids))', { q, cids: clientIds });
        } else {
          qb.andWhere('b.code_budget ILIKE :q', { q });
        }
      }
      return qb;
    };

    const total = await build().getCount();
    const data = await build()
      .orderBy('b.id_budget', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // cargar clientes en lote y asociarlos
    const pageClientIds = [...new Set(data.map((b) => b.idClient).filter((x): x is number => x != null))];
    if (pageClientIds.length) {
      const clientes = await this.clientRepo.find({ where: { idClient: In(pageClientIds) } });
      const map = new Map(clientes.map((c) => [c.idClient, c]));
      data.forEach((b) => { (b as any).client = b.idClient ? map.get(b.idClient) ?? null : null; });
    }

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Fecha de hoy (yyyy-mm-dd) en hora local. */
  private hoyLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Suma días a una fecha ISO (yyyy-mm-dd) usando componentes locales. */
  private sumarDias(fechaISO?: string | null, dias = 0): string | null {
    if (!fechaISO) return null;
    const d = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + dias);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /**
   * Cotizaciones vencidas y por vencer (para la alerta de entrada a COT).
   * Reglas:
   *  - Solo estados BORRADOR (0) y ENVIADA (1): se excluyen ACEPTADA (2) y RECHAZADA (3).
   *  - Vencidas: vencimiento < HOY y dentro de los ultimos `diasAlerta` (15) días.
   *    Al superar ese lapso dejan de aparecer en esta consulta/alerta.
   *  - Por vencer: vencimiento entre HOY y HOY + `diasPorVencer` (5) días.
   */
  async listarVencidas(diasAlerta = 15, diasPorVencer = 5) {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const base = () => this.budgetRepo.createQueryBuilder('b')
      .where('b.vencimiento IS NOT NULL')
      .andWhere('b.status IN (0, 1)');

    const vencidas = await base()
      .andWhere('b.vencimiento < :hoy', { hoy: fechaHoy })
      .andWhere("b.vencimiento >= (CAST(:hoy AS date) - (:diasAlerta * INTERVAL '1 day'))", { hoy: fechaHoy, diasAlerta })
      .orderBy('b.vencimiento', 'ASC')
      .getMany();

    const porVencer = await base()
      .andWhere('b.vencimiento >= :hoy', { hoy: fechaHoy })
      .andWhere("b.vencimiento <= (CAST(:hoy AS date) + (:diasPorVencer * INTERVAL '1 day'))", { hoy: fechaHoy, diasPorVencer })
      .orderBy('b.vencimiento', 'ASC')
      .getMany();

    // Cargar clientes en lote
    const ids = [...new Set([...vencidas, ...porVencer].map((b) => b.idClient).filter((x): x is number => x != null))];
    if (ids.length) {
      const clientes = await this.clientRepo.find({ where: { idClient: In(ids) } });
      const map = new Map(clientes.map((c) => [c.idClient, c]));
      [...vencidas, ...porVencer].forEach((b) => {
        (b as any).client = b.idClient ? map.get(b.idClient) ?? null : null;
        (b as any).dias = this.diferenciaDias(fechaHoy, b.vencimiento);
      });
    } else {
      [...vencidas, ...porVencer].forEach((b) => {
        (b as any).dias = this.diferenciaDias(fechaHoy, b.vencimiento);
      });
    }

    return {
      hoy: fechaHoy,
      vencidas,
      porVencer,
      totalVencidas: vencidas.length,
      totalPorVencer: porVencer.length,
    };
  }

  /** Días de diferencia (hoy - fecha). Positivo = vencida, negativo = días restantes. */
  private diferenciaDias(hoyISO: string, fechaISO?: string | null): number {
    if (!fechaISO) return 0;
    const a = new Date(`${hoyISO}T00:00:00`).getTime();
    const b = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00`).getTime();
    return Math.round((a - b) / 86400000);
  }

  /* ============ KPIs DASHBOARD ============ */  async obtenerKpis(filtros?: { de?: string; hasta?: string; idEmpresa?: number; idClient?: number }) {
    // Base de consulta (filtra por empresa, cliente y rango de fechas)
    const base = () => this.budgetRepo.createQueryBuilder('b')
      .where('(b.status IS NULL OR b.status <> :eliminada)', { eliminada: ESTADO_ELIMINADA })
      .andWhere(filtros?.idEmpresa ? 'b.id_empresa = :emp' : '1=1', { emp: filtros?.idEmpresa })
      .andWhere(filtros?.idClient ? 'b.id_client = :cli' : '1=1', { cli: filtros?.idClient })
      .andWhere(filtros?.de ? 'b.date_budget >= :de' : '1=1', { de: filtros?.de })
      .andWhere(filtros?.hasta ? 'b.date_budget <= :ha' : '1=1', { ha: filtros?.hasta });

    // Totales + por estado
    const resumen = await base()
      .select('COUNT(*)::int', 'total')
      .addSelect('COALESCE(SUM(b.montototal),0)', 'monto')
      .addSelect('SUM(CASE WHEN b.status = 1 THEN 1 ELSE 0 END)::int', 'enviadas')
      .addSelect('SUM(CASE WHEN b.status = 2 THEN 1 ELSE 0 END)::int', 'aceptadas')
      .addSelect('SUM(CASE WHEN b.status = 3 THEN 1 ELSE 0 END)::int', 'rechazadas')
      .addSelect('SUM(CASE WHEN b.status = 0 THEN 1 ELSE 0 END)::int', 'borrador')
      .addSelect('SUM(CASE WHEN b.status = 2 THEN b.montototal ELSE 0 END)', 'montoAceptado')
      .addSelect('COALESCE(SUM(b.total_usd),0)', 'montoUsd')
      .getRawOne();

    const total = Number(resumen?.total ?? 0);
    const enviadas = Number(resumen?.enviadas ?? 0);
    const aceptadas = Number(resumen?.aceptadas ?? 0);
    const montoAceptado = Number(resumen?.montoAceptado ?? 0);

    const porEstado = await base()
      .select('b.status', 'status')
      .addSelect('COUNT(*)::int', 'cantidad')
      .addSelect('COALESCE(SUM(b.montototal),0)', 'monto')
      .groupBy('b.status')
      .orderBy('b.status', 'ASC')
      .getRawMany();

    const tendencia = await base()
      .select("TO_CHAR(b.date_budget, 'YYYY-MM')", 'mes')
      .addSelect('COUNT(*)::int', 'cantidad')
      .addSelect('COALESCE(SUM(b.montototal),0)', 'monto')
      .addSelect('COALESCE(SUM(b.total_usd),0)', 'montoUsd')
      .andWhere('b.date_budget IS NOT NULL')
      .groupBy('mes')
      .orderBy('mes', 'ASC')
      .getRawMany();

    const topClientes = await base()
      .leftJoin('b.client', 'c')
      .select('c.name_client', 'cliente')
      .addSelect('COUNT(*)::int', 'cantidad')
      .addSelect('COALESCE(SUM(b.montototal),0)', 'monto')
      .addSelect('COALESCE(SUM(b.total_usd),0)', 'montoUsd')
      .where('c.id_client IS NOT NULL')
      .groupBy('c.name_client')
      .orderBy('cantidad', 'DESC')
      .addOrderBy('monto', 'DESC')
      .limit(5)
      .getRawMany();

    const porRegion = await this.dtRepo.createQueryBuilder('d')
      .innerJoin('d.region', 'r')
      .innerJoin('d.budget', 'b')
      .where(filtros?.idEmpresa ? 'b.id_empresa = :emp' : '1=1', { emp: filtros?.idEmpresa })
      .andWhere(filtros?.idClient ? 'b.id_client = :cli' : '1=1', { cli: filtros?.idClient })
      .andWhere(filtros?.de ? 'b.date_budget >= :de' : '1=1', { de: filtros?.de })
      .andWhere(filtros?.hasta ? 'b.date_budget <= :ha' : '1=1', { ha: filtros?.hasta })
      .select('r.name', 'region')
      .addSelect('COUNT(DISTINCT b.id_budget)::int', 'cotizaciones')
      .addSelect('COUNT(*)::int', 'lineas')
      .addSelect('COALESCE(SUM(d.quantity),0)', 'horas')
      .addSelect('COALESCE(SUM(d.subtotal),0)', 'monto')
      .groupBy('r.name')
      .orderBy('monto', 'DESC')
      .limit(8)
      .getRawMany();

    const topPlantillas = await this.dtRepo.createQueryBuilder('d')
      .innerJoin('d.template', 't')
      .innerJoin('d.budget', 'b')
      .where(filtros?.idEmpresa ? 'b.id_empresa = :emp' : '1=1', { emp: filtros?.idEmpresa })
      .andWhere(filtros?.idClient ? 'b.id_client = :cli' : '1=1', { cli: filtros?.idClient })
      .andWhere(filtros?.de ? 'b.date_budget >= :de' : '1=1', { de: filtros?.de })
      .andWhere(filtros?.hasta ? 'b.date_budget <= :ha' : '1=1', { ha: filtros?.hasta })
      .select('t.code', 'codigo')
      .addSelect('t.name', 'plantilla')
      .addSelect('COUNT(*)::int', 'veces')
      .addSelect('COALESCE(SUM(d.quantity),0)', 'horas')
      .addSelect('COALESCE(SUM(d.subtotal),0)', 'monto')
      .groupBy('t.code, t.name')
      .orderBy('veces', 'DESC')
      .addOrderBy('monto', 'DESC')
      .limit(5)
      .getRawMany();

    const ultimas = await base()
      .leftJoinAndSelect('b.client', 'c2')
      .orderBy('b.id_budget', 'DESC')
      .limit(6)
      .getMany();

    return {
      total,
      enviadas,
      aceptadas,
      rechazadas: Number(resumen?.rechazadas ?? 0),
      borradores: Number(resumen?.borrador ?? 0),
      monto: Number(resumen?.monto ?? 0),
      montoUsd: Number(resumen?.montoUsd ?? 0),
      montoAceptado,
      tasaAceptacion: enviadas > 0 ? Number(((aceptadas / enviadas) * 100).toFixed(1)) : 0,
      porcentajeAceptado: total > 0 ? Number(((aceptadas / total) * 100).toFixed(1)) : 0,
      ticketPromedio: total > 0 ? Number((Number(resumen?.monto ?? 0) / total).toFixed(2)) : 0,
      porEstado,
      tendencia,
      topClientes,
      topPlantillas,
      porRegion,
      ultimas,
    };
  }

  async getBudget(id: number): Promise<Budget> {
    const b = await this.budgetRepo.findOne({ where: { idBudget: id }, relations: ['client'] });
    if (!b) throw new NotFoundException('CotizaciÃ³n no encontrada');
    const detalles = await this.dtRepo.find({ where: { idBudget: id }, order: { secuencia: 'ASC' }, relations: ['template', 'region', 'tasaIva'] });
    const historial = await this.histRepo.find({ where: { idBudget: id }, order: { idHistory: 'DESC' } });
    (b as any).detalles = detalles;
    (b as any).historial = historial;
    return b;
  }

  async crearBudget(dto: CreateBudgetDto, login?: string): Promise<Budget> {
    const idEmpresa = dto.idEmpresa ?? 1; // por defecto SIGESP
    // Si no se envÃ­a un codeBudget explÃ­cito, se genera el secuencial "AÃ‘O-NNNNNN" por empresa
    const code = dto.codeBudget && dto.codeBudget.trim() ? dto.codeBudget : await this.generarCodigoSecuencial(idEmpresa);
    const dateBudget = dto.dateBudget || new Date().toISOString().slice(0, 10);
    const nroUser = dto.nroUser ?? null;
    const idRango = await this.resolverIdRango(dto.idRango, nroUser);
    const b = this.budgetRepo.create({
      codeBudget: code,
      dateBudget,
      // Vencimiento por defecto: fecha de emisión + 30 días (editable)
      vencimiento: dto.vencimiento || this.sumarDias(dateBudget, 30),
      hourBudget: dto.hourBudget || new Date().toTimeString().slice(0, 8),
      usuario: login ?? null,
      note: dto.note ?? null,
      soporte: dto.soporte ?? 'INCLUYE UN (1) MES DE MANTENIMIENTO SOPORTE ONLINE.',
      modalidad: dto.modalidad ?? 'FORMA DE PAGO: El 20 % con la instalación del comité de implantación y el SIGESP ERP en el servidor de INVEVAL, 30% con la configuración y migración de datos de maestros básicos, adecuación de formatos básicos, y el 50% con la capacitación simulada y en vivo.',
      idClient: dto.idClient ?? null,
      idEmpresa,
      nroUser,
      idRango,
      status: dto.status ?? 0,
      emailSent: 0,
      tasaBcv: dto.tasaBcv ?? 0,
    });
    const guardado = await this.budgetRepo.save(b);

    if (dto.detalles?.length) {
      const dets = dto.detalles.map((d) => this.mapearDetalle(d, guardado.idBudget, nroUser));
      await this.dtRepo.save(await Promise.all(dets));
      await this.recalcular(guardado.idBudget);
    }
    return this.getBudget(guardado.idBudget);
  }

  async recalcular(id: number): Promise<Budget> {
    const b = await this.budgetRepo.findOne({ where: { idBudget: id } });
    if (!b) throw new NotFoundException('Cotización no encontrada');
    const dets = await this.dtRepo.find({ where: { idBudget: id } });
    const tasas = await this.tasaRepo.find();
    const mapTasas = new Map<number, number>();
    tasas.forEach((t) => mapTasas.set(t.idTasaIva, Number(t.porcentaje) || 0));

    let subtotalTotal = 0;
    let exento = 0;
    let baseImponible = 0;
    let ivaTotal = 0;
    const nroUser = b.nroUser ?? null;
    for (const d of dets) {
      // Recalcula el precio con la tarifa vigente (región + rango + modalidad) cuando hay nro_user.
      if (nroUser != null) {
        const tarifa = await this.obtenerTarifa(d.idRegion as number, nroUser, d.modalidad as string);
        if (tarifa) {
          d.idTarifa = tarifa.idTarifa;
          d.tarifaAplicada = Number(tarifa.tarifa);
          d.price = Number(tarifa.tarifa);
        }
      }
      const sub = Number(d.quantity ?? 0) * Number(d.price ?? 0);
      const porc = this.resolverPorcentaje(d, mapTasas);
      const tax = porc === 0 ? 0 : sub * (porc / 100);
      d.subtotal = sub;
      d.amountTax = tax;
      d.total = sub + tax;
      subtotalTotal += sub;
      if (porc === 0) exento += sub;
      else { baseImponible += sub; ivaTotal += tax; }
      await this.dtRepo.save(d);
    }

    // Totalizadores de la cotización: EXENTO separado, IVA solo sobre la base imponible
    const montoSubtotal = subtotalTotal;
    const montoExento = exento;
    const montoBaseImponible = baseImponible;
    const montoIva = ivaTotal;
    const montoTotal = montoBaseImponible + montoIva;

    b.montoSubtotal = montoSubtotal;
    b.montoExento = montoExento;
    b.montoBaseImponible = montoBaseImponible;
    b.montoIva = montoIva;
    b.montoTotal = montoTotal;

    b.totalUsd = montoTotal;
    b.ivaUsd = montoIva;

    return this.budgetRepo.save(b);
  }

  async cambiarEstado(id: number, status: number, login?: string): Promise<Budget> {
    const b = await this.budgetRepo.findOne({ where: { idBudget: id } });
    if (!b) throw new NotFoundException('CotizaciÃ³n no encontrada');
    b.status = status;
    await this.budgetRepo.save(b);
    await this.histRepo.save(this.histRepo.create({ idBudget: id, dateChange: new Date() as any, usuario: login ?? null, note: `Cambio de estado a ${status}` }));
    return this.getBudget(id);
  }

  /** Actualiza cabecera y reemplaza los detalles de una cotizaciÃ³n existente. */
  async actualizarBudget(id: number, dto: CreateBudgetDto, login?: string): Promise<Budget> {
    const b = await this.budgetRepo.findOne({ where: { idBudget: id } });
    if (!b) throw new NotFoundException('CotizaciÃ³n no encontrada');

    b.codeBudget = dto.codeBudget ?? b.codeBudget;
    b.dateBudget = dto.dateBudget ?? b.dateBudget;
    if (dto.vencimiento !== undefined) b.vencimiento = dto.vencimiento;
    else if (!b.vencimiento && b.dateBudget) b.vencimiento = this.sumarDias(b.dateBudget, 30);
    b.note = dto.note ?? b.note;
    b.soporte = dto.soporte ?? b.soporte;
    b.modalidad = dto.modalidad ?? b.modalidad;
    b.idClient = dto.idClient ?? b.idClient;
    b.idEmpresa = dto.idEmpresa ?? b.idEmpresa;
    if (dto.nroUser !== undefined) b.nroUser = dto.nroUser;
    b.idRango = await this.resolverIdRango(dto.idRango, b.nroUser);
    b.status = dto.status ?? b.status;
    b.tasaBcv = dto.tasaBcv ?? b.tasaBcv;
    await this.budgetRepo.save(b);

    // Reemplaza detalles: borra los existentes y recrea
    const existentes = await this.dtRepo.find({ where: { idBudget: id } });
    if (existentes.length) await this.dtRepo.remove(existentes);

    if (dto.detalles?.length) {
      const dets = dto.detalles.map((d) => this.mapearDetalle(d, id, b.nroUser));
      await this.dtRepo.save(await Promise.all(dets));
    }
    await this.recalcular(id);
    await this.histRepo.save(this.histRepo.create({ idBudget: id, dateChange: new Date() as any, usuario: login ?? null, note: 'CotizaciÃ³n actualizada' }));
    return this.getBudget(id);
  }

  async eliminarBudget(id: number, login?: string): Promise<Budget> {
    const b = await this.budgetRepo.findOne({ where: { idBudget: id } });
    if (!b) throw new NotFoundException('Cotización no encontrada');
    // Borrado lógico: no se elimina físicamente, se marca con el estatus ELIMINADA.
    b.status = ESTADO_ELIMINADA;
    await this.budgetRepo.save(b);
    await this.histRepo.save(this.histRepo.create({ idBudget: id, dateChange: new Date() as any, usuario: login ?? null, note: 'Cotización marcada como ELIMINADA (borrado lógico)' }));
    return this.getBudget(id);
  }

  /**
   * Duplica una cotización existente como una NUEVA en estado BORRADOR.
   * Copia cabecera (cliente, empresa, tasa BCV, nota, soporte, modalidad) y
   * todas las líneas (plantilla, región, modalidad, horas, precio, IVA, descripción).
   * No copia: número, fechas, estado, historial ni el flag de correo enviado.
   */
  async duplicarBudget(id: number, login?: string): Promise<Budget> {
    const origen = await this.budgetRepo.findOne({ where: { idBudget: id } });
    if (!origen) throw new NotFoundException('Cotización no encontrada');
    const detalles = await this.dtRepo.find({ where: { idBudget: id }, order: { secuencia: 'ASC' } });

    const idEmpresa = origen.idEmpresa ?? 1;
    const code = await this.generarCodigoSecuencial(idEmpresa);
    const hoy = this.hoyLocal();

    const nueva = this.budgetRepo.create({
      codeBudget: code,
      dateBudget: hoy,
      vencimiento: this.sumarDias(hoy, 30),
      hourBudget: new Date().toTimeString().slice(0, 8),
      usuario: login ?? null,
      note: origen.note ?? null,
      soporte: origen.soporte ?? null,
      modalidad: origen.modalidad ?? null,
      idClient: origen.idClient ?? null,
      idEmpresa,
      status: 0,
      emailSent: 0,
      tasaBcv: origen.tasaBcv ?? 0,
    });
    const guardado = await this.budgetRepo.save(nueva);

    if (detalles.length) {
      const copias = detalles.map((d) => {
        const n = new CotDtBudget();
        n.idBudget = guardado.idBudget;
        n.idTemplate = d.idTemplate;
        n.secuencia = d.secuencia ?? 0;
        n.description = d.description ?? null;
        n.quantity = Number(d.quantity ?? 0) || 0;
        n.price = Number(d.price ?? 0) || 0;
        n.tax = Number(d.tax ?? 0) || 0;
        n.idRegion = d.idRegion ?? null;
        n.idTasaIva = d.idTasaIva ?? null;
        n.modalidad = d.modalidad ?? null;
        return n;
      });
      await this.dtRepo.save(copias);
      await this.recalcular(guardado.idBudget);
    }

    await this.histRepo.save(this.histRepo.create({ idBudget: id, dateChange: new Date() as any, usuario: login ?? null, note: `Cotización duplicada como ${code}` }));
    await this.histRepo.save(this.histRepo.create({ idBudget: guardado.idBudget, dateChange: new Date() as any, usuario: login ?? null, note: `Creada a partir de ${origen.codeBudget}` }));
    return this.getBudget(guardado.idBudget);
  }

  async registrarHistorial(id: number, nota: string, login?: string): Promise<void> {    await this.histRepo.save(this.histRepo.create({ idBudget: id, dateChange: new Date() as any, usuario: login ?? null, note: nota }));
  }

  /**
   * Genera el numero de cotizacion secuencial con formato "AÃ‘O-NNNNNN" basado
   * en EMPRESA + AÃ‘O. Usa la tabla cot_correlativo (una fila por anio+empresa).
   * El contador se incrementa de forma atomica con un lock de fila
   * (pessimistic_write) para evitar duplicados. Si el par no existe, se crea.
   */
  private async generarCodigoSecuencial(idEmpresa: number): Promise<string> {
    const anio = new Date().getFullYear();
    const manager = this.correlativoRepo.manager;
    const correlativo = await manager.transaction(async (tx) => {
      const repo = tx.getRepository(Correlativo);
      const fila = await repo.findOne({
        where: { anio, idEmpresa },
        lock: { mode: 'pessimistic_write' },
      });
      let actual = fila ? fila.current : 0;
      actual = actual + 1;
      if (fila) {
        fila.current = actual;
        await repo.save(fila);
      } else {
        await repo.save(repo.create({ anio, idEmpresa, current: actual }));
      }
      return actual;
    });

    return `${anio}-${String(correlativo).padStart(6, '0')}`;
  }
}