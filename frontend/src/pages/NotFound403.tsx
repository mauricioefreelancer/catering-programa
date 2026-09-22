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

const NotFound403 = () => {
  const navigate = useNavigate()
  const { usuario } = useAuth()

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="403"
        title="403"
        subTitle="Lo sentimos, no tienes permisos para acceder a esta página."
        extra={
          <Button type="primary" onClick={() => navigate(getHomeRoute(usuario))}>
            Volver al Inicio
          </Button>
        }
      />
    </div>
  )
}

export default NotFound403
