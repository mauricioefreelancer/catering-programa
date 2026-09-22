# ERP Vending & Catering

Sistema ERP logístico y financiero especializado en máquinas vending, dispensadoras de café y tiendas físicas.

## Arquitectura (sin Docker · Windows 10 compatible)

```
Catering programa/
├── backend/          # NestJS + Prisma (API RESTful · despliegue Render)
├── frontend/         # React 18 + Vite + Ant Design 5 (Web + PWA Móvil · despliegue Netlify)
└── supabase/
    └── migrations/ # Scripts DDL SQL PostgreSQL (16 tablas + Triggers)
```

| Capa            | Tecnología                              |
| ---------------- | --------------------------------------- |
| Base de Datos    | PostgreSQL 15+ (nativo Windows)       |
| Backend API      | NestJS 11 + TypeScript + Prisma 6 + JWT |
| ORM              | Prisma Client                           |
| Frontend Web     | React 18 + Vite + TypeScript + Ant Design 5 |
| State / Cache    | Zustand + TanStack Query                |
| Gráficos         | Recharts / Ant Design Charts            |
| PWA Móvil       | vite-plugin-pwa + IndexedDB             |
| Auth             | JWT + bcrypt + Permisos Granulares CRUD |

---

## Prerrequisitos (instalación nativa Windows 10

1. **PostgreSQL 15 o superior**
   - Descargar desde https://www.postgresql.org/download/windows/
   - Instalar con contraseña para usuario `postgres` (anótala)
   - Abrir **pgAdmin 4** y crear base de datos: `catering_db`
   - Usuario: `postgres` · Contraseña: (la tuya) · Puerto: 5432

2. **Node.js 20 LTS o superior**
   - Descargar desde https://nodejs.org/ (instalar con chocolatey recomendado)
   - Verificar: `node --version` y `npm --version`

3. **pgAdmin 4** (incluido con PostgreSQL) o **DBeaver** para ejecutar scripts SQL.

---

## Setup Paso a Paso (Local Development)

### 1. Base de Datos · Ejecutar Scripts SQL
Abrir pgAdmin → Query Tool → abrir y ejecutar en orden:

```
1) supabase/migrations/001_init_schema.sql     → 16 tablas
2) supabase/migrations/002_trigger_recalc_recetas.sql → Trigger receta costos
3) supabase/migrations/003_audit_log.sql     → Log Auditoría inalterable
```

### 2. Configurar Backend
```powershell
cd backend
copy .env .env.local   # y editar credenciales PostgreSQL
```
Editar `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA_PG@localhost:5432/catering_db?schema=public"
JWT_SECRET="clave_segura_de_32_caracteres_minimo"
JWT_EXPIRES_IN="7d"
PORT=3000
TARIFA_PROMEDIO_DEFAULT=3500
UMBRAL_MARGEN=30
```

Luego:
```powershell
cd backend
npm install
npx prisma generate   # (después de haber ejecutado scripts SQL 1-3)
npx prisma db seed  # Datos demo
npm run start:dev  # API en http://localhost:3000/api
```

Usuario demo: `admin@example.com` · Clave: `Admin123*`

### 3. Configurar Frontend
```powershell
cd frontend
copy .env.example .env
```
Editar `frontend/.env` (mantener para local:
```env
VITE_API_URL="http://localhost:3000/api
VITE_APP_TITLE="ERP Vending & Catering"
```

Luego:
```powershell
cd frontend
npm install
npm run dev  # Web en http://localhost:5173
```

Módulo operador móvil PWA: `http://localhost:5173/mobile`

---

## Despliegue

### Backend → Render
- **Build Command**: `cd backend && npm ci && npx prisma migrate deploy && npm run build`
- **Start Command**: `cd backend && npm run start:prod`
- **Variables**: `DATABASE_URL`, `JWT_SECRET`, `TARIFA_PROMEDIO_DEFAULT`, `UMBRAL_MARGEN`

### Frontend → Netlify
- **Build Command**: `cd frontend && npm ci && npm run build`
- **Publish**: `frontend/dist`
- **SPA Redirects (netlify.toml) redirects rules: `/*  /index.html  200`
- **Variable**: `VITE_API_URL=https://tu-backend.onrender.com/api`

---

## Módulos Funcionales

1. **Catálogos**: Clientes / Proveedores / Productos (Estándar, Materia Prima, Dosificado / Operadores / Máquinas / Precios x Cliente Matriz IPC)
2. **Inventarios Bodega Principal Ingresos/Compras Despachos por Bodega)
3. **Operador Móvil PWA Offline)
4. **Tesorería: Cuadres Efectivo (NR/NRQ), Saldos Digitales, Facturación Café)
5. **Admin**: Maestro Roles Dinámicos, Dashboards Analíticos Auditoría)

---

## Flujos Clave
1. Compra Materia Prima → Trigger auto recalcula Costo Recetas
2. Operador digita Inventario físico → Sugerido (informativo)
3. Bodega aprueba Despacho → Descuenta stock
4. Tesorería Cuadra caja Diferencia
5. Fin de mes → Facturación NRQ
