# Publicación del proyecto en GitHub

Documento con el procedimiento ejecutado para crear el repositorio Git y subir el proyecto **Gestión de Horas SIGESP**.

## Datos del repositorio

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/wilmerjosebriceno/gestionhoras |
| Rama principal | `main` |
| Commit inicial subido | `43028a1` — *Initial commit: Gestion de Horas SIGESP (backend NestJS + frontend Angular + modulos legados COT/SGH/SEC)* |
| Commit del remoto conservado | `c61333f` — *Initial commit* (solo `README.md`) |
| Archivos rastreados | 6499 |
| Tamaño del paquete Git | ~93.6 MB |
| Visibilidad | Privado |
| Autenticación | HTTPS + Personal Access Token |

## Requisitos previos

- Git instalado (`git --version` → 2.55.0).
- Cuenta de GitHub y un **Personal Access Token (classic)** con permiso `repo`
  (crear en https://github.com/settings/tokens → *Generate new token (classic)*).
- Repositorio creado **vacío** en https://github.com/new (sin README ni licencia).
  *En este caso se creó con README, por eso el remoto ya tenía un commit `c61333f`.*

## Archivos que NO se suben

Se creó un `.gitignore` en la raíz del proyecto para excluir:

- `**/node_modules/` — dependencias.
- `**/dist/`, `**/.angular/cache/`, `**/coverage/` — artefactos de compilación.
- `**/.env` — **contiene credenciales de la base de datos** (se conserva `**/.env.example`).
- `*.zip`, `*.rar`, `*.7z`, `*.tar.gz`, etc. — respaldos.
  > `gestion.zip` pesa **114 MB**; GitHub rechaza archivos mayores a 100 MB.
- `*.log`, temporales (`*.bak`, `*.tmp`) y archivos de sistema/IDE.

Los `.gitignore` propios de `backend/` y `frontend/` también aplican dentro de cada carpeta.

## Comandos ejecutados

Todos desde `C:\xampp7\htdocs\gestionhoras`:

```powershell
cd C:\xampp7\htdocs\gestionhoras

# 1. Inicializar el repositorio local con la rama main
git init -b main

# 2. Preparar todos los archivos (respeta .gitignore)
git add -A

# 3. Crear el commit inicial
git commit -m "Initial commit: Gestion de Horas SIGESP (backend NestJS + frontend Angular + modulos legados COT/SGH/SEC)"

# 4. Asociar el repositorio remoto (origin)
git remote add origin https://github.com/wilmerjosebriceno/gestionhoras.git

# 5. Asegurar el nombre de la rama
git branch -M main

# 6. Primer intento de push (rechazado porque el remoto tenia su propio commit)
git push -u origin main
#    ! [rejected] main -> main (fetch first)

# 7. Traer el commit del remoto e integrarlo reescribiendo la historia local sobre el
git fetch origin
git pull --rebase origin main
#    Successfully rebased and updated refs/heads/main.

# 8. Subir definitivamente
git push -u origin main
#    c61333f..43028a1  main -> main
```

### Verificación final

```powershell
git log --oneline -3
git status -sb
git ls-remote --heads origin
```

Resultado: rama `main` con seguimiento a `origin/main` y el commit `43028a1` publicado.

## Cómo subir cambios en el futuro

```powershell
cd C:\xampp7\htdocs\gestionhoras
git add -A
git commit -m "descripcion del cambio"
git push
```

Si GitHub vuelve a pedir credenciales:
- Usuario: `wilmerjosebriceno`
- Password: el **Personal Access Token** (no la clave de GitHub).

## Solución de problemas

| Problema | Causa / Solución |
|---|---|
| `gh: no se reconoce...` | GitHub CLI no está instalado. No es necesario; se usó Git directamente. |
| `! [rejected] ... (fetch first)` | El repo remoto ya tenía commits. Solución: `git pull --rebase origin main` y luego `git push`. |
| Error por archivo mayor a 100 MB | Ignorarlo en `.gitignore` (en este caso los `.zip`). |
| Pidió usuario y contraseña | Usar el Personal Access Token como contraseña. |
| `.env` subido por error | Nunca ocurrirá: está en `.gitignore`. Si pasara, rotar las credenciales del archivo. |

## Notas

- La base de datos, los `node_modules` y las carpetas `dist` **no** forman parte del repositorio;
  se regeneran/instalan tras clonar (`npm install`, `npm run build`).
- El archivo `.env` debe recrearse manualmente a partir de `backend/.env.example`.
