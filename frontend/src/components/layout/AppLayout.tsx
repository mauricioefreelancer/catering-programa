import { useState, useEffect } from 'react'
import { Layout, Menu, Breadcrumb, Dropdown, Avatar, Button, theme, Space, Tag, Drawer } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TagOutlined,
  UserOutlined,
  DesktopOutlined,
  InboxOutlined,
  SendOutlined,
  DollarOutlined,
  WalletOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserSwitchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  ControlOutlined,
  OrderedListOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const { Header, Sider, Content } = Layout

type MenuItem = Required<MenuProps>['items'][number]

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { usuario, logout, hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const rolStr = String(usuario?.rolNombre || usuario?.rol || usuario?.perfil || '').toLowerCase()
  const perfilStr = String(usuario?.perfil || '').toLowerCase()
  const isOperador =
    rolStr.includes('operador') ||
    rolStr.includes('operario') ||
    perfilStr === 'operador' ||
    perfilStr === 'operario'
  const getHomeRoute = () => {
    if (isOperador) return '/mobile/home'
    if (rolStr.includes('bodega') || perfilStr === 'bodega') return '/despachos'
    if (rolStr.includes('tesorer') || perfilStr === 'tesoreria' || perfilStr === 'tesorero') return '/tesoreria/efectivo'
    return '/dashboard'
  }
  const homeRoute = getHomeRoute()

  useEffect(() => {
    const checkMobile = () => {
      const mql = window.matchMedia('(max-width: 768px)')
      setIsMobile(mql.matches)
      if (mql.matches) {
        setCollapsed(true)
        setDrawerOpen(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen((v) => !v)
    } else {
      setCollapsed((v) => !v)
    }
  }

  const items: MenuItem[] = []

  if (isOperador) {
    items.push({ key: '/mobile/home', icon: <DesktopOutlined />, label: <Link to="/mobile/home">📱 Panel Operador</Link> })
  } else {
    if (hasPermission('dashboard')) {
      items.push({ key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">Dashboard</Link> })
    }
    if (hasPermission('clientes')) {
      items.push({ key: '/clientes', icon: <TeamOutlined />, label: <Link to="/clientes">Clientes</Link> })
    }
    if (hasPermission('proveedores')) {
      items.push({ key: '/proveedores', icon: <ShopOutlined />, label: <Link to="/proveedores">Proveedores</Link> })
    }
    if (hasPermission('productos')) {
      items.push({ key: '/productos', icon: <ShoppingCartOutlined />, label: <Link to="/productos">Productos</Link> })
    }
    if (hasPermission('precios')) {
      items.push({ key: '/precios', icon: <TagOutlined />, label: <Link to="/precios">Precios</Link> })
    }
    if (hasPermission('operadores')) {
      items.push({ key: '/operadores', icon: <UserOutlined />, label: <Link to="/operadores">Operadores</Link> })
    }
    if (hasPermission('maquinas')) {
      items.push({ key: '/maquinas', icon: <DesktopOutlined />, label: <Link to="/maquinas">Máquinas</Link> })
    }
    if (hasPermission('inventario') || hasPermission('ingresos')) {
      items.push({ key: '/ingresos', icon: <InboxOutlined />, label: <Link to="/ingresos">Ingresos Bodega</Link> })
    }
    if (hasPermission('pedidosOperador')) {
      items.push({ key: '/pedidos', icon: <OrderedListOutlined />, label: <Link to="/pedidos">Pedidos Operadores</Link> })
    }
    if (hasPermission('despachos')) {
      items.push({ key: '/despachos', icon: <SendOutlined />, label: <Link to="/despachos">Despachos</Link> })
    }

    const tesoreriaChildren: MenuItem[] = []
    if (hasPermission('tesoreria')) {
      tesoreriaChildren.push({ key: '/tesoreria/efectivo', icon: <WalletOutlined />, label: <Link to="/tesoreria/efectivo">Efectivo / Recaudo</Link> })
      tesoreriaChildren.push({ key: '/tesoreria/saldos', icon: <DollarOutlined />, label: <Link to="/tesoreria/saldos">Saldos Plataformas</Link> })
      tesoreriaChildren.push({ key: '/tesoreria/facturacion-nrq', icon: <FileTextOutlined />, label: <Link to="/tesoreria/facturacion-nrq">Facturación NRQ</Link> })
    }
    if (tesoreriaChildren.length > 0) {
      items.push({ key: 'tesoreria', icon: <DollarOutlined />, label: 'Tesorería', children: tesoreriaChildren })
    }

    const adminChildren: MenuItem[] = []
    if (hasPermission('admin')) {
      adminChildren.push({ key: '/admin/roles', icon: <SettingOutlined />, label: <Link to="/admin/roles">Roles y Permisos</Link> })
      adminChildren.push({ key: '/admin/usuarios', icon: <UserSwitchOutlined />, label: <Link to="/admin/usuarios">Usuarios</Link> })
      adminChildren.push({
        key: '/admin/data-panel',
        icon: <DatabaseOutlined />,
        label: (
          <Link to="/admin/data-panel" style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
            <Space style={{ display: 'flex', width: '100%' }}>
              <span>Panel de Datos Maestro</span>
              <Tag color="gold" style={{ marginLeft: 'auto' }} icon={<ControlOutlined />}>MODO FUERZA</Tag>
            </Space>
          </Link>
        ),
      })
    }
    if (adminChildren.length > 0) {
      items.push({ key: 'admin', icon: <SettingOutlined />, label: 'Administración', children: adminChildren })
    }
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  const pathSnippets = location.pathname.split('/').filter((i) => i)
  const breadcrumbItems = [
    { title: <Link to={homeRoute}>Inicio</Link> },
    ...pathSnippets.map((_, index) => {
      const url = `/${pathSnippets.slice(0, index + 1).join('/')}`
      const label = pathSnippets[index].charAt(0).toUpperCase() + pathSnippets[index].slice(1).replace(/-/g, ' ')
      return { title: <Link to={url}>{label}</Link> }
    }),
  ]

  const getOpenKeys = () => {
    const path = location.pathname
    if (path.startsWith('/tesoreria')) return ['tesoreria']
    if (path.startsWith('/admin')) return ['admin']
    return []
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider trigger={null} collapsible collapsed={collapsed} width={240} theme="dark">
          <div
            style={{
              height: 64,
              margin: 16,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: collapsed ? 16 : 18,
            }}
          >
            {collapsed ? 'V&C' : 'ERP Vending'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={getOpenKeys()}
            items={items}
          />
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={280}
          styles={{
            header: { background: '#001529', borderBottom: '1px solid #0f2a4d', padding: '12px 16px' },
            body: { padding: 0, background: '#001529' },
          }}
          title={
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              {usuario?.nombreCompleto ? usuario.nombreCompleto.split(' ')[0] : 'ERP Vending'}
            </div>
          }
          closeIcon={<CloseOutlined style={{ color: '#fff', fontSize: 16 }} />}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={getOpenKeys()}
            items={items}
            onClick={() => setDrawerOpen(false)}
          />
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 8px' : '0 16px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: isMobile ? 56 : 64,
            lineHeight: isMobile ? '56px' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
              style={{ fontSize: 16, width: isMobile ? 44 : 64, height: isMobile ? 44 : 64 }}
            />
            {!isMobile && <Breadcrumb items={breadcrumbItems} />}
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
              <Avatar size={isMobile ? 32 : 40} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
                {usuario?.nombre?.charAt(0) || usuario?.usuario_login?.charAt(0) || 'U'}
              </Avatar>
              {!isMobile && (
                <>
                  <span style={{ fontWeight: 500 }}>{usuario?.nombre || usuario?.usuario_login || 'Usuario'}</span>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>{usuario?.rol || ''}</span>
                </>
              )}
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: isMobile ? '8px' : '16px',
            padding: isMobile ? 10 : 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: isMobile ? 8 : borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
