import { useMemo } from 'react'
import { List, Avatar, Badge, Typography, Tag, Input, Space, Card } from 'antd'
import { SearchOutlined, DesktopOutlined, EnvironmentOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

interface MaquinaRow {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  estado_visita: 'PENDIENTE' | 'VISITADA' | 'URGENTE'
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
}

const MAQUINAS_OPERADOR: MaquinaRow[] = [
  { id: 1, serial: 'SNK-00123', zona: 'Piso 3 - Cafetería', clienteNombre: 'Alimentos S.A.S.', estado_visita: 'PENDIENTE', tipo: 'COMBINADA' },
  { id: 3, serial: 'BEB-00789', zona: 'Edificio B', clienteNombre: 'Alimentos S.A.S.', estado_visita: 'URGENTE', tipo: 'BEBIDA' },
  { id: 2, serial: 'CAF-00456', zona: 'Recepción Principal', clienteNombre: 'Empresa Servicios Ltda.', estado_visita: 'VISITADA', tipo: 'CAFE' },
  { id: 5, serial: 'CAF-00789', zona: 'Piso 5 - Lounge', clienteNombre: 'Alimentos S.A.S.', estado_visita: 'PENDIENTE', tipo: 'CAFE' },
  { id: 6, serial: 'SNK-00555', zona: 'Centro Comercial Local 101', clienteNombre: 'Industrias Alimenticias', estado_visita: 'PENDIENTE', tipo: 'SNACK' },
]

const estadoBadge = (e: string) => {
  if (e === 'VISITADA') return <Badge status="success" text={<Tag color="green" icon={<CheckCircleOutlined />}>Visitada</Tag>} />
  if (e === 'URGENTE') return <Badge status="error" text={<Tag color="red" icon={<ExclamationCircleOutlined />}>Urgente Stock</Tag>} />
  return <Badge status="processing" text={<Tag color="orange" icon={<ClockCircleOutlined />}>Pendiente</Tag>} />
}

const ListaMaquinas = () => {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = useMemo(
    () =>
      MAQUINAS_OPERADOR.filter(
        (m) => !search || (m.serial + m.zona + m.clienteNombre).toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  )

  const stats = useMemo(() => ({
    total: MAQUINAS_OPERADOR.length,
    pendientes: MAQUINAS_OPERADOR.filter((m) => m.estado_visita === 'PENDIENTE').length,
    visitadas: MAQUINAS_OPERADOR.filter((m) => m.estado_visita === 'VISITADA').length,
    urgentes: MAQUINAS_OPERADOR.filter((m) => m.estado_visita === 'URGENTE').length,
  }), [])

  return (
    <div>
      <Title level={4} style={{ margin: 0, marginBottom: 12 }}>
        <DesktopOutlined /> Mis Máquinas Asignadas
      </Title>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size="middle" wrap>
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px' }}>📋 Total: {stats.total}</Tag>
          <Tag color="orange" style={{ fontSize: 14, padding: '4px 10px' }}>⏳ Pendientes: {stats.pendientes}</Tag>
          <Tag color="green" style={{ fontSize: 14, padding: '4px 10px' }}>✅ Visitadas: {stats.visitadas}</Tag>
          <Tag color="red" style={{ fontSize: 14, padding: '4px 10px' }}>⚠ Urgentes: {stats.urgentes}</Tag>
        </Space>
      </Card>

      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder="Buscar serial, zona, cliente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <List
        itemLayout="horizontal"
        dataSource={filtered}
        renderItem={(item) => (
          <List.Item
            style={{ padding: 0, marginBottom: 10, borderRadius: 12, overflow: 'hidden' }}
          >
            <Card
              onClick={() => navigate(`/mobile/inventario/${item.id}`)}
              hoverable
              size="small"
              style={{
                width: '100%',
                borderLeft: `6px solid ${item.estado_visita === 'URGENTE' ? '#ff4d4f' : item.estado_visita === 'VISITADA' ? '#52c41a' : '#faad14'}`,
              }}
              title={
                <Space wrap>
                  <Avatar icon={<DesktopOutlined />} style={{ backgroundColor: '#1677ff' }} />
                  <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 16 }}>{item.serial}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <EnvironmentOutlined /> {item.zona}
                    </Text>
                  </Space>
                  <div style={{ marginLeft: 'auto' }}>{estadoBadge(item.estado_visita)}</div>
                </Space>
              }
            >
              <Space wrap>
                <Tag color="geekblue">{item.tipo}</Tag>
                <Tag>🏢 {item.clienteNombre}</Tag>
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}

export default ListaMaquinas
