import { useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Typography, Tabs } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  ShoppingOutlined,
  UserOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import dayjs, { Dayjs } from 'dayjs'
import { useAuth } from '../../hooks/useAuth'

const { Title } = Typography
const { RangePicker } = DatePicker

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2']

const mockKpis = (perfil: string) => {
  if (perfil === 'bodega') {
    return [
      { title: 'Ingresos Mes', value: '$ 48.520.000', prefix: <DollarOutlined />, trend: 12.5, up: true },
      { title: 'Productos en Stock', value: '1.248', prefix: <ShoppingOutlined />, trend: 3.1, up: true },
      { title: 'Stock Bajo Mínimo', value: '37', prefix: <InboxOutlined />, trend: 5, up: false, color: '#faad14' },
      { title: 'Proveedores Activos', value: '42', prefix: <UserOutlined />, trend: 1, up: true },
    ]
  }
  if (perfil === 'tesoreria') {
    return [
      { title: 'Recaudo Efectivo', value: '$ 32.180.000', prefix: <DollarOutlined />, trend: 8.2, up: true },
      { title: 'Saldos Plataformas', value: '$ 14.920.000', prefix: <DollarOutlined />, trend: 4.3, up: true },
      { title: 'Facturación NRQ', value: '$ 8.450.000', prefix: <DollarOutlined />, trend: 1.5, up: false },
      { title: 'Máquinas Activas', value: '128', prefix: <InboxOutlined />, trend: 2, up: true },
    ]
  }
  return [
    { title: 'Ventas Totales', value: '$ 128.450.000', prefix: <DollarOutlined />, trend: 15.3, up: true },
    { title: 'Clientes Activos', value: '78', prefix: <UserOutlined />, trend: 6.2, up: true },
    { title: 'Despachos Hoy', value: '142', prefix: <InboxOutlined />, trend: 9.1, up: true },
    { title: 'Márgen Utilidad', value: '34.2%', prefix: <DollarOutlined />, trend: 2.1, up: true },
  ]
}

const mockBar = [
  { name: 'Coca 350ml', value: 482, amount: 1450000 },
  { name: 'Agua 500ml', value: 415, amount: 830000 },
  { name: 'Jugo Manzana', value: 320, amount: 960000 },
  { name: 'Galleta Oreo', value: 298, amount: 745000 },
  { name: 'Chocorramo', value: 265, amount: 662500 },
  { name: 'Papas Margarita', value: 210, amount: 525000 },
]

const mockLine = [
  { mes: 'Ene', ventas: 4200000, costos: 2800000 },
  { mes: 'Feb', ventas: 4800000, costos: 3100000 },
  { mes: 'Mar', ventas: 5100000, costos: 3300000 },
  { mes: 'Abr', ventas: 4600000, costos: 3000000 },
  { mes: 'May', ventas: 5900000, costos: 3700000 },
  { mes: 'Jun', ventas: 6400000, costos: 4100000 },
]

const mockPie = [
  { name: 'Clientes Corporativos', value: 420 },
  { name: 'Oficinas', value: 310 },
  { name: 'Universidades', value: 240 },
  { name: 'Centros Comerciales', value: 180 },
  { name: 'Hospitales', value: 120 },
]

const BodegaDashboard = () => (
  <>
    <Row gutter={[16, 16]}>
      {mockKpis('bodega').map((k, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card>
            <Statistic
              title={k.title}
              value={k.value}
              prefix={k.prefix}
              valueStyle={{ color: k.color }}
              suffix={
                <span style={{ fontSize: 12, color: k.up ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                  {k.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {k.trend}%
                </span>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>
        <Card title="Top 6 Productos Movimiento">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockBar}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1677ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Tendencia Ingresos vs Costos (Mes)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockLine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="costos" stroke="#faad14" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="Distribución de Stock por Zona">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={mockPie}
                cx="50%"
                cy="50%"
                labelLine
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {mockPie.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  </>
)

const TesoreriaDashboard = () => (
  <>
    <Row gutter={[16, 16]}>
      {mockKpis('tesoreria').map((k, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card>
            <Statistic
              title={k.title}
              value={k.value}
              prefix={k.prefix}
              valueStyle={{ color: k.color }}
              suffix={
                <span style={{ fontSize: 12, color: k.up ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                  {k.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {k.trend}%
                </span>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>
        <Card title="Recaudo por Máquina (Top)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockBar}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#52c41a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Evolución Recaudo Mensual">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockLine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="costos" stroke="#eb2f96" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="Distribución por Plataforma de Pago">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={mockPie}
                cx="50%"
                cy="50%"
                labelLine
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {mockPie.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  </>
)

const GerenciaDashboard = () => (
  <>
    <Row gutter={[16, 16]}>
      {mockKpis('gerencia').map((k, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card>
            <Statistic
              title={k.title}
              value={k.value}
              prefix={k.prefix}
              valueStyle={{ color: k.color }}
              suffix={
                <span style={{ fontSize: 12, color: k.up ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                  {k.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {k.trend}%
                </span>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>
        <Card title="Top Productos por Ventas ($)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockBar}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#722ed1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Tendencia Ventas vs Costos Anual">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockLine}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ventas" stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="costos" stroke="#ff4d4f" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24}>
        <Card title="Distribución Ventas por Segmento Cliente">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={mockPie}
                cx="50%"
                cy="50%"
                labelLine
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="value"
              >
                {mockPie.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  </>
)

const Dashboard = () => {
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>([dayjs().startOf('month'), dayjs().endOf('month')])
  const { hasPermission, usuario } = useAuth()

  const perfil = hasPermission('dashboard', 'bodega') ? 'bodega' : hasPermission('tesoreria') ? 'tesoreria' : 'gerencia'

  const tabItems = [
    { key: 'gerencia', label: '📊 Gerencia General', children: <GerenciaDashboard /> },
  ]
  if (hasPermission('dashboard', 'bodega') || usuario?.rol === 'GERENCIA') {
    tabItems.unshift({ key: 'bodega', label: '📦 Bodega', children: <BodegaDashboard /> })
  }
  if (hasPermission('tesoreria') || usuario?.rol === 'GERENCIA') {
    tabItems.push({ key: 'tesoreria', label: '💰 Tesorería', children: <TesoreriaDashboard /> })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard - Panel de Control
        </Title>
        <RangePicker
          value={range as any}
          onChange={(v: any) => setRange(v as any)}
          style={{ minWidth: 280 }}
          size="large"
        />
      </div>

      {tabItems.length > 1 ? (
        <Tabs defaultActiveKey={perfil} items={tabItems} />
      ) : (
        tabItems[0].children
      )}
    </div>
  )
}

export default Dashboard
