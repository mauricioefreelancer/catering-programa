import { Layout, Avatar, Button, Dropdown, Typography, Space } from 'antd'
import { UserOutlined, LogoutOutlined, WifiOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Header, Content } = Layout
const { Title } = Typography

const MobileLayout = () => {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const esOperador = (() => {
    const rol = String(usuario?.rolNombre || usuario?.rol || '').toLowerCase()
    const perfil = String(usuario?.perfil || '').toLowerCase()
    return rol.includes('operador') || perfil === 'operador' || perfil === 'operario' || Number(usuario?.idRol) === 4
  })()

  const userMenu = esOperador
    ? []
    : [
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: 'Cerrar Sesión',
          onClick: () => {
            logout()
            navigate('/login', { replace: true })
          },
        },
      ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header
        style={{
          background: '#1677ff',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 6px rgba(22,119,255,0.2)',
        }}
      >
        <Space style={{ minWidth: 0 }}>
          <Link to="/dashboard" style={{ color: 'white' }}>
            <Button type="text" style={{ color: 'white' }}>
              <WifiOutlined />
            </Button>
          </Link>
          <Title level={5} style={{ color: 'white', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {usuario?.nombre || usuario?.usuario_login || 'Móvil'}
          </Title>
        </Space>
        <Space size={8}>
          {userMenu.length > 0 ? (
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <div style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: 'white', color: '#1677ff' }} icon={<UserOutlined />}>
                  {usuario?.nombre?.charAt(0)}
                </Avatar>
              </div>
            </Dropdown>
          ) : (
            <Avatar style={{ backgroundColor: 'white', color: '#1677ff', cursor: 'default' }} icon={<UserOutlined />}>
              {usuario?.nombre?.charAt(0)}
            </Avatar>
          )}
        </Space>
      </Header>
      <Content style={{ padding: 12, paddingBottom: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}

export default MobileLayout
