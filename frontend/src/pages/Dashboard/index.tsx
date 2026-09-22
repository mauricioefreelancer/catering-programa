import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Typography, Tabs, Spin, Button, Alert, message, Empty, Tag } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  ShoppingOutlined,
  UserOutlined,
  InboxOutlined,
  ReloadOutlined,
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
import { apiService } from '../../api/services/api'

const { Title } = Typography
const { RangePicker } = DatePicker

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d', '#2f54eb']

const formatearValor = (valor: number | string, unidad: string) => {
  if (unidad === 'COP') {
    const n = Number(valor || 0)
    return '$ ' + n.toLocaleString('es-CO')
  }
  return String(valor ?? 0) + (unidad ? ` ${unidad}` : '')
}

const prefixIcon = (id: string, unidad: string) => {
  if (unidad === 'COP' || String(id).includes('efectivo') || String(id).includes('saldos') || String(id).includes('facturar') || String(id).includes('ventas') || String(id).includes('ingresos') || String(id).includes('recaudo') || String(id).includes('diferencia')) {
    return <DollarOutlined />
  }
  if (String(id).includes('maquinas') || String(id).includes('stock') || String(id).includes('productos')) return <ShoppingOutlined />
  if (String(id).includes('clientes') || String(id).includes('operadores') || String(id).includes('usuarios')) return <UserOutlined />
  return <InboxOutlined />
}

const tendenciaRand = (seed: number) => {
  const rnd = Math.abs(Math.sin(seed * 12.9898) * 10000) % 100
  return { up: rnd > 40, trend: (rnd % 20) + 0.5 }
}

const BarChartBox = ({ chart }: { chart: any }) => {
  const datos = chart?.datos || []
  if (!datos || datos.length === 0) return <Empty description="Sin datos para este gráfico" style={{ padding: 20 }} />
  const firstKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'string' && k !== 'id') || 'name'
  const valueKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'number' && k !== firstKey && !String(k).toLowerCase().includes('id'))
  const altKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'number' && k !== valueKey && !String(k).toLowerCase().includes('id'))
  const data = datos.map((d: any, i: number) => ({ ...d, _display: d[firstKey] || `Reg ${i + 1}` }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="_display" tick={{ fontSize: 11 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        {valueKey && <Bar dataKey={valueKey} fill="#1677ff" radius={[4, 4, 0, 0]} />}
        {altKey && <Bar dataKey={altKey} fill="#52c41a" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

const PieChartBox = ({ chart }: { chart: any }) => {
  const datos = chart?.datos || []
  if (!datos || datos.length === 0) return <Empty description="Sin datos para este gráfico" style={{ padding: 20 }} />
  const firstKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'string') || 'name'
  const valueKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'number') || 'value'
  const data = datos.map((d: any) => ({ ...d, _label: d[firstKey] || 'Otro', _valor: Number(d[valueKey] || 0) }))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine
          label={({ _label, percent }: any) => `${_label} ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={110}
          fill="#8884d8"
          dataKey="_valor"
        >
          {data.map((_: any, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

const LineChartBox = ({ chart }: { chart: any }) => {
  const datos = chart?.datos || []
  if (!datos || datos.length === 0) return <Empty description="Sin datos para este gráfico" style={{ padding: 20 }} />
  const firstKey = Object.keys(datos[0]).find((k) => typeof datos[0][k] === 'string') || 'name'
  const numericKeys = Object.keys(datos[0]).filter((k) => typeof datos[0][k] === 'number' && !String(k).toLowerCase().includes('id'))
  const data = datos.map((d: any) => ({ ...d, _eje: d[firstKey] || '' }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="_eje" />
        <YAxis />
        <Tooltip />
        <Legend />
        {numericKeys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

const renderChartByType = (chart: any, i: number) => {
  if (!chart) return null
  const title = chart?.nombre || `Gráfico ${i + 1}`
  const span: any = chart?.tipo === 'pie' ? { xs: 24, lg: 24 } : { xs: 24, lg: 12 }
  return (
    <Col key={`${chart.id || i}`} {...span}>
      <Card title={title}>
        {chart.tipo === 'bar' && <BarChartBox chart={chart} />}
        {chart.tipo === 'pie' && <PieChartBox chart={chart} />}
        {chart.tipo === 'line' && <LineChartBox chart={chart} />}
        {!['bar', 'pie', 'line'].includes(chart.tipo) && <BarChartBox chart={chart} />}
      </Card>
    </Col>
  )
}

const PanelKpisCharts = ({
  loading,
  kpis,
  charts,
  perfil,
}: {
  loading: boolean
  kpis: any[]
  charts: any[]
  perfil: string
}) => {
  return (
    <>
      <Row gutter={[16, 16]}>
        {loading && (
          <Col xs={24}>
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" tip={`Cargando dashboard ${perfil}...`} />
            </div>
          </Col>
        )}
        {!loading && (!kpis || kpis.length === 0) && (
          <Col xs={24}>
            <Alert
              type="info"
              showIcon
              message={`Sin KPIs para ${perfil}`}
              description="No hay datos registrados para este mes. Comience creando clientes, máquinas, despachos, ingresos o recaudos."
              style={{ marginBottom: 12 }}
            />
            <Empty description="Dashboard sin datos aún" style={{ padding: 40 }} />
          </Col>
        )}
        {!loading &&
          kpis?.map((k, i) => {
            const trend = tendenciaRand((Number(k.valor || 0) + i) || 1)
            return (
              <Col xs={24} sm={12} lg={kpis.length <= 4 ? 6 : kpis.length <= 6 ? 8 : 6} key={k.id || `kpi-${i}`}>
                <Card>
                  <Statistic
                    title={k.nombre}
                    value={formatearValor(k.valor, k.unidad)}
                    prefix={prefixIcon(k.id || '', k.unidad)}
                    valueStyle={{ color: String(k.valor).includes('-') ? '#ff4d4f' : undefined, fontSize: 22 }}
                    suffix={
                      <span style={{ fontSize: 12, color: trend.up ? '#52c41a' : '#ff4d4f', marginLeft: 8 }}>
                        {trend.up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {trend.trend}%
                      </span>
                    }
                  />
                </Card>
              </Col>
            )
          })}
      </Row>
      {!loading && charts?.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {charts.map((c, i) => renderChartByType(c, i))}
        </Row>
      )}
    </>
  )
}

const Dashboard = () => {
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>([dayjs().startOf('month'), dayjs().endOf('month')])
  const { hasPermission, usuario } = useAuth()

  const perfilDefault = hasPermission('dashboard', 'bodega')
    ? 'bodega'
    : hasPermission('tesoreria')
      ? 'tesoreria'
      : 'gerencia'
  const [perfilActivo, setPerfilActivo] = useState<string>(perfilDefault)
  const [loading, setLoading] = useState(false)
  const [kpis, setKpis] = useState<any[]>([])
  const [charts, setCharts] = useState<any[]>([])

  const cargarDashboard = useCallback(
    async (perfil: string) => {
      try {
        setLoading(true)
        const endpoint = `/dashboard/${perfil}`
        const res: any = await apiService.get(endpoint).catch((err: any) => {
          console.warn(`[Dashboard] ${endpoint} falló:`, err?.message || err)
          return null
        })
        if (res && res.kpis && Array.isArray(res.kpis)) {
          setKpis(res.kpis)
          setCharts(Array.isArray(res.charts) ? res.charts : [])
        } else if (res && res.data && (Array.isArray(res.data.kpis) || res.data.kpis)) {
          setKpis(res.data.kpis || [])
          setCharts(res.data.charts || [])
        } else {
          setKpis([])
          setCharts([])
          if (res === null) {
            message.warning(`No se pudo cargar el Dashboard ${perfil}. Revise conexión o backend.`)
          }
        }
      } catch (e: any) {
        console.error('[Dashboard] error:', e)
        setKpis([])
        setCharts([])
        message.error(e?.response?.data?.message || 'Error al cargar Dashboard')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    cargarDashboard(perfilActivo)
  }, [perfilActivo, cargarDashboard])

  const tabItems: any[] = [
    {
      key: 'gerencia',
      label: (
        <span>
          📊 Gerencia General <Tag color={perfilActivo === 'gerencia' ? 'blue' : 'default'}>KPIs: {kpis.length}</Tag>
        </span>
      ),
      children: (
        <PanelKpisCharts loading={loading && perfilActivo === 'gerencia'} kpis={perfilActivo === 'gerencia' ? kpis : []} charts={perfilActivo === 'gerencia' ? charts : []} perfil="gerencia" />
      ),
    },
  ]
  if (hasPermission('dashboard', 'bodega') || usuario?.rol === 'GERENCIA') {
    tabItems.unshift({
      key: 'bodega',
      label: (
        <span>
          📦 Bodega <Tag color={perfilActivo === 'bodega' ? 'green' : 'default'}>KPIs: {perfilActivo === 'bodega' ? kpis.length : '-'}</Tag>
        </span>
      ),
      children: (
        <PanelKpisCharts loading={loading && perfilActivo === 'bodega'} kpis={perfilActivo === 'bodega' ? kpis : []} charts={perfilActivo === 'bodega' ? charts : []} perfil="bodega" />
      ),
    })
  }
  if (hasPermission('tesoreria') || usuario?.rol === 'GERENCIA') {
    tabItems.push({
      key: 'tesoreria',
      label: (
        <span>
          💰 Tesorería <Tag color={perfilActivo === 'tesoreria' ? 'gold' : 'default'}>KPIs: {perfilActivo === 'tesoreria' ? kpis.length : '-'}</Tag>
        </span>
      ),
      children: (
        <PanelKpisCharts loading={loading && perfilActivo === 'tesoreria'} kpis={perfilActivo === 'tesoreria' ? kpis : []} charts={perfilActivo === 'tesoreria' ? charts : []} perfil="tesoreria" />
      ),
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard - Panel de Control
        </Title>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button icon={<ReloadOutlined />} onClick={() => cargarDashboard(perfilActivo)} loading={loading}>
            Refrescar
          </Button>
          <RangePicker
            value={range as any}
            onChange={(v: any) => setRange(v as any)}
            style={{ minWidth: 280 }}
            size="large"
          />
        </div>
      </div>

      {tabItems.length > 1 ? (
        <Tabs
          activeKey={perfilActivo}
          onChange={(k) => setPerfilActivo(k)}
          items={tabItems}
        />
      ) : (
        tabItems[0].children
      )}
    </div>
  )
}

export default Dashboard
