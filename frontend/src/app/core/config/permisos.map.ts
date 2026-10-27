export interface RutaPermiso {
  sistema: string;
  pagina: string;
}

/**
 * Mapa de rutas Angular del frontend hacia (sistema, pagina).
 * La columna sec_acceso_user.pagina guarda estos identificadores de componente
 * (no el nombre del archivo PHP original).
 */
export const RUTAS_PERMISOS: Record<string, RutaPermiso> = {
  // SEC
  '/sec/usuarios': { sistema: 'SEC', pagina: 'usuarios' },
  '/sec/grupos': { sistema: 'SEC', pagina: 'grupos' },
  '/sec/sistemas': { sistema: 'SEC', pagina: 'sistemas' },
  '/sec/permisos': { sistema: 'SEC', pagina: 'permisos' },
  '/sec/auditoria': { sistema: 'SEC', pagina: 'auditoria' },

  // SGH
  '/sgh': { sistema: 'SGH', pagina: 'dashboard' },
  '/sgh/actividades': { sistema: 'SGH', pagina: 'actividades' },
  '/sgh/proyectos': { sistema: 'SGH', pagina: 'proyectos' },
  '/sgh/cronograma': { sistema: 'SGH', pagina: 'cronograma' },
  '/sgh/estructura': { sistema: 'SGH', pagina: 'estructura' },
  '/sgh/reportes': { sistema: 'SGH', pagina: 'reportes' },
  '/sgh/catalogos/clientes': { sistema: 'SGH', pagina: 'clientes' },
  '/sgh/catalogos/procesos': { sistema: 'SGH', pagina: 'procesos' },
  '/sgh/catalogos/items': { sistema: 'SGH', pagina: 'items' },
  '/sgh/catalogos/categorias': { sistema: 'SGH', pagina: 'categorias' },
  '/sgh/catalogos/tipos': { sistema: 'SGH', pagina: 'tipos' },
  '/sgh/catalogos/usuarios': { sistema: 'SGH', pagina: 'usuarios_sgh' },
  '/sgh/logos': { sistema: 'SGH', pagina: 'logos' },
  '/sgh/monitor-horas': { sistema: 'SGH', pagina: 'monitor_horas' },
  '/sgh/monitor-horas-consulta': { sistema: 'SGH', pagina: 'monitor_horas_consulta' },
  '/sgh/mantis-reportes': { sistema: 'SGH', pagina: 'mantis_reportes' },

  // SOP (Soporte - Incidencias del portal web)
  '/soporte/tickets': { sistema: 'SOP', pagina: 'tickets' },
  '/soporte/mantis': { sistema: 'SOP', pagina: 'mantis' },

  // COT
  '/cot': { sistema: 'COT', pagina: 'cotizaciones' },
  '/cot/kpis': { sistema: 'COT', pagina: 'kpis' },
  '/cot/catalogos/empresas': { sistema: 'COT', pagina: 'empresas' },
  '/cot/catalogos/clientes': { sistema: 'COT', pagina: 'clientes' },
  '/cot/catalogos/regiones': { sistema: 'COT', pagina: 'regiones' },
  '/cot/catalogos/plantillas': { sistema: 'COT', pagina: 'plantillas' },
  '/cot/catalogos/tasas-iva': { sistema: 'COT', pagina: 'tasas-iva' },
  '/cot/catalogos/rangos': { sistema: 'COT', pagina: 'rangos' },
  '/cot/catalogos/tarifas': { sistema: 'COT', pagina: 'tarifas' },

  // GPI (Proyectos Internos)
  '/gpi': { sistema: 'GPI', pagina: 'proyectos' },
  '/gpi/dashboard': { sistema: 'GPI', pagina: 'dashboard' },
  '/gpi/proyectos': { sistema: 'GPI', pagina: 'proyectos' },
  '/gpi/recursos': { sistema: 'GPI', pagina: 'recursos' },
  '/gpi/roles': { sistema: 'GPI', pagina: 'roles' },
};

/**
 * Ordena/coincide la URL actual contra el mapa (maneja rutas con parámetros).
 * Ej: /sgh/actividades/123 -> /sgh/actividades
 */
export function buscarPermisoDeRuta(url: string): RutaPermiso | null {
  const path = url.split('?')[0].replace(/\/+$/, '');
  const partes = path.split('/');

  // Probar coincidencia exacta primero (mas rapida)
  if (RUTAS_PERMISOS[path]) return RUTAS_PERMISOS[path];

  // Probar quitando segmentos finales (rutas con :id, formularios, etc.)
  for (let i = partes.length - 1; i >= 1; i--) {
    const intento = partes.slice(0, i).join('/');
    if (RUTAS_PERMISOS[intento]) return RUTAS_PERMISOS[intento];
  }

  return RUTAS_PERMISOS[path] || null;
}