import { useState, useMemo, useEffect, useCallback } from 'react'
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
  Spin,
} from 'antd'
import { SearchOutlined, DownloadOutlined, FileTextOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { apiService } from '../../../api/services/api'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

interface ClienteNRQ {
  id: number
  nombre: string
  razonSocial?: string
}

interface ProductoDosificado {
  id: number
  nombre: string
  precio: number
  tipoProducto?: string
}

interface MaquinaCafe {
  id: number
  serial: string
  zona: string
  clienteId: number
}

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

  const [clientes, setClientes] = useState<ClienteNRQ[]>([])
  const [productosDosificados, setProductosDosificados] = useState<ProductoDosificado[]>([])
  const [maquinasCafe, setMaquinasCafe] = useState<MaquinaCafe[]>([])
  const [fetching, setFetching] = useState<boolean>(true)
  const [initialLoading, setInitialLoading] = useState<boolean>(true)

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [clientesRes, productosRes, maquinasRes] = await Promise.all([
        apiService.get<any>('/clientes').catch(() => ({ data: [] })),
        apiService.get<any>('/productos').catch(() => ({ data: [] })),
        apiService.get<any>('/maquinas').catch(() => ({ data: [] })),
      ])

      const clientesList = Array.isArray(clientesRes) ? clientesRes : clientesRes?.data ?? []
      const productosList = Array.isArray(productosRes) ? productosRes : productosRes?.data ?? []
      const maquinasList = Array.isArray(maquinasRes) ? maquinasRes : maquinasRes?.data ?? []

      const clientesMapeados: ClienteNRQ[] = clientesList.map((c: any) => ({
        id: c.idCliente ?? c.id,
        nombre: c.razonSocial ?? c.nombre ?? '',
        razonSocial: c.razonSocial,
      }))

      const productosMapeados: ProductoDosificado[] = productosList
        .filter((p: any) => {
          const tipo = String(p.Tipo_Producto ?? p.tipoProducto ?? p.tipo ?? '').toUpperCase()
          return tipo === 'DOSIFICADO' || tipo === 'DOSIFICADA' || tipo === 'DOSIFICADOS'
        })
        .map((p: any) => ({
          id: p.idProducto ?? p.id,
          nombre: p.nombreProducto ?? p.nombre ?? '',
          precio: p.precioVenta ?? p.precio_venta ?? p.costoTotal ?? p.costo_total ?? 0,
          tipoProducto: p.Tipo_Producto ?? p.tipoProducto,
        }))

      const maquinasMapeadas: MaquinaCafe[] = maquinasList
        .filter((m: any) => {
          const tipo = String(m.Tipo_Maquina ?? m.tipo ?? '').toUpperCase()
          return tipo === 'CAFE' || tipo === 'CAFÉ'
        })
        .map((m: any) => ({
          id: m.idMaquina ?? m.id,
          serial: m.serial ?? '',
          zona: m.ubicacionEsp ?? m.zona ?? '',
          clienteId: m.idCliente ?? m.clienteId,
        }))

      setClientes(clientesMapeados)
      setProductosDosificados(productosMapeados)
      setMaquinasCafe(maquinasMapeadas)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar catálogos')
    } finally {
      setFetching(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totales = useMemo(() => {
    return {
      unidades: resultados.reduce((s, r) => s + r.nrq_diferencia, 0),
      monto: resultados.reduce((s, r) => s + r.total, 0),
      filas: resultados.length,
    }
  }, [resultados])

  const mapearResultados = (rawList: any[]): RegistroNRQ[] => {
    return rawList.map((r: any, i: number) => {
      const maquinaId = r.idMaquina ?? r.maquinaId
      const maquina = maquinasCafe.find((m) => m.id === maquinaId)
      const clienteId = r.idCliente ?? r.clienteId ?? maquina?.clienteId
      const cliente = clientes.find((c) => c.id === clienteId)
      const productoId = r.idProducto ?? r.productoId
      const producto = productosDosificados.find((p) => p.id === productoId)

      const precio = Number(r.precio ?? r.precioUnitario ?? producto?.precio ?? 0)
      const ni = Number(r.nrq_inicial ?? r.nrInicial ?? r.inicial ?? 0)
      const nf = Number(r.nrq_final ?? r.nrFinal ?? r.final ?? 0)
      const diff = Number(r.nrq_diferencia ?? r.diferencia ?? (nf - ni) ?? 0)

      return {
        key: String(i),
        maquinaSerial: r.maquina?.serial ?? r.maquinaSerial ?? maquina?.serial ?? '',
        zona: r.zona ?? maquina?.zona ?? '',
        clienteNombre: r.cliente?.razonSocial ?? r.clienteNombre ?? cliente?.nombre ?? '',
        productoNombre: r.producto?.nombre ?? r.productoNombre ?? producto?.nombre ?? '',
        precio,
        nrq_inicial: ni,
        nrq_final: nf,
        nrq_diferencia: diff,
        total: Number(r.total ?? diff * precio),
      }
    })
  }

  const consultar = async (values: any) => {
    if (!values.fechas || values.fechas.length < 2) {
      message.error('Rango de fechas es requerido')
      return
    }
    setLoading(true)
    try {
      const params: Record<string, any> = {
        fechaInicio: dayjs(values.fechas[0]).format('YYYY-MM-DD'),
        fechaFin: dayjs(values.fechas[1]).format('YYYY-MM-DD'),
      }
      if (values.clienteId) params.idCliente = values.clienteId
      if (values.productoId) params.idProducto = values.productoId

      let rawData: any[] = []
      let encontroDatos = false

      try {
        const res: any = await apiService.get('/tesoreria/facturacion-nrq', params)
        const lista = Array.isArray(res) ? res : res?.data ?? []
        if (Array.isArray(lista) && lista.length > 0) {
          rawData = lista
          encontroDatos = true
        }
      } catch {
        encontroDatos = false
      }

      if (!encontroDatos) {
        try {
          const dashRes: any = await apiService.get('/dashboard/tesoreria', params)
          const charts = dashRes?.charts ?? dashRes?.data?.charts ?? []
          if (Array.isArray(charts) && charts.length > 0) {
            const todos: any[] = []
            charts.forEach((ch: any) => {
              const datos = ch?.datos ?? []
              if (Array.isArray(datos)) todos.push(...datos)
            })
            if (todos.length > 0) {
              rawData = todos
              encontroDatos = true
            }
          }
        } catch {
          encontroDatos = false
        }
      }

      if (!encontroDatos || rawData.length === 0) {
        setResultados([])
        setConsultado(true)
        message.warning('No hay datos facturación NRQ para los filtros')
        return
      }

      const filaMapeada = mapearResultados(rawData)
      setResultados(filaMapeada)
      setConsultado(true)
      message.success(`${filaMapeada.length} registros encontrados`)
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
      sorter: (a: RegistroNRQ, b: RegistroNRQ) => a.nrq_diferencia - b.nrq_diferencia,
    },
    {
      title: 'Total $ Facturar',
      dataIndex: 'total',
      key: 't',
      align: 'right' as const,
      fixed: 'right' as const,
      render: (v: number) => <strong style={{ fontSize: 15, color: '#1677ff' }}>$ {v.toLocaleString('es-CO')}</strong>,
      sorter: (a: RegistroNRQ, b: RegistroNRQ) => a.total - b.total,
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <FileTextOutlined /> Facturación por Contadores NRQ (Dosificadoras Café)
      </Title>

      <Spin spinning={initialLoading} tip="Cargando catálogos...">
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
                    {clientes.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={7}>
                <Form.Item name="productoId" label="Filtrar Producto Dosificado">
                  <Select allowClear placeholder="Todos los productos" size="large">
                    {productosDosificados.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setResultados([]); setConsultado(false); form.resetFields() }}>Limpiar</Button>
                <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>
                  Recargar Catálogo
                </Button>
                <Button type="primary" size="large" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
                  Consultar
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      </Spin>

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
