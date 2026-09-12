# Gestión de Horas SIGESP — Guía de Instalación en Debian Linux

Sistema **Gestión de Horas SIGESP** que comprende:

- **Backend**: API REST en **NestJS** (Node.js) que corre en el puerto `3000` (Swagger en `/api/docs`).
- **Frontend**: SPA en **Angular** (build estático) servida por **Nginx**.
- **Base de datos**: **PostgreSQL**.

> Importante: Los `node_modules` son específicos de plataforma (existen módulos nativos como `bcrypt`). **No copies `node_modules` desde Windows.** Ejecuta `npm install` en el servidor Linux de destino.

---

## 1. Requisitos previos

- Servidor **Debian** (12/13) — `apt` disponible.
- **Node.js 20 LTS o 22 LTS** como mínimo (NestJS 11 y Angular 21 lo requieren).
- **npm >= 10**.
- **PostgreSQL 13 o superior**.
- **Nginx** (opcional, recomendado para servir el frontend y hacer proxy la API).
- **PM2** (opcional, recomendado para mantener el backend activo).
- Usuario con permisos `sudo`.

---

## 2. Instalación de Node.js

Con NodeSource (versión 22 LTS, equivalente a la versión usada en desarrollo):

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # debe mostrar v22.x
npm -v    # debe mostrar 10.x
```

> Si prefieres `nvm`: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`, luego `nvm install 22`.

---

## 3. Instalación de PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Crear la base de datos y el usuario (ajusta clave y nombre):

```bash
sudo -u postgres psql <<'EOF'
CREATE ROLE sigesp LOGIN PASSWORD 'TU_CLAVE_FORTE';
CREATE DATABASE db_gestionhoras_sigesp OWNER sigesp;
\q
EOF
```

> Escribe la clave que uses en el `.env` del backend (`DB_USER` / `DB_PASSWORD`).

---

## 4. Copiar el proyecto

Copia las carpetas `backend/` y `frontend/` del proyecto al servidor (p. ej. a `/var/www/sigesp`):

```bash
sudo mkdir -p /var/www/sigesp
sudo rsync -av --exclude node_modules --exclude dist backend/ /var/www/sigesp/backend/
sudo rsync -av --exclude node_modules --exclude dist frontend/ /var/www/sigesp/frontend/
sudo chown -R $USER:$USER /var/www/sigesp
```

> También debes copiar el script de migración **`migracion_seguridad_v2.sql`** (si no está ya dentro del proyecto) y dejarlo accesible para el paso 5.

---

## 5. Migración de la base de datos

Ejecuta la migración que crea la estructura de seguridad (V2) y el módulo de cotizaciones (tablas `cot_*`, sistema COT y accesos):

```bash
cd /var/www/sigesp
sudo -u postgres psql -h localhost -U postgres -d db_gestionhoras_sigesp \
     -v ON_ERROR_STOP=1 -f migracion_seguridad_v2.sql
```

- El script es **atómico** (BEGIN/COMMIT): si algo falla hace ROLLBACK.
- Deja todos los usuarios con clave **`123`** (hash BCrypt) como valor inicial.
- Confirma al final el log: `MIGRACION COMPLETADA CORRECTAMENTE`.

> Usuarios iniciales de prueba: `admin` / `123`; también el usuario `sigesp` (con acceso al módulo COT).

---

## 6. Despliegue del Backend (NestJS)

### 6.1 Instalar y compilar

```bash
cd /var/www/sigesp/backend
npm install                 # instala dependencias (en el servidor)
npm run build               # compila a dist/
ls dist/main.js
```

### 6.2 Crear el archivo `.env`

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
nano .env
```

Contenido mínimo recomendado:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_gestionhoras_sigesp
DB_USER=sigesp
DB_PASSWORD=TU_CLAVE_FORTE
DB_SSL=false

# JWT  (¡usa secretos aleatorios y largos!)
JWT_SECRET=genera-una-cadena-aleatoria-1
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=genera-una-cadena-aleatoria-2
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# CORS (dominio real si no usas same-origin por Nginx)
CORS_ORIGIN=http://tu-dominio.com

# Throttling
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

> Genera secretos con: `openssl rand -hex 32`

### 6.3 Recursos en disco (rutas portables)

El backend lee archivos desde el directorio donde se lanza (`process.cwd()`). Deben existir:

```bash
cd /var/www/sigesp/backend
mkdir -p storage/firmas storage/logos storage/logos-legacy
ls permisos/xml/     # sec_arbol_*.xml (todos los sistemas)
ls ayuda/ayuda.json  # contenido de ayuda en línea
```

- `permisos/xml/` y `ayuda/ayuda.json` viajan dentro del proyecto; si no, cópialos.
- `storage/firmas` y `storage/logos` se llenan al subir firma/logos desde el frontend.

### 6.4 Ejecutar con PM2 (recomendado)

```bash
sudo npm install -g pm2
cd /var/www/sigesp/backend
pm2 start dist/main.js --name sigesp-api
pm2 startup systemd     # habilita arranque automático (copia la línea que imprime y ejecútala)
pm2 save
```

Verificar:

```bash
curl http://localhost:3000/api/docs    # Swagger accesible
pm2 status
```

### 6.5 Ejecutar sin PM2 (systemd directo)

Crea `/etc/systemd/system/sigesp-api.service`:

```ini
[Unit]
Description=SIGESP API (Gestion de Horas)
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/var/www/sigesp/backend
ExecStart=/usr/bin/node /var/www/sigesp/backend/dist/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sigesp-api
sudo systemctl status sigesp-api
```

---

## 7. Despliegue del Frontend (Angular)

### 7.1 Instalar y compilar

```bash
cd /var/www/sigesp/frontend
npm install
npm run build          # usa la configuración production por defecto
ls dist/frontend/browser/index.html   # debe existir
```

- `environment.prod.ts` ya trae `apiUrl: '/api/v1'` (same-origin) y `legacyBaseUrl: ''`. No requiere cambios.

### 7.2 Instalar Nginx

```bash
sudo apt install -y nginx
```

### 7.3 Configurar el sitio

Crea `/etc/nginx/sites-available/sigesp`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;   # o la IP del servidor

    root /var/www/sigesp/frontend/dist/frontend/browser;
    index index.html;

    # SPA: cualquier ruta que no sea un archivo real cae en index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API -> Backend NestJS
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Opcional: si el frontend llega a pedir /storage/* (logos, firmas)
    # location /storage/ {
    #     alias /var/www/sigesp/backend/storage/;
    # }
}
```

Activa el sitio y recarga:

```bash
sudo ln -s /etc/nginx/sites-available/sigesp /etc/nginx/sites-enabled/sigesp
sudo nginx -t
sudo systemctl reload nginx
```

### 7.4 (Opcional) HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## 8. Verificación final

```bash
# 1. Backend vivo (Swagger)
curl http://localhost:3000/api/docs

# 2. Frontend servido (index)
curl -I http://localhost/          # 200 OK

# 3. Login a través del proxy (API responde)
curl -X POST http://localhost/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"login":"admin","password":"123"}'
```

Abre `http://tu-dominio.com` en el navegador, inicia sesión y navega a los módulos **Seguridad (SEC)**, **Gestión de Horas (SGH)** y **Cotizaciones (COT)**.

---

## 9. Solución de problemas

| Problema | Causa / solución |
|---|---|
| `ECONNREFUSED` al conectar a DB | Puerto/credenciales en `.env`; verifica `pg_hba.conf` y que PostgreSQL esté activo. |
| `/api` responde `404` en el navegador | Falta el bloque `location /api/` en Nginx o el proxy apunta al puerto incorrecto. |
| Al entrar a `/sgh/...` da `404` | Falta el fallback SPA: la directiva `try_files $uri $uri/ /index.html;`. |
| El backend no encuentra los XML/ayuda | No están `permisos/xml/` o `ayuda/ayuda.json` junto a donde corre el backend; revísalo en `backend/`. |
| No sube firma/logos | Faltan los directorios `storage/firmas` y `storage/logos` con permisos de escritura para el usuario del proceso (`www-data`). |
| Login falla con credenciales | Usa `admin` / `123` (se regeneran con la migración). O revisa que la tabla `sec_user` tenga la clave BCrypt. |
| Node no arranca por versión | Usa Node 20/22 (Angular 21 y NestJS 11 no soportan versiones muy antiguas). |
| Módulos SFV/SIV/LAB con enlaces rotos | Son módulos legacy; en producción `legacyBaseUrl` está vacío. Ocúltalos en `menu.config.ts` si no vas a desplegar el sistema `/IA`. |

---

## 10. Resumen de estructura desplegada

```
/var/www/sigesp/
├── backend/
│   ├── dist/main.js
│   ├── .env
│   ├── permisos/xml/sec_arbol_*.xml
│   ├── ayuda/ayuda.json
│   └── storage/{firmas,logos,logos-legacy}
└── frontend/
    └── dist/frontend/browser/   (servido por Nginx)
```

**Servicios activos:**
- `postgresql` → puerto 5432
- `sigesp-api` (PM2 o systemd) → puerto 3000
- `nginx` → puerto 80/443 (frontend + proxy `/api`)

---

*Documento de instalación del sistema Gestión de Horas SIGESP para Debian Linux.*
