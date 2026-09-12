# Instalación del Sistema Gestión de Horas SIGESP

Guía de instalación del **frontend** (Angular) y **backend** (NestJS) en **Debian 12** y **Windows**.

**Escenario verificado:** VPS con **Apache en el puerto 80** (con PHP) y el sistema de horas servido por **Nginx en el puerto 8080**.

| Componente | Tecnología | Puerto |
|---|---|---|
| Apache (PHP, sistema legacy) | Apache | `80` |
| Nginx (sistema de horas) | Angular | `8080` |
| Backend (API) | NestJS / Node.js | `3000` (Swagger en `/api/docs`) |
| Base de datos | PostgreSQL | `5432` (o el que configures) |

> **Importante:** los `node_modules` son específicos de plataforma (módulos nativos como `bcrypt`). **No copies `node_modules` de una máquina a otra; ejecuta `npm install` en el destino.**

---

## 0. Requisitos

- **Node.js 20 LTS o 22 LTS** + npm ≥ 10.
- **PostgreSQL 13 o superior**.
- **Nginx** (recomendado, para servir el frontend y hacer proxy a la API).
- **PM2** (recomendado, para mantener el backend activo).
- (Windows) PowerShell para los comandos de arranque.

---

## 1. Base de datos

### 1.1 Crear la base y el usuario

**Debian 12:**
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql <<'EOF'
CREATE ROLE sigesp LOGIN PASSWORD 'TU_CLAVE_FORTE';
CREATE DATABASE db_gestionhoras_sigesp OWNER sigesp;
\q
EOF
```

**Windows:**
Instala PostgreSQL desde https://www.postgresql.org/download/windows/ (usa el instalador; anota el puerto y la clave de `postgres`). Luego desde `psql`:
```sql
CREATE ROLE sigesp LOGIN PASSWORD 'TU_CLAVE_FORTE';
CREATE DATABASE db_gestionhoras_sigesp OWNER sigesp;
```

### 1.2 Migración de la base

Ejecuta `migracion_seguridad_v2.sql` (crea la estructura de seguridad V2, el módulo COT con tablas `cot_*`, las tablas del cronograma `s_cron_*` y el trigger de sincronización de clientes formales).

**Debian:**
```bash
psql -h localhost -U postgres -d db_gestionhoras_sigesp -v ON_ERROR_STOP=1 -f migracion_seguridad_v2.sql
```

**Windows (PowerShell):**
```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d db_gestionhoras_sigesp -v ON_ERROR_STOP=1 -f migracion_seguridad_v2.sql
```

> La migración deja todos los usuarios con clave **`123`** (BCrypt). Usuarios iniciales: `admin` / `123` y `sigesp` (con acceso a COT).

---

## 2. Backend (NestJS)

### 2.1 Instalar dependencias y compilar

**Debian:**
```bash
cd /var/www/html/apisigesp/backend
npm install
npm run build        # genera dist/
ls dist/main.js
```

**Windows (PowerShell):**
```powershell
cd C:\xampp7\htdocs\gestionhoras\backend
npm install
npm run build
```

### 2.2 Crear el archivo `.env`

Copia `.env.example` → `.env` y ajusta. Variables usadas por el código:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_gestionhoras_sigesp
DB_USER=sigesp
DB_PASSWORD=TU_CLAVE_FORTE
DB_SSL=false

# JWT (usa secretos aleatorios largos)
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<otro aleatorio>
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# CORS (dominio real; en same-origin por Nginx no es crítico)
CORS_ORIGIN=http://localhost:4300

# Throttling
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

> **Importante:** el código trae valores por defecto de Windows (`DB_PORT=5434`, `DB_NAME=db_labv5_comercial`, `JWT_SECRET` dev). **Cámbialos en `.env`** para que coincidan con tu PostgreSQL.

### 2.3 Recursos en disco (rutas portables)

El backend lee archivos desde `process.cwd()` (el directorio donde lanzas el proceso). Deben existir:

```bash
cd backend
mkdir -p storage/firmas storage/logos storage/logos-legacy
ls permisos/xml/      # sec_arbol_*.xml
ls ayuda/ayuda.json   # ayuda en línea
```

### 2.4 Ejecutar

**Debian (PM2):**
```bash
sudo npm install -g pm2
cd /var/www/html/apisigesp/backend
pm2 start dist/main.js --name sigesp-api
pm2 startup systemd    # copia y ejecuta la línea que imprime
pm2 save
```

**Debian (systemd)** — `/etc/systemd/system/sigesp-api.service`:
```ini
[Unit]
Description=SIGESP API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/var/www/html/apisigesp/backend
ExecStart=/usr/bin/node /var/www/html/apisigesp/backend/dist/main.js
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now sigesp-api
```

**Windows (PowerShell):**
```powershell
cd C:\xampp7\htdocs\gestionhoras\backend
node dist/main.js
# o en segundo plano:
Start-Process cmd /c "node dist/main.js > backend.log 2>&1"
```

Verifica: `curl http://localhost:3000/api/docs` (Swagger).

---

## 3. Frontend (Angular)

### 3.1 Instalar y compilar

**Debian:**
```bash
cd /var/www/html/apisigesp/frontend
npm install
npm run build        # producción -> dist/frontend/browser
ls dist/frontend/browser/index.html
```

**Windows:**
```powershell
cd C:\xampp7\htdocs\gestionhoras\frontend
npm install
npm run build
```

- `environment.prod.ts` ya trae `apiUrl: '/api/v1'` y `legacyBaseUrl: ''`. No requiere cambios.

### 3.2 Servir (Debian 12 con Nginx, junto a Apache en el 80)

> Como Apache ya usa el puerto 80, **Nginx escucha en el 8080**. Si al instalar Nginx decía *"port 80 is already in use"*, es normal; no se detuvo porque Apache lo ocupa.

Crea `/etc/nginx/sites-available/sigesp`:

```nginx
server {
    listen 8080;                     # NO usar 80 (lo ocupa Apache)
    server_name tu-dominio.com;      # o la IP del VPS

    root /var/www/html/apisigesp/frontend/dist/frontend/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Opcional: si el frontend pide /storage/* (logos, firmas)
    # location /storage/ {
    #     alias /var/www/html/apisigesp/backend/storage/;
    # }
}
```

Activa (y quita el sitio `default` que intenta usar el 80):
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/sigesp /etc/nginx/sites-enabled/sigesp
sudo nginx -t
sudo nginx          # o: sudo systemctl start nginx
```

Abre el puerto en el firewall:
```bash
sudo ufw allow 8080/tcp
```

Permisos de la carpeta del build (Nginx usa el usuario `www-data`):
```bash
sudo chown -R www-data:www-data /var/www/html/apisigesp/frontend/dist
sudo chmod -R 755 /var/www/html/apisigesp/frontend/dist
```

> Si `nginx -s reload` da `open() "/run/nginx.pid" failed`, es porque Nginx no está corriendo. Arrácalo primero con `sudo nginx` (o `sudo systemctl start nginx`).

HTTPS (opcional):
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

### 3.3 Servir en Windows

**Modo desarrollo (con proxy):**
```powershell
cd C:\xampp7\htdocs\gestionhoras\frontend
ng serve            # http://localhost:4300  (usa proxy.conf.js -> /api a 3000)
```

**Modo producción (servir el build estático):**
El `dist/frontend/browser` es estático. Puedes servirlo con:
```powershell
npx http-server dist/frontend/browser -p 8080
```
Pero **necesitas un proxy** que reenvíe `/api` al backend (3000). Opciones:
- **IIS**: crear un sitio con la carpeta del build y una regla de reescritura/proxy a `http://localhost:3000` (requiere el módulo `Application Request Routing`).
- **node estático + proxy**: un pequeño servidor Express que sirva la carpeta y reenvíe `/api`.
- **ng serve en dev** para pruebas locales (el proxy ya está configurado).

> En producción **no** uses `ng serve`; sirve el build con un servidor web y un proxy `/api` → 3000.

---

## 4. Verificación

```bash
# Backend vivo (Swagger)
curl http://localhost:3000/api/docs

# Frontend servido por Nginx (8080)
curl -I http://localhost:8080/            # 200 OK

# Login a través del proxy (API responde)
curl -X POST http://localhost:8080/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"login":"admin","password":"123"}'
```

Abre en el navegador `http://IP_O_DOMINIO:8080`, inicia sesión (`admin` / `123`) y navega a los módulos **Seguridad (SEC)**, **Gestión de Horas (SGH)** y **Cotizaciones (COT)**.

---

## 5. Estructura desplegada

```
/var/www/html/apisigesp/
├── backend/
│   ├── dist/main.js
│   ├── .env
│   ├── permisos/xml/sec_arbol_*.xml
│   ├── ayuda/ayuda.json
│   └── storage/{firmas,logos,logos-legacy}
└── frontend/
    └── dist/frontend/browser/    (servido por Nginx en el 8080)
```

---

## 6. Solución de problemas

| Problema | Causa / solución |
|---|---|
| `ECONNREFUSED` a la BD | Revisa `.env` (`DB_HOST/PORT/USER/PASSWORD`) y que PostgreSQL esté activo. |
| Nginx `500` al cargar la página | El `root` no coincide con la ruta del build. Verifica que apunte a `/var/www/html/apisigesp/frontend/dist/frontend/browser` y que exista `index.html`; además permisos `www-data`. |
| `Not attempting to start NGINX, port 80 is already in use` | Es normal con Apache en el 80. Usa `listen 8080;` y quita el sitio `default` (`sudo rm -f /etc/nginx/sites-enabled/default`). |
| `nginx -s reload: open() "/run/nginx.pid" failed` | Nginx no está corriendo. Arrácalo con `sudo nginx` (o `sudo systemctl start nginx`). |
| `Could not execute systemctl` al instalar | Sin systemd como PID 1 (contenedor/WSL). Usa `service nginx start` o `sudo nginx`; el paquete se instaló igual. |
| `/api` responde `404` | Falta el `location /api/` en Nginx o el proxy apunta mal. |
| Rutas SPA (`/sgh/...`) dan `404` | Falta `try_files $uri $uri/ /index.html;`. |
| Error `Cursor could not be found for the async connection` en pgAdmin | Es un fallo de pgAdmin al ejecutar el script con `BEGIN/COMMIT` + `DO`. Ejecuta la migración con **`psql`** (no pgAdmin). |
| No encuentra XML/ayuda | Verifica `permisos/xml/` y `ayuda/ayuda.json` junto a donde corre el backend. |
| No sube firma/logos | Faltan `storage/firmas` y `storage/logos` con permisos de escritura. |
| Login falla | Usa `admin` / `123`; si cambió, revisa la clave BCrypt en `sec_user`. |
| Node no arranca por versión | Usa Node 20/22 (Angular 21 y NestJS 11). |
| Módulos SFV/SIV/LAB con enlaces rotos | Son legacy; en producción `legacyBaseUrl` está vacío. Ocúltalos en `menu.config.ts` o despliega el sistema `/IA`. |
| Windows: `npm run build` falla | Ejecuta `npm install` en Windows (no reutilizar node_modules de otro SO). |

---

## 7. Orden recomendado

1. PostgreSQL + migración `migracion_seguridad_v2.sql` (incluye seguridad V2, módulo COT, tablas `s_cron_*` y trigger de sincronización de clientes formales).
2. Backend: `npm install` → `npm run build` → `.env` → ejecutar (`pm2`/systemd en Debian, `node` en Windows).
3. Frontend: `npm install` → `npm run build` → servir con Nginx en el 8080 (root correcto + proxy `/api`).
4. Verificar Swagger + login a través de `http://IP:8080`.

---

## Notas de los ajustes incluidos en el sistema

- **Módulo de Cotizaciones (COT)**: precios por región con `price_online`, numeración `AAAA-NNNNNN` por empresa/año, totalizadores y PDF.
- **Cronograma de proyecto**: tablas `s_cron_proyecto`, `s_cron_hito`, `s_cron_seguimiento` (el dashboard y el módulo de cronograma los requieren).
- **Clientes formales**: `cot_client` se mantiene sincronizado con `sgh_client` vía el trigger `trg_sincronizar_cot_cliente` (y el endpoint `POST /api/v1/cotizaciones/clientes/sincronizar`). Clientes informales (`id_sgh_client IS NULL`) no se sobrescriben.
- **Ayuda en línea**: panel contextual por pantalla, contenido en `backend/ayuda/ayuda.json`.
- **Iconos de módulos**: COT → `cotizacion.png`, SGH → `documents.svg`.
- **Seguridad**: solo permite entrar si el usuario está activo (`estact=1`), validado en login y en cada petición (JWT).
