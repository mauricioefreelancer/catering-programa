import { useState, useMemo } from 'react'
import {
  Table,
  Button,
  Space,
  message,
  Typography,
  Select,
  DatePicker,
  Row,
  Col,
  Card,
  Statistic,
  Tag,
  Form,
  Alert,
} from 'antd'
import { SearchOutlined, DownloadOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const CLIENTES = [
  { id: 1, nombre: 'Alimentos S.A.S.' },
  { id: 2, nombre: 'Empresa Servicios Ltda.' },
  { id: 3, nombre: 'Industrias Alimenticias' },
]

const PRODUCTOS_DOSIFICADOS = [
  { id: 4, nombre: 'Café Negro 12oz', precio: 3500 },
  { id: 5, nombre: 'Café con Leche', precio: 4000 },
  { id: 6, nombre: 'Chocolate Caliente', precio: 4200 },
  { id: 7, nombre: 'Té Negro', precio: 3200 },
]

const MAQUINAS_CAFE = [
  { id: 2, serial: 'CAF-00456', zona: 'Recepción Principal', clienteId: 2 },
  { id: 5, serial: 'CAF-00789', zona: 'Piso 5 - Lounge', clienteId: 1 },
  { id: 6, serial: 'CAF-00999', zona: 'Restaurante', clienteId: 3 },
]

interface RegistroNRQ {
  key: string
  maquinaSerial: string
  zona: string
  clienteNombre: string
  productoNombre: string
  precio: number
  nrq_inicial: number
  nrq_final: number
  nrq_diferencia: number
  total: number
}

const genMock = (start: Dayjs, end: Dayjs, clienteId?: number | null, productoId?: number | null): RegistroNRQ[] => {
  const result: RegistroNRQ[] = []
  let k = 0
  const dias = Math.max(1, end.diff(start, 'day') + 1)
  MAQUINAS_CAFE.forEach((m) => {
    if (clienteId && m.clienteId !== clienteId) return
    PRODUCTOS_DOSIFICADOS.forEach((p) => {
      if (productoId && p.id !== productoId) return
      const baseInit = Math.floor(Math.random() * 20000) + 50000
      const consumo = Math.floor((Math.random() * 80 + 20) * dias)
      const diff = consumo
      result.push({
        key: String(k++),
        maquinaSerial: m.serial,
        zona: m.zona,
        clienteNombre: CLIENTES.find((c) => c.id === m.clienteId)?.nombre || '',
        productoNombre: p.nombre,
        precio: p.precio,
        nrq_inicial: baseInit,
        nrq_final: baseInit + diff,
        nrq_diferencia: diff,
        total: diff * p.precio,
      })
    })
  })
  return result
}

const toCSV = (rows: RegistroNRQ[]) => {
  const header = ['Máquina', 'Zona', 'Cliente', 'Producto', 'Precio', 'NRQ Inicial', 'NRQ Final', 'Diferencia', 'Total $']
  const lines = [header.join(',')]
  rows.forEach((r) => {
    lines.push([
      r.maquinaSerial,
      r.zona,
      r.clienteNombre,
      r.productoNombre,
      r.precio,
      r.nrq_inicial,
      r.nrq_final,
      r.nrq_diferencia,
      r.total,
    ].join(','))
  })
  return lines.join('\n')
}

const descargarArchivo = (contenido: string, nombre: string, tipo: string) => {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
  console.log(`Exportado ${nombre}:`, contenido.slice(0, 200))
}

const FacturacionNRQ = () => {
  const [form] = Form.useForm()
  const [resultados, setResultados] = useState<RegistroNRQ[]>([])
  const [consultado, setConsultado] = useState(false)
  const [loading, setLoading] = useState(false)

  const totales = useMemo(() => {
    return {
      unidades: resultados.reduce((s, r) => s + r.nrq_diferencia, 0),
      monto: resultados.reduce((s, r) => s + r.total, 0),
      filas: resultados.length,
    }
  }, [resultados])

  const consultar = async (values: any) => {
    if (!values.fechas || values.fechas.length < 2) {
      message.error('Rango de fechas es requerido')
      return
    }
    setLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      const data = genMock(values.fechas[0], values.fechas[1], values.clienteId, values.productoId)
      setResultados(data)
      setConsultado(true)
      message.success(`${data.length} registros encontrados`)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (resultados.length === 0) return
    descargarArchivo(toCSV(resultados), `facturacion-nrq-${dayjs().format('YYYYMMDD-HHmm')}.csv`, 'text/csv;charset=utf-8;')
    message.success('CSV exportado')
  }

  const exportXLS = () => {
    if (resultados.length === 0) return
    const xls = `<table border="1">${toCSV(resultados).replace(/\n/g, '</tr><tr>').replace(/,/g, '</td><td>').replace(/^/, '<tr><td>').replace(/$/, '</td></tr>')}</table>`
    descargarArchivo(xls, `facturacion-nrq-${dayjs().format('YYYYMMDD-HHmm')}.xls`, 'application/vnd.ms-excel')
    message.success('Excel exportado (Blob)')
  }

  const maxDiff = useMemo(() => Math.max(0, ...resultados.map((r) => r.nrq_diferencia)), [resultados])

  const columns = [
    { title: 'Máquina', dataIndex: 'maquinaSerial', key: 'm', render: (v: string) => <code>{v}</code>, fixed: 'left' as const },
    { title: 'Zona', dataIndex: 'zona', key: 'z' },
    { title: 'Cliente', dataIndex: 'clienteNombre', key: 'c', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Producto Dosificado', dataIndex: 'productoNombre', key: 'p', render: (v) => <strong>{v}</strong> },
    { title: 'Precio Und', dataIndex: 'precio', key: 'pr', render: (v: number) => `$ ${v.toLocaleString('es-CO')}` },
    { title: 'NRQ Inicial', dataIndex: 'nrq_inicial', key: 'ni', align: 'right' as const },
    { title: 'NRQ Final', dataIndex: 'nrq_final', key: 'nf', align: 'right' as const },
    {
      title: 'NRQ Diferencia (Consumo)',
      dataIndex: 'nrq_diferencia',
      key: 'nd',
      align: 'right' as const,
      render: (v: number) => {
        const ratio = maxDiff > 0 ? v / maxDiff : 0
        const color = ratio > 0.7 ? '#ff4d4f' : ratio > 0.4 ? '#faad14' : '#52c41a'
        return <Tag color={color} style={{ fontWeight: 'bold', fontSize: 14 }}>{v} unid.</Tag>
      },
      sorter: (a, b) => a.nrq_diferencia - b.nrq_diferencia,
    },
    {
      title: 'Total $ Facturar',
      dataIndex: 'total',
      key: 't',
      align: 'right' as const,
      fixed: 'right' as const,
      render: (v: number) => <strong style={{ fontSize: 15, color: '#1677ff' }}>$ {v.toLocaleString('es-CO')}</strong>,
      sorter: (a, b) => a.total - b.total,
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <FileTextOutlined /> Facturación por Contadores NRQ (Dosificadoras Café)
      </Title>

      <Card title="🔎 Filtros de Consulta (Avanzados)" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={consultar} initialValues={{ fechas: [dayjs().startOf('month'), dayjs()] }}>
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item name="fechas" label="Rango de Fechas (Requerido)" rules={[{ required: true, message: 'Seleccione rango' }]}>
                <RangePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item name="clienteId" label="Filtrar por Cliente">
                <Select allowClear placeholder="Todos los clientes" size="large">
                  {CLIENTES.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item name="productoId" label="Filtrar Producto Dosificado">
                <Select allowClear placeholder="Todos los productos" size="large">
                  {PRODUCTOS_DOSIFICADOS.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setResultados([]); setConsultado(false); form.resetFields() }}>Limpiar</Button>
              <Button type="primary" size="large" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
                Consultar
              </Button>
            </Space>
          </div>
        </Form>
      </Card>

      {consultado && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}><Card size="small"><Statistic title="Registros" value={totales.filas} prefix={<SettingOutlined />} /></Card></Col>
            <Col xs={24} sm={8}><Card size="small"><Statistic title="Unidades Consumidas" value={totales.unidades} valueStyle={{ color: '#722ed1' }} /></Card></Col>
            <Col xs={24} sm={8}><Card size="small" style={{ border: '1px solid #1677ff' }}><Statistic title="💰 TOTAL A FACTURAR" value={totales.monto} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#1677ff', fontSize: 30 }} /></Card></Col>
          </Row>

          <Card
            title={`Resultados (${resultados.length} filas)`}
            extra={
              <Space>
                <Button icon={<DownloadOutlined />} onClick={exportCSV}>📄 Exportar CSV</Button>
                <Button type="primary" icon={<DownloadOutlined />} onClick={exportXLS}>📊 Exportar Excel (XLS)</Button>
              </Space>
            }
          >
            {resultados.length === 0 ? (
              <Alert type="info" showIcon message="No hay resultados para los filtros seleccionados." />
            ) : (
              <Table rowKey="key" dataSource={resultados} columns={columns} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} registros` }} scroll={{ x: 1100 }} size="middle" />
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default FacturacionNRQ
