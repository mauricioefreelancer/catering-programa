import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AppLayout from '../components/layout/AppLayout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Clientes from '../pages/Clientes'
import Proveedores from '../pages/Proveedores'
import Productos from '../pages/Productos'
import Precios from '../pages/Precios'
import Operadores from '../pages/Operadores'
import Maquinas from '../pages/Maquinas'
import Ingresos from '../pages/Ingresos'
import Despachos from '../pages/Despachos'
import PedidosOperador from '../pages/Pedidos'
import Efectivo from '../pages/Tesoreria/Efectivo'
import Saldos from '../pages/Tesoreria/Saldos'
import FacturacionNRQ from '../pages/Tesoreria/FacturacionNRQ'
import Roles from '../pages/Admin/Roles'
import Usuarios from '../pages/Admin/Usuarios'
import AdminDataPanel from '../pages/Admin/DataPanel'
import MobileLayout from '../pages/Mobile/MobileLayout'
import HomeMobile from '../pages/Mobile/Home'
import InventarioMobile from '../pages/Mobile/Inventario'
import ContadoresMobile from '../pages/Mobile/Contadores'
import ResumenMobile from '../pages/Mobile/Resumen'
import NotFound404 from '../pages/NotFound404'
import PermissionRoute from '../components/PermissionRoute'

const ProtectedRoute = ({ children }: { children?: any }) => {
  const { isAuth } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  return children || <Outlet />
}

export const routes = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <PermissionRoute modulo="dashboard" accion="ver">
            <Dashboard />
          </PermissionRoute>
        ),
      },
      {
        path: 'clientes',
        element: (
          <PermissionRoute modulo="clientes" accion="ver">
            <Clientes />
          </PermissionRoute>
        ),
      },
      {
        path: 'proveedores',
        element: (
          <PermissionRoute modulo="proveedores" accion="ver">
            <Proveedores />
          </PermissionRoute>
        ),
      },
      {
        path: 'productos',
        element: (
          <PermissionRoute modulo="productos" accion="ver">
            <Productos />
          </PermissionRoute>
        ),
      },
      {
        path: 'precios',
        element: (
          <PermissionRoute modulo="precios" accion="ver">
            <Precios />
          </PermissionRoute>
        ),
      },
      {
        path: 'operadores',
        element: (
          <PermissionRoute modulo="operadores" accion="ver">
            <Operadores />
          </PermissionRoute>
        ),
      },
      {
        path: 'maquinas',
        element: (
          <PermissionRoute modulo="maquinas" accion="ver">
            <Maquinas />
          </PermissionRoute>
        ),
      },
      {
        path: 'ingresos',
        element: (
          <PermissionRoute modulo="inventario" accion="ver">
            <Ingresos />
          </PermissionRoute>
        ),
      },
      {
        path: 'despachos',
        element: (
          <PermissionRoute modulo="despachos" accion="ver">
            <Despachos />
          </PermissionRoute>
        ),
      },
      {
        path: 'pedidos',
        element: (
          <PermissionRoute modulo="pedidosOperador" accion="ver">
            <PedidosOperador />
          </PermissionRoute>
        ),
      },
      {
        path: 'tesoreria/recaudos',
        element: (
          <PermissionRoute modulo="tesoreria" accion="ver">
            <Efectivo />
          </PermissionRoute>
        ),
      },
      {
        path: 'tesoreria/efectivo',
        element: <Navigate to="/tesoreria/recaudos" replace />,
      },
      {
        path: 'tesoreria/saldos',
        element: (
          <PermissionRoute modulo="tesoreria" accion="ver">
            <Saldos />
          </PermissionRoute>
        ),
      },
      {
        path: 'tesoreria/facturacion-nrq',
        element: (
          <PermissionRoute modulo="tesoreria" accion="ver">
            <FacturacionNRQ />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <PermissionRoute modulo="admin" accion="ver">
            <Roles />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/usuarios',
        element: (
          <PermissionRoute modulo="admin" accion="ver">
            <Usuarios />
          </PermissionRoute>
        ),
      },
      {
        path: 'admin/data-panel',
        element: (
          <PermissionRoute modulo="admin" accion="ver">
            <AdminDataPanel />
          </PermissionRoute>
        ),
      },
    ],
  },
  {
    path: '/mobile',
    element: (
      <ProtectedRoute>
        <MobileLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/mobile/home" replace /> },
      {
        path: 'home',
        element: <HomeMobile />,
      },
      {
        path: 'maquinas',
        element: <Navigate to="/mobile/home" replace />,
      },
      {
        path: 'inventario/:idMaquina',
        element: <InventarioMobile />,
      },
      {
        path: 'contadores/:idMaquina',
        element: <ContadoresMobile />,
      },
      {
        path: 'resumen/:idMaquina',
        element: <ResumenMobile />,
      },
    ],
  },
  { path: '*', element: <NotFound404 /> },
])

export default routes
