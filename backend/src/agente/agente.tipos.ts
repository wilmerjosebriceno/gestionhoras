export type RolMensaje = 'system' | 'user' | 'assistant' | 'tool';

export interface LlamadaHerramienta {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MensajeLlm {
  role: RolMensaje;
  content: string | null;
  tool_calls?: LlamadaHerramienta[];
  tool_call_id?: string;
  name?: string;
}

export interface ContextoHerramienta {
  login: string;
  idUsuario?: number;
}

export interface DefinicionHerramienta {
  name: string;
  description: string;
  parameters: Record<string, any>;
  /** Módulo del árbol de permisos requerido (ej. 'SGH', 'COT'). */
  sistema: string;
  /** Página/componente del árbol de permisos requerido (ej. 'actividades'). */
  pagina: string;
  execute: (args: any, ctx: ContextoHerramienta) => Promise<any>;
}
