import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const getHomeRoute = (usuario?: any) => {
  const rol = String(usuario?.rolNombre || usuario?.rol || '').toLowerCase()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  if (rol.includes('operador') || perfil === 'operador' || perfil === 'operario') return '/mobile/home'
  if (rol.includes('bodega') || perfil === 'bodega') return '/despachos'
  if (rol.includes('tesorer') || perfil === 'tesoreria' || perfil === 'tesorero') return '/tesoreria/efectivo'
  return '/dashboard'
}

interface PermissionRouteProps {
  modulo: string
  accion?: string
  children: React.ReactNode
}

const PermissionRoute = ({ modulo, accion = 'ver', children }: PermissionRouteProps) => {
  const { hasPermission, usuario } = useAuth()
  const navigate = useNavigate()

  if (!hasPermission(modulo, accion)) {
    const home = getHomeRoute(usuario)
    return (
      <Result
        status="403"
        title="403"
        subTitle="Lo sentimos, no tienes permisos para acceder a esta página."
        extra={
          <Button type="primary" onClick={() => navigate(home)}>
            Volver al Inicio
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}

export default PermissionRoute
