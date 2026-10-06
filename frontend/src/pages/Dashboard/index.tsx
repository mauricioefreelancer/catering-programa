import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Typography, Tabs, Spin, Button, Alert, message, Empty, Tag, Table, Select, Input } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  ShoppingOutlined,
  UserOutlined,
  InboxOutlined,
  ReloadOutlined,
  DownloadOutlined,
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
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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

const PanelProductosStock = () => {
  const [loading, setLoading] = useState(false)
  const [productos, setProductos] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiService.get('/productos?limit=2000&take=2000')
      const lista = Array.isArray(res) ? res : (res?.data || [])
      const norm = lista.map((p: any) => ({
        id: p.idProducto ?? p.id,
        nombre: p.nombreProducto ?? p.nombre ?? '—',
        codigo: p.codigoBarras ?? p.codigo_barras ?? '—',
        stockActual: Number(p.stockActual ?? p.stock_actual ?? 0),
        stockMin: Number(p.stockMin ?? p.stock_min ?? 0),
        stockMax: Number(p.stockMax ?? p.stock_max ?? 0),
        categoria: p.categoriaInsumo ?? p.categoria_insumo ?? null,
        estado: p.estado,
      }))
      setProductos(norm)
    } catch (e: any) {
      message.error('Error cargando productos: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const sobreStock = productos.filter((p) => Number(p.stockMax) > 0 && Number(p.stockActual) > Number(p.stockMax))
  const bajoStock = productos.filter((p) => Number(p.stockMin) > 0 && Number(p.stockActual) <= Number(p.stockMin))

  // Búsqueda por nombre o código (sensible al escaneo de código de barras).
  const termino = busqueda.trim().toLowerCase()
  const productosFiltrados = termino
    ? productos.filter((p) =>
        String(p.nombre || '').toLowerCase().includes(termino) ||
        String(p.codigo || '').toLowerCase().includes(termino)
      )
    : productos

  const colsStock = [
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', render: (v: string) => <strong>{v}</strong> },
    { title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 170, render: (v: string) => (v && v !== '—' ? <code>{v}</code> : <span style={{ color: '#bbb' }}>—</span>) },
    { title: 'Categoría', dataIndex: 'categoria', key: 'categoria', width: 180, render: (v: string | null) => (v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>) },
    {
      title: 'Stock Actual',
      dataIndex: 'stockActual',
      key: 'stockActual',
      width: 140,
      render: (v: number, r: any) => {
        const marcador = Number(r.stockMax) > 0 && Number(v) > Number(r.stockMax) ? 'orange'
          : Number(r.stockMin) > 0 && Number(v) <= Number(r.stockMin) ? 'red' : 'green'
        return <Tag color={marcador}>{v} uds</Tag>
      },
    },
    { title: 'Stock Mínimo', dataIndex: 'stockMin', key: 'stockMin', width: 130 },
    { title: 'Stock Máximo', dataIndex: 'stockMax', key: 'stockMax', width: 130 },
  ]

  const cols = (tipo: 'sobre' | 'bajo') => [
    { title: 'Producto', dataIndex: 'nombre', key: 'nombre', render: (v: string) => <strong>{v}</strong> },
    { title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 150 },
    {
      title: 'Categoría',
      dataIndex: 'categoria',
      key: 'categoria',
      width: 180,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>),
    },
    {
      title: 'Stock Actual',
      dataIndex: 'stockActual',
      key: 'stockActual',
      width: 140,
      render: (v: number) => <Tag color={tipo === 'sobre' ? 'orange' : 'red'}>{v} uds</Tag>,
    },
    { title: 'Stock Mínimo', dataIndex: 'stockMin', key: 'stockMin', width: 130 },
    { title: 'Stock Máximo', dataIndex: 'stockMax', key: 'stockMax', width: 130 },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginTop: 4 }}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={`🟠 SobreStock (${sobreStock.length})`}
            extra={<Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} size="small">Refrescar</Button>}
          >
            <Alert
              type="warning"
              showIcon
              message="Productos por encima de su stock máximo."
              style={{ marginBottom: 12 }}
            />
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={sobreStock}
              columns={cols('sobre') as any}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: 'Sin productos en sobrestock' }}
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={`🔴 Bajo Stock (${bajoStock.length})`}
            extra={<Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} size="small">Refrescar</Button>}
          >
            <Alert
              type="error"
              showIcon
              message="Productos en o por debajo de su stock mínimo."
              style={{ marginBottom: 12 }}
            />
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={bajoStock}
              columns={cols('bajo') as any}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: 'Sin productos con bajo stock' }}
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="📦 Stock Actual de Todos los Productos" style={{ marginTop: 16 }} extra={<Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} size="small">Refrescar</Button>}>
        <Alert
          type="info"
          showIcon
          message='Busca productos por nombre o por código. El campo de código soporta escaneo con lector de código de barras: escanea y presiona Enter.'
          style={{ marginBottom: 12 }}
        />
        <Input.Search
          allowClear
          value={busqueda}
          placeholder="Buscar por nombre o código de barras (escanea y Enter)..."
          onChange={(e) => setBusqueda(e.target.value)}
          size="middle"
          style={{ maxWidth: 420, marginBottom: 12 }}
          enterButton
        />
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={productosFiltrados}
          columns={colsStock as any}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: 'Sin productos que coincidan con la búsqueda' }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  )
}

const PanelDispositivos = () => {
  const [loading, setLoading] = useState(false)
  const [datos, setDatos] = useState<any>({ kpis: [], intervalos: [] })
  const [rangeDisp, setRangeDisp] = useState<[Dayjs | null, Dayjs | null] | null>([dayjs().subtract(3, 'month'), dayjs()])
  const [maquinaFiltro, setMaquinaFiltro] = useState<string>('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [maquinas, setMaquinas] = useState<any[]>([])

  const cargarMaquinas = useCallback(async () => {
    try {
      const res: any = await apiService.get('/maquinas?take=2000')
      const lista = Array.isArray(res) ? res : (res?.data || [])
      setMaquinas(lista.map((m: any) => ({ id: m.idMaquina ?? m.id, serial: m.serial ?? '—' })))
    } catch {
      setMaquinas([])
    }
  }, [])

  useEffect(() => { cargarMaquinas() }, [cargarMaquinas])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (rangeDisp && rangeDisp[0]) params.fechaDesde = rangeDisp[0].toISOString()
      if (rangeDisp && rangeDisp[1]) params.fechaHasta = rangeDisp[1].toISOString()
      if (maquinaFiltro) params.maquinaId = maquinaFiltro
      if (tipoFiltro) params.tipoMedio = tipoFiltro
      const res: any = await apiService.get('/dashboard/dispositivos', params)
      setDatos({
        kpis: Array.isArray(res?.kpis) ? res.kpis : [],
        intervalos: Array.isArray(res?.intervalos) ? res.intervalos : [],
      })
    } catch (e: any) {
      message.error('Error cargando historial de dispositivos: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [rangeDisp, maquinaFiltro, tipoFiltro])

  useEffect(() => { cargar() }, [cargar])

  const colorAccion = (a: string) => {
    const s = String(a || '').toUpperCase()
    if (s.includes('ASIGNAR') || s.includes('ACTIVAR')) return 'green'
    if (s.includes('CAMBIAR')) return 'orange'
    if (s.includes('QUITAR') || s.includes('INACTIVAR')) return 'red'
    if (s.includes('CREAR')) return 'blue'
    return 'default'
  }

  const columns = [
    { title: 'Máquina', dataIndex: 'serialMaquina', key: 'serialMaquina', width: 140, render: (v: string, r: any) => (<div><strong>{v || '—'}</strong>{r.marca ? <div style={{ fontSize: 11, color: '#888' }}>{r.marca}</div> : null}<div style={{ fontSize: 11, color: '#888' }}>{r.cliente || ''}</div></div>) },
    { title: 'Medio', dataIndex: 'tipoMedio', key: 'tipoMedio', width: 110, render: (v: string) => <Tag>{v || '—'}</Tag> },
    { title: 'Serial Dispositivo', dataIndex: 'serialDispositivo', key: 'serialDispositivo', width: 170, render: (v: string) => <code>{v || '—'}</code> },
    { title: 'Desde', dataIndex: 'desde', key: 'desde', width: 170, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
    { title: 'Hasta', dataIndex: 'hasta', key: 'hasta', width: 170, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : <Tag color="green">Vigente</Tag>) },
    { title: 'Acción', dataIndex: 'accion', key: 'accion', width: 150, render: (v: string) => <Tag color={colorAccion(v)}>{v || '—'}</Tag> },
    { title: 'Usuario', dataIndex: 'usuario', key: 'usuario', width: 200, render: (v: string) => (v || <span style={{ color: '#bbb' }}>—</span>) },
    { title: 'Anterior → Nuevo', key: 'cambio', render: (_: any, r: any) => {
        const prev = r?.valorAnterior?.serialVeos ?? Object.values(r?.valorAnterior ?? {})[0]
        const next = r?.valorNuevo?.serialVeos ?? Object.values(r?.valorNuevo ?? {})[0]
        return <span style={{ fontSize: 12 }}>{prev ? <span style={{ textDecoration: 'line-through', color: '#999' }}>{prev}</span> : '—'} → <strong>{next || '—'}</strong></span>
      } },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={7}>
            <RangePicker
              value={rangeDisp as any}
              onChange={(v: any) => setRangeDisp(v as any)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              allowClear
              showSearch
              value={maquinaFiltro || undefined}
              placeholder="Filtrar por máquina"
              onChange={(v: any) => setMaquinaFiltro(v ? String(v) : '')}
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={maquinas.map((m) => ({ value: String(m.id), label: `#${m.id} - ${m.serial}` }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Select
              allowClear
              value={tipoFiltro || undefined}
              placeholder="Tipo de medio"
              onChange={(v: any) => setTipoFiltro(v ? String(v) : '')}
              style={{ width: '100%' }}
              options={['VEOS', 'DATAFONO', 'CUPOS', 'EFECTIVO'].map((t) => ({ value: t, label: t }))}
            />
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
              Buscar
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {(datos.kpis || []).map((k: any, i: number) => (
          <Col xs={12} lg={6} key={k.id || `dkpi-${i}`}>
            <Card size="small">
              <Statistic title={k.nombre} value={Number(k.valor || 0)} valueStyle={{ fontSize: 20 }} suffix={k.unidad ? '' : undefined} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="Mapeo de dispositivos por máquina y fechas" style={{ marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message="Aquí puedes ver de qué fecha a qué fecha estuvo cada serial (dispositivo) en una máquina, incluidos cambios provisionales o definitivos, y qué usuario lo asignó."
          style={{ marginBottom: 12 }}
        />
        {!loading && !datos.intervalos?.length && (
          <Empty description="Sin historial de dispositivos para el filtro seleccionado" style={{ padding: 30 }} />
        )}
        <Table
          rowKey={(r: any) => `${r.idMaquina}-${r.tipoMedio}-${r.serialDispositivo}-${r.desde}`}
          size="small"
          loading={loading}
          dataSource={datos.intervalos || []}
          columns={columns as any}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}

const PanelIngresosBodega = () => {
  const [loading, setLoading] = useState(false)
  const [datos, setDatos] = useState<any>({ kpis: [], ingresos: [], usuarios: [] })
  const [rangeIng, setRangeIng] = useState<[Dayjs | null, Dayjs | null] | null>([dayjs().subtract(3, 'month'), dayjs()])
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (rangeIng && rangeIng[0]) params.fechaDesde = rangeIng[0].startOf('day').toISOString()
      if (rangeIng && rangeIng[1]) params.fechaHasta = rangeIng[1].endOf('day').toISOString()
      if (usuarioFiltro) params.usuarioId = usuarioFiltro
      const res: any = await apiService.get('/dashboard/ingresos-bodega', params)
      setDatos({
        kpis: Array.isArray(res?.kpis) ? res.kpis : [],
        ingresos: Array.isArray(res?.ingresos) ? res.ingresos : [],
        usuarios: Array.isArray(res?.usuarios) ? res.usuarios : [],
      })
    } catch (e: any) {
      message.error('Error cargando ingresos a bodega: ' + (e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [rangeIng, usuarioFiltro])

  useEffect(() => { cargar() }, [cargar])

  const descargarPDFIngreso = (ing: any) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 16

    // Encabezado sobrio
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(33, 37, 41)
    doc.text('INGRESO A BODEGA', margin, 17)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90)
    doc.text(`Generado: ${new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`, pageWidth - margin, 17, { align: 'right' })
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(margin, 21, pageWidth - margin, 21)

    const detalle = Array.isArray(ing.detalle) ? ing.detalle : []
    let totalUnidades = 0
    let totalValor = 0
    for (const d of detalle) {
      totalUnidades += Number(d.cantidad || 0)
      totalValor += Number(d.costoTotal || 0)
    }

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(33, 37, 41)
    let y = 28
    doc.text('DATOS DE LA FACTURA', margin, y)
    y += 3.5
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: { top: 1.4, right: 2, bottom: 1.4, left: 0 } },
      columnStyles: { 0: { fontStyle: 'bold', textColor: [90, 90, 90], cellWidth: 55 }, 1: { textColor: [33, 37, 41] } },
      margin: { left: margin, right: margin },
      body: [
        ['Nº de Factura', ing.factura || '—'],
        ['Fecha', ing.fecha ? dayjs(ing.fecha).format('DD/MM/YYYY HH:mm') : '—'],
        ['Proveedor', ing.proveedor || '—'],
        ['Observaciones', ing.observaciones || '—'],
        ['Ingresado por', `${ing.usuario || '—'}${ing.login ? ` (@${ing.login})` : ''}`],
      ],
    })
    y = (doc as any).lastAutoTable.finalY as number

    y += 6
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(33, 37, 41)
    let tituloDetalle = `PRODUCTOS (${detalle.length})`
    doc.text(tituloDetalle, margin, y)
    y += 3.5
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fillColor: [52, 58, 64], textColor: 255 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      margin: { left: margin, right: margin },
      head: [['Producto', 'Cantidad', 'Costo Unitario', 'Costo Total']],
      body: detalle.length
        ? detalle.map((d: any) => [
            d.producto || '—',
            `${d.cantidad || 0} uds`,
            `$ ${Number(d.costoUnitario || 0).toLocaleString('es-CO')}`,
            `$ ${Number(d.costoTotal || 0).toLocaleString('es-CO')}`,
          ])
        : [['Sin detalle de productos', '', '', '']],
      foot: [
        ['TOTAL', `${totalUnidades} uds`, '', `$ ${totalValor.toLocaleString('es-CO')}`],
      ],
      footStyles: { fillColor: [240, 240, 240], textColor: 33, fontStyle: 'bold' },
    })

    const fileName = `IngresoBodega_${String(ing.factura || ing.idIngreso).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`
    doc.save(fileName)
  }

  const expandable = {
    expandedRowRender: (ing: any) => {
      const cols = [
        { title: 'Producto', dataIndex: 'producto', key: 'producto', render: (v: string) => <strong>{v || '—'}</strong> },
        { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', render: (v: number) => `${v} uds` },
        { title: 'Costo Unitario', dataIndex: 'costoUnitario', key: 'costoUnitario', render: (v: number) => `$ ${v.toLocaleString('es-CO')}` },
        { title: 'Costo Total', dataIndex: 'costoTotal', key: 'costoTotal', render: (v: number) => <Tag color="blue">$ {v.toLocaleString('es-CO')}</Tag> },
      ]
      return (
        <Table
          rowKey={(r: any) => `${ing.idIngreso}-${r.idDetIngreso ?? r.idProducto}`}
          size="small"
          dataSource={ing.detalle || []}
          columns={cols as any}
          pagination={false}
          locale={{ emptyText: 'Sin detalle de productos' }}
          scroll={{ x: 500 }}
        />
      )
    },
  }

  const columns = [
    { title: 'Factura', dataIndex: 'factura', key: 'factura', width: 140, render: (v: string) => <code>{v || '—'}</code> },
    { title: 'Fecha', dataIndex: 'fecha', key: 'fecha', width: 170, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
    { title: 'Proveedor', dataIndex: 'proveedor', key: 'proveedor', width: 220, render: (v: string) => (v || <span style={{ color: '#bbb' }}>—</span>) },
    { title: 'Productos', dataIndex: 'detalle', key: 'nprod', width: 110, render: (d: any[]) => <Tag color="geekblue">{d?.length || 0} ítems</Tag> },
    { title: 'Observaciones', dataIndex: 'observaciones', key: 'obs', render: (v: string) => (v || <span style={{ color: '#bbb' }}>—</span>) },
    { title: 'Ingresado por', dataIndex: 'usuario', key: 'usuario', width: 200, render: (v: string, r: any) => (<div>{v || '—'}{r.login ? <div style={{ fontSize: 11, color: '#888' }}>@{r.login}</div> : null}</div>) },
    { title: '', dataIndex: 'idIngreso', key: 'pdf', width: 130, align: 'center' as any, render: (_: any, ing: any) => (
        <Button size="small" icon={<DownloadOutlined />} onClick={() => descargarPDFIngreso(ing)}>Descargar PDF</Button>
      ) },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={9}>
            <RangePicker
              value={rangeIng as any}
              onChange={(v: any) => setRangeIng(v as any)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              allowClear
              showSearch
              value={usuarioFiltro || undefined}
              placeholder="Filtrar por usuario que ingresó"
              onChange={(v: any) => setUsuarioFiltro(v ? String(v) : '')}
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={(datos.usuarios || []).map((u: any) => ({ value: String(u.id), label: `${u.nombre}${u.login ? ` (@${u.login})` : ''}` }))}
            />
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
              Buscar
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {(datos.kpis || []).map((k: any, i: number) => (
          <Col xs={12} lg={6} key={k.id || `ikpi-${i}`}>
            <Card size="small">
              <Statistic
                title={k.nombre}
                value={formatearValor(k.valor, k.unidad)}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="Ingresos a bodega por rango de fechas y usuario" style={{ marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message="Consulta los ingresos a bodega (compras) registrados en el rango de fechas seleccionado, con su factura, proveedor, productos, cantidades y costos, así como el usuario que realizó cada ingreso."
          style={{ marginBottom: 12 }}
        />
        {!loading && !datos.ingresos?.length && (
          <Empty description="Sin ingresos a bodega para el filtro seleccionado" style={{ padding: 30 }} />
        )}
        <Table
          rowKey="idIngreso"
          size="small"
          loading={loading}
          dataSource={datos.ingresos || []}
          columns={columns as any}
          expandable={expandable}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
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
    // Las pestañas 'productos', 'dispositivos' e 'ingresos-bodega' cargan sus propios datos; no consultan KPIs.
    if (perfilActivo !== 'productos' && perfilActivo !== 'dispositivos' && perfilActivo !== 'ingresos-bodega') {
      cargarDashboard(perfilActivo)
    }
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
  if (hasPermission('dashboard', 'bodega') || hasPermission('productos', 'ver') || usuario?.rol === 'GERENCIA') {
    tabItems.unshift({
      key: 'productos',
      label: (
        <span>
          🛍️ Productos <Tag color={perfilActivo === 'productos' ? 'orange' : 'default'}>Stock</Tag>
        </span>
      ),
      children: <PanelProductosStock />,
    })
  }
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
  if (hasPermission('dashboard', 'ver') || usuario?.rol === 'GERENCIA') {
    tabItems.push({
      key: 'dispositivos',
      label: (
        <span>
          🖥️ Dispositivos <Tag color={perfilActivo === 'dispositivos' ? 'purple' : 'default'}>Seriales</Tag>
        </span>
      ),
      children: <PanelDispositivos />,
    })
  }
  if (hasPermission('dashboard', 'ver') || usuario?.rol === 'GERENCIA') {
    tabItems.push({
      key: 'ingresos-bodega',
      label: (
        <span>
          🏭 Ingresos Bodega <Tag color={perfilActivo === 'ingresos-bodega' ? 'cyan' : 'default'}>Compras</Tag>
        </span>
      ),
      children: <PanelIngresosBodega />,
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard - Panel de Control
        </Title>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button icon={<ReloadOutlined />} onClick={() => { if (perfilActivo !== 'productos' && perfilActivo !== 'dispositivos' && perfilActivo !== 'ingresos-bodega') cargarDashboard(perfilActivo) }} loading={loading}>
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
