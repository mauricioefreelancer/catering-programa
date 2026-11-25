# ERP Vending & Catering

Sistema ERP logístico y financiero especializado en máquinas vending, dispensadoras de café y tiendas físicas.

## Arquitectura (sin Docker · Windows 10 compatible)

```
Catering programa/
├── backend/          # NestJS + Prisma (API RESTful · despliegue Render)
│   └── prisma/migrations/ # Migraciones PostgreSQL activas
└── frontend/         # React 18 + Vite + Ant Design 5 (Web + PWA Móvil · despliegue Netlify)
```

| Capa            | Tecnología                              |
| ---------------- | --------------------------------------- |
| Base de Datos    | PostgreSQL 15+ (nativo Windows)       |
| Backend API      | NestJS 11 + TypeScript + Prisma 5 + JWT |
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

### 1. Base de Datos
Crear una base PostgreSQL local y vacía. Prisma aplicará el esquema y la auditoría desde `backend/prisma/migrations/`. Las migraciones de `backend/prisma/migrations_legacy/` son solo de referencia.

### 2. Configurar Backend
```powershell
cd backend
Copy-Item .env.example .env   # solo si todavía no existe .env
```
Editar `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA_PG@localhost:5432/catering_db?schema=public"
DIRECT_URL="postgresql://postgres:TU_CONTRASEÑA_PG@localhost:5432/catering_db?schema=public"
JWT_SECRET="clave_segura_de_32_caracteres_minimo"
JWT_EXPIRES_IN="7d"
PORT=3000
TARIFA_PROMEDIO_DEFAULT=3500
UMBRAL_MARGEN=30
```

Luego:
```powershell
npm ci
npx prisma generate
npm run db:migrate  # migrate deploy protegido por scripts/verificar-entorno.js
npm run db:seed     # carga demo, solo en la base local
npm run start:dev  # API en http://localhost:3000/api
```

Usuario demo (solo base local): `admin@example.com` · Clave: `Admin123*`. En Render no existe.

#### Protección de la base de producción
`backend/scripts/verificar-entorno.js` aborta si `NODE_ENV` no es `production` y `DATABASE_URL` o `DIRECT_URL` apuntan a un host distinto de `localhost`. Lo usan `npm run db:migrate`, `npm run db:seed` y `npx prisma db seed`. Nunca ejecutes `npx prisma migrate deploy` directo con las variables de Render en tu equipo: las migraciones de Render las aplica solo su Pre-Deploy.

### 3. Configurar Frontend
```powershell
cd frontend
copy .env.example .env
```
Editar `frontend/.env` para desarrollo local:
```env
VITE_API_URL="http://localhost:3000/api"
VITE_APP_TITLE="ERP Vending & Catering"
```

Luego:
```powershell
npm ci
npm run dev  # Web en http://localhost:5173
```

Módulo operador móvil PWA: `http://localhost:5173/mobile`

---

## Despliegue

### Backend → Render
- **Root Directory**: `backend`. Configuración versionada en `backend/render.yaml`; si el servicio se gestiona desde el panel de Render, replica allí estos comandos.
- **Build Command**: `npm ci && npx prisma generate && npm run build`
- **Pre-Deploy Command**: `npx prisma migrate deploy`
- **Start Command**: `npm run start:prod`
- **Variables**: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `TARIFA_PROMEDIO_DEFAULT`, `UMBRAL_MARGEN`
- **Alertas de visita**: Administración → Parámetros permite editar las tolerancias de venta y materia prima, inicialmente de $10.000 COP cada una. Cada visita guarda el umbral aplicado y su resultado; un cambio no recalcula las alertas anteriores.
- **Pre-Deploy**: confirma en el log de cada despliegue `==> Starting pre-deploy: npx prisma migrate deploy`. El Build no debe contener `migrate deploy`.
- **Limpieza de datos de prueba (solo fase de construcción)**: `backend/scripts/reset-datos-prueba.js` vacía todas las tablas excepto usuarios, roles, parámetros y migraciones, crea el perfil y usuario administrador `Engenitix` y elimina el usuario demo. Se ejecuta como job de Render con `CONFIRMAR_RESET=BORRAR-DATOS-DE-PRUEBA` y `ADMIN_CLAVE_INICIAL`. No usar con datos reales.
- **Base ya existente**: antes de activar este despliegue, seguir la [guía de adopción del baseline](backend/prisma/BASELINE.md). No aplicar `0_baseline` sobre una base con tablas existentes.

### Frontend → Netlify
- Usar el único `netlify.toml` de la raíz del repositorio. Quitar de Netlify cualquier configuración anterior que cambie el directorio del archivo de configuración o el directorio del paquete.
- El archivo define la base `frontend`, la publicación desde `dist` y la redirección SPA. Mantener `VITE_API_URL` con el sufijo `/api`.

### Nuevas migraciones

En una base de desarrollo, ejecutar `npx prisma migrate dev --create-only --name <nombre>` desde `backend`. Revisar el SQL, añadir el backfill cuando corresponda y probar `migrate deploy` en una base vacía antes de publicar.

La migración de Tesorería añade Nequi, vincula saldos con visitas y protege la facturación NRQ por período. Antes de desplegar, ensayarla sobre una restauración del respaldo: si existen filas duplicadas de facturación para la misma máquina, producto y período, la migración se detiene sin borrar datos. `STOCK_PROVEEDOR` permanece intacta; su retiro requiere acordar la exportación del histórico.

---

## Módulos Funcionales

1. **Catálogos**: Clientes / Proveedores / Productos (Estándar, Materia Prima, Dosificado / Operadores / Máquinas / Precios x Cliente Matriz IPC)
2. **Inventarios Bodega Principal Ingresos/Compras Despachos por Bodega)
3. **Operador móvil**: registro en línea desde Inventario, con físico, lecturas y confirmación antes de enviar.
4. **Tesorería: Cuadres Efectivo (NR/NRQ), Saldos Digitales, Facturación Café)
5. **Admin**: Maestro Roles Dinámicos, Dashboards Analíticos Auditoría)

---

## Flujos Clave
1. Compra de materia prima → Ingreso a bodega
2. Operador digita Inventario físico → Sugerido (informativo)
3. Bodega aprueba Despacho → Descuenta stock
4. Tesorería Cuadra caja Diferencia
5. Fin de mes → Facturación NRQ
