import { useState } from 'react'
import { Layout, Avatar, Button, Badge, Dropdown, Typography, Space, message, Spin } from 'antd'
import { UserOutlined, LogoutOutlined, CloudUploadOutlined, CloudOutlined, WifiOutlined } from '@ant-design/icons'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useOfflinePending, offlineStore } from './offline.store'
import { post } from '../../api/services/api'

const { Header, Content } = Layout
const { Title } = Typography

const MobileLayout = () => {
  const { usuario, logout } = useAuth()
  const { count, items, refresh } = useOfflinePending()
  const [syncing, setSyncing] = useState(false)
  const navigate = useNavigate()

  const syncAll = async () => {
    if (items.length === 0) {
      message.info('No hay inventarios pendientes por sincronizar')
      return
    }
    setSyncing(true)
    const successIds: string[] = []
    try {
      for (const it of items) {
        try {
          const payload = {
            maquinaId: it.maquinaId,
            espirales: it.espirales || [],
            nr_actual: it.nr_actual,
            nrq: it.nrq || [],
            offline_id: it.id,
          }
          await post('/inventarios', payload)
          successIds.push(it.id)
        } catch (e: any) {
          if (!e?.code || (e.code !== 'ERR_NETWORK' && !(e.isAxiosError && !e.response))) {
            successIds.push(it.id)
          }
        }
      }
      if (successIds.length > 0) {
        await offlineStore.removePending(successIds)
      }
      if (successIds.length === items.length) {
        message.success(`✅ Sincronizados ${successIds.length} inventarios`)
      } else {
        message.warning(`Sincronizados ${successIds.length}/${items.length}. Los demás permanecen offline.`)
      }
      refresh()
    } finally {
      setSyncing(false)
    }
  }

  const userMenu = [
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
          <Badge count={count} offset={[-4, 4]} color="#faad14">
            <Button
              type="primary"
              icon={syncing ? <Spin /> : (count > 0 ? <CloudUploadOutlined /> : <CloudOutlined />)}
              onClick={syncAll}
              loading={syncing}
              style={{
                background: count > 0 ? '#faad14' : '#ffffff1a',
                border: 'none',
                color: 'white',
              }}
            >
              {count > 0 ? `Sync ${count}` : 'Sync'}
            </Button>
          </Badge>
          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: 'white', color: '#1677ff' }} icon={<UserOutlined />}>
                {usuario?.nombre?.charAt(0)}
              </Avatar>
            </div>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: 12, paddingBottom: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}

export default MobileLayout
