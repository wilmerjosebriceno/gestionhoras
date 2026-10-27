export interface MenuItem {
  label: string;
  route?: string;
  url?: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export interface ModuleMenu {
  sistema: string;
  titulo: string;
  grupos: MenuGroup[];
}

import { environment } from '../../../environments/environment';

/**
 * Base del sistema legacy PHP retirado. Se lee de environment.legacyBaseUrl
 * (vacío en producción) para que los enlaces a módulos aún no portados se
 * oculten automáticamente cuando no exista el sistema /IA.
 */
const BASE = environment.legacyBaseUrl || '';
const legacy = (mod: string, pagina: string) => `${BASE}/${mod}/pages/html/${pagina}`;

export const MENUS: ModuleMenu[] = [
  {
    sistema: 'SEC',
    titulo: 'Seguridad',
    grupos: [
      {
        label: 'Gestión',
        items: [
          { label: 'Usuarios', route: '/sec/usuarios' },
          { label: 'Grupos', route: '/sec/grupos' },
          { label: 'Sistemas', route: '/sec/sistemas' },
          { label: 'Permisos', route: '/sec/permisos' },
          { label: 'Auditoría', route: '/sec/auditoria' },
          { label: 'Cambio de Contraseña', route: '/sec/cambio-password' },
        ],
      },
      {
        label: 'Opciones Legadas',
        items: [
          { label: 'Gestión de Usuarios', url: legacy('sec', 'sec_pro_estatus_usuarios.php') },
          { label: 'Permisos TOP', url: legacy('sec', 'sec_pro_permisos_top.php') },
        ],
      },
    ],
  },
  {
    sistema: 'SGH',
    titulo: 'Gestión de Horas',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Dashboard', route: '/sgh' },
          { label: 'Proyectos', route: '/sgh/proyectos' },
          { label: 'Cronograma', route: '/sgh/cronograma/0' },
          { label: 'Actividades / Horas', route: '/sgh/actividades' },
          { label: 'Estructura de Proyecto', route: '/sgh/estructura' },
          { label: 'Reportes', route: '/sgh/reportes' },
          { label: 'Monitor de Horas', route: '/sgh/monitor-horas' },
          { label: 'Monitor de Horas (Consulta)', route: '/sgh/monitor-horas-consulta' },
          { label: 'Reportes Mantis', route: '/sgh/mantis-reportes' },
        ],
      },
      {
        label: 'Catálogos',
        items: [
          { label: 'Clientes', route: '/sgh/catalogos/clientes' },
          { label: 'Procesos / Módulos', route: '/sgh/catalogos/procesos' },
          { label: 'Ítems de Actividad', route: '/sgh/catalogos/items' },
          { label: 'Categorías', route: '/sgh/catalogos/categorias' },
          { label: 'Tipos de Actividad', route: '/sgh/catalogos/tipos' },
          { label: 'Usuarios SGH', route: '/sgh/catalogos/usuarios' },
          { label: 'Logos de Empresa', route: '/sgh/logos' },
        ],
      },
    ],
  },
  {
    sistema: 'COT',
    titulo: 'Cotizaciones',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Dashboard KPI', route: '/cot/kpis' },
          { label: 'Cotizaciones', route: '/cot' },
        ],
      },
      {
        label: 'Catálogos',
        items: [
          { label: 'Empresas', route: '/cot/catalogos/empresas' },
          { label: 'Clientes', route: '/cot/catalogos/clientes' },
          { label: 'Regiones', route: '/cot/catalogos/regiones' },
          { label: 'Plantillas', route: '/cot/catalogos/plantillas' },
          { label: 'Tasas de IVA', route: '/cot/catalogos/tasas-iva' },
          { label: 'Rangos de Usuarios', route: '/cot/catalogos/rangos' },
          { label: 'Tarifas', route: '/cot/catalogos/tarifas' },
        ],
      },
    ],
  },
  {
    sistema: 'SOP',
    titulo: 'Soporte',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Incidencias / Tickets', route: '/soporte/tickets' },
          { label: 'Dashboard Mantis', route: '/soporte/mantis' },
        ],
      },
    ],
  },
  {
    sistema: 'GPI',
    titulo: 'Proyectos Internos',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Dashboard', route: '/gpi/dashboard' },
          { label: 'Proyectos', route: '/gpi/proyectos' },
        ],
      },
      {
        label: 'Catálogos',
        items: [
          { label: 'Recursos', route: '/gpi/recursos' },
          { label: 'Roles', route: '/gpi/roles' },
        ],
      },
    ],
  },
  {
    sistema: 'SFV',
    titulo: 'Comercial',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Dashboard', url: legacy('sfv', 'sfv_pro_dashboard.php') },
          { label: 'Registro de Clientes', url: legacy('sfv', 'sfv_pro_registro_cliente.php') },
          { label: 'Solicitud de Pedidos', url: legacy('sfv', 'sfv_pro_pedidos_bt.php') },
          { label: 'Cotizaciones', url: legacy('sfv', 'sfv_pro_cotizacion_bt.php') },
          { label: 'Facturación', url: legacy('sfv', 'sfv_pro_factura.php') },
          { label: 'Anulaciones de Facturas', url: legacy('sfv', 'sfv_pro_anular_facturas.php') },
          { label: 'Recibos de Pagos', url: legacy('sfv', 'sfv_pro_pagos.php') },
          { label: 'Anticipos', url: legacy('sfv', 'sfv_pro_anticipo.php') },
          { label: 'Orden de Entrega', url: legacy('sfv', 'sfv_pro_oe.php') },
          { label: 'Guía de Carga', url: legacy('sfv', 'sfv_pro_guia.php') },
        ],
      },
      {
        label: 'Productos - Servicios',
        items: [
          { label: 'Catálogo de Precios', url: legacy('sfv', 'sfv_def_catalogo_precio.php') },
          { label: 'Definición de Conceptos', url: legacy('sfv', 'sfv_def_conceptos.php') },
          { label: 'Actualización de Precios', url: legacy('sfv', 'sfv_pro_precios_update.php') },
        ],
      },
      {
        label: 'Reportes',
        items: [
          { label: 'Resumen de Ventas', url: legacy('sfv', 'sfv_rep_resumen_ventas.php') },
          { label: 'Libro de Ventas', url: legacy('sfv', 'sfv_rep_libro_ventas.php') },
          { label: 'Estado de Cuenta', url: legacy('sfv', 'sfv_rep_edocuenta.php') },
          { label: 'Listado de Clientes', url: legacy('sfv', 'sfv_rep_listado_clientes.php') },
          { label: 'Reporte Integral Ventas', url: legacy('sfv', 'sfv_rep_integral_ventas.php') },
        ],
      },
    ],
  },
  {
    sistema: 'SIV',
    titulo: 'Inventario',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Dashboard', url: legacy('siv', 'siv_pro_dashboard.php') },
          { label: 'Productos', url: legacy('siv', 'siv_pro_product.php') },
          { label: 'Documento de Entrada', url: legacy('siv', 'siv_pro_doc_entrada.php') },
          { label: 'Documento de Transferencia', url: legacy('siv', 'siv_pro_doc_transfer.php') },
          { label: 'Documento de Despacho', url: legacy('siv', 'siv_pro_doc_despacho.php') },
          { label: 'Toma de Inventario', url: legacy('siv', 'siv_pro_toma.php') },
          { label: 'Aprobaciones', url: legacy('siv', 'siv_pro_aprobaciones.php') },
        ],
      },
      {
        label: 'Definiciones',
        items: [
          { label: 'Almacenes', url: legacy('siv', 'siv_def_stores.php') },
          { label: 'Tipos de Almacén', url: legacy('siv', 'siv_def_types_stores.php') },
          { label: 'Ubicaciones', url: legacy('siv', 'siv_def_locations.php') },
          { label: 'Áreas de Almacén', url: legacy('siv', 'siv_def_areas_stores.php') },
          { label: 'Unidades de Medida', url: legacy('siv', 'siv_def_uom.php') },
          { label: 'Tipo de Producto', url: legacy('siv', 'siv_def_type_product.php') },
        ],
      },
    ],
  },
  {
    sistema: 'LAB',
    titulo: 'Laboratorio',
    grupos: [
      {
        label: 'Procesos',
        items: [
          { label: 'Exámenes', url: legacy('lab', 'lab_pro_examenes.php') },
          { label: 'Resultados', url: legacy('lab', 'lab_pro_resultados_sigesp.php') },
          { label: 'Historia SIGESP', url: legacy('lab', 'lab_pro_historia_sigesp.php') },
          { label: 'Gestión (Gráficos)', url: legacy('lab', 'lab_pro_gestion_chart.php') },
        ],
      },
      {
        label: 'Definiciones',
        items: [
          { label: 'Perfiles', url: legacy('lab', 'lab_def_perfiles.php') },
          { label: 'Grupos', url: legacy('lab', 'lab_def_grupos.php') },
          { label: 'Métodos', url: legacy('lab', 'lab_def_metodos.php') },
          { label: 'Muestras', url: legacy('lab', 'lab_def_muestras.php') },
          { label: 'Laboratorios', url: legacy('lab', 'lab_def_laboratorios.php') },
          { label: 'Equipos', url: legacy('lab', 'lab_def_equipos.php') },
        ],
      },
      {
        label: 'Catálogos',
        items: [
          { label: 'Pacientes', url: legacy('lab', 'lab_cat_pacientes.php') },
          { label: 'Médicos', url: legacy('lab', 'lab_cat_medicos.php') },
        ],
      },
    ],
  },
];