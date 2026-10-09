import { useState, useEffect, useCallback } from 'react'
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
  Drawer,
  Descriptions,
} from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined, ShopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiService } from '../../../api/services/api'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

interface OptionCat {
  id: number
  nombre: string
}

interface DetalleProducto {
  idProducto: number
  cantidadSugerida: number
  despachado: number
  pendiente: number
  precio: number
  subtotal: number
  subtotalVendido?: number
}

interface VisitaVendido {
  idGrupo: number
  idMaquina: number
  serial: string | null
  ubicacionEsp: string | null
  idCliente: number | null
  cliente: string | null
  idOperador: number
  operador: string
  zona: string | null
  fechaVisita: string
  nrAnterior: number
  nrActual: number
  totalVendido: number
  totalDespachado: number
  totalVendidoProductos?: number
  totalSugerido: number
  totalPendiente: number
  unidadesSugeridas: number
  detalle: DetalleProducto[]
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : `$ ${Number(n).toLocaleString('es-CO')}`)

const VendidoPorVisita = () => {
  const [form] = Form.useForm()
  const [clientes, setClientes] = useState<OptionCat[]>([])
  const [maquinas, setMaquinas] = useState<OptionCat[]>([])
  const [visitas, setVisitas] = useState<VisitaVendido[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [consultado, setConsultado] = useState(false)
  const [totales, setTotales] = useState({ totalDespachado: 0, totalSugerido: 0, totalPendiente: 0, totalVendido: 0, totalVendidoProductos: 0, filas: 0 })
  const [detalleSel, setDetalleSel] = useState<VisitaVendido | null>(null)

  const loadCatalogo = useCallback(async () => {
    try {
      const [clientesRes, maquinasRes]: any[] = await Promise.all([
        apiService.get('/clientes').catch(() => []),
        apiService.get('/maquinas').catch(() => []),
      ])
      const cliList = Array.isArray(clientesRes) ? clientesRes : clientesRes?.data ?? []
      const maqList = Array.isArray(maquinasRes) ? maquinasRes : maquinasRes?.data ?? []
      setClientes(
        cliList.map((c: any) => ({ id: c.idCliente ?? c.id, nombre: c.razonSocial ?? c.nombre ?? '' })),
      )
      setMaquinas(
        maqList.map((m: any) => ({
          id: m.idMaquina ?? m.id,
          nombre: m.serial ?? m.Serial ?? (m.idMaquina ?? m.id)?.toString(),
        })),
      )
    } catch {
      /* catálogo opcional; los filtros simplemente quedan vacíos */
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalogo()
  }, [loadCatalogo])

  const consultar = async (values: any) => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      if (values.fechas && values.fechas.length >= 2) {
        params.fechaInicio = dayjs(values.fechas[0]).format('YYYY-MM-DD')
        params.fechaFin = dayjs(values.fechas[1]).format('YYYY-MM-DD')
      }
      if (values.idMaquina) params.idMaquina = values.idMaquina
      if (values.idCliente) params.idCliente = values.idCliente

      const res: any = await apiService.get('/tesoreria/vendido-por-visita', params)
      const lista: VisitaVendido[] =
        Array.isArray(res?.visitas) ? res.visitas : Array.isArray(res) ? res : []
      setVisitas(lista)
      setTotales({
        totalDespachado: Number(res?.totalDespachado ?? lista.reduce((s, v) => s + v.totalDespachado, 0)),
        totalSugerido: Number(res?.totalSugerido ?? lista.reduce((s, v) => s + v.totalSugerido, 0)),
        totalPendiente: Number(res?.totalPendiente ?? lista.reduce((s, v) => s + v.totalPendiente, 0)),
        totalVendido: Number(res?.totalVendido ?? lista.reduce((s, v) => s + v.totalVendido, 0)),
        totalVendidoProductos: Number(res?.totalVendidoProductos ?? lista.reduce((s, v) => s + (v.totalVendidoProductos ?? 0), 0)),
        filas: Number(res?.total ?? lista.length),
      })
      setConsultado(true)
      if (lista.length === 0) message.warning('No hay visitas para los filtros seleccionados')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al consultar ventas por visita')
      setVisitas([])
      setConsultado(true)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Visita #', dataIndex: 'idGrupo', key: 'g', width: 90, render: (v: number) => <strong>#{v}</strong>, fixed: 'left' as const },
    {
      title: 'Fecha',
      dataIndex: 'fechaVisita',
      key: 'f',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('es-CO'),
      sorter: (a: any, b: any) => new Date(a.fechaVisita).getTime() - new Date(b.fechaVisita).getTime(),
    },
    {
      title: 'Máquina',
      key: 'maq',
      width: 180,
      render: (_: any, r: VisitaVendido) => (
        <Space direction="vertical" size={0}>
          <strong>{r.serial ?? `Máq #${r.idMaquina}`}</strong>
          {r.ubicacionEsp && <span style={{ color: '#888', fontSize: 12 }}>{r.ubicacionEsp}</span>}
        </Space>
      ),
    },
    { title: 'Cliente', dataIndex: 'cliente', key: 'c', width: 180, render: (v: string | null) => (v ? <Tag color="blue">{v}</Tag> : <Tag>—</Tag>) },
    { title: 'Operador', dataIndex: 'operador', key: 'o', width: 170, render: (v: string) => <span>{v}</span> },
    { title: 'Unidades Sugeridas', dataIndex: 'unidadesSugeridas', key: 'us', width: 120, align: 'center' as const },
    {
      title: 'Total Vendido ($)',
      dataIndex: 'totalVendido',
      key: 'tv',
      width: 150,
      align: 'center' as const,
      render: (v: number) => <Tag color="green" style={{ fontWeight: 600 }}>{fmt(v)}</Tag>,
    },
    {
      title: 'Sugerido ($)',
      dataIndex: 'totalSugerido',
      key: 'ts',
      width: 140,
      align: 'center' as const,
      render: (v: number) => <span style={{ color: '#8c8c8c' }}>{fmt(v)}</span>,
    },
    {
      title: 'Vendido Productos ($)',
      dataIndex: 'totalVendidoProductos',
      key: 'tvp',
      width: 170,
      align: 'center' as const,
      render: (v: number) => <Tag color="cyan" style={{ fontWeight: 600 }}>{fmt(v)}</Tag>,
      sorter: (a: any, b: any) => (a.totalVendidoProductos ?? 0) - (b.totalVendidoProductos ?? 0),
    },
    {
      title: 'Despachado ($)',
      dataIndex: 'totalDespachado',
      key: 'td',
      width: 150,
      align: 'center' as const,
      render: (v: number) => <Tag color="purple" style={{ fontWeight: 600 }}>{fmt(v)}</Tag>,
    },
    {
      title: 'Pendiente ($)',
      dataIndex: 'totalPendiente',
      key: 'tp',
      width: 140,
      align: 'center' as const,
      render: (v: number) => (
        <Tag color={v > 0 ? 'orange' : 'default'} style={{ fontWeight: 600 }}>{fmt(v)}</Tag>
      ),
    },
    {
      title: '',
      key: 'acciones',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: VisitaVendido) => (
        <Button size="small" type="primary" ghost icon={<EyeOutlined />} onClick={() => setDetalleSel(r)}>
          Detalle
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <ShopOutlined /> Vendido por Visita
      </Title>

      <Card title="🔎 Filtros de Consulta" style={{ marginBottom: 16 }} extra={<Tag color="geekblue">Ventas y despachos por máquina en cada visita del operador</Tag>}>
        <Spin spinning={initialLoading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={consultar}
            initialValues={{ fechas: [dayjs().subtract(30, 'day'), dayjs()] }}
          >
            <Row gutter={16}>
              <Col xs={24} md={9}>
                <Form.Item name="fechas" label="Rango de Fechas">
                  <RangePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item name="idMaquina" label="Filtrar por Máquina">
                  <Select allowClear showSearch optionFilterProp="children" placeholder="Todas las máquinas" size="large">
                    {maquinas.map((m) => <Option key={m.id} value={m.id}>{m.nombre}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item name="idCliente" label="Filtrar por Cliente">
                  <Select allowClear showSearch optionFilterProp="children" placeholder="Todos los clientes" size="large">
                    {clientes.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item label="&nbsp;">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadCatalogo}
                    style={{ width: '100%' }}
                  >
                    Recargar catálogo
                  </Button>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={9}>
                <Form.Item label="&nbsp;" style={{ marginBottom: 0 }}>
                  <Space>
                    <Button
                      onClick={() => {
                        setVisitas([])
                        setConsultado(false)
                        setTotales({ totalDespachado: 0, totalSugerido: 0, totalPendiente: 0, totalVendido: 0, totalVendidoProductos: 0, filas: 0 })
                        form.resetFields()
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button type="primary" size="large" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
                      Consultar
                    </Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Spin>
      </Card>

      {consultado && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="Visitas" value={totales.filas} valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="💰 Total Vendido" value={totales.totalVendido} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="📋 Total Sugerido" value={totales.totalSugerido} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#8c8c8c' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ border: '1px solid #13c2c2' }}>
                <Statistic title="🎯 Total Vendido Productos" value={totales.totalVendidoProductos} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#13c2c2', fontSize: 26 }} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ border: '1px solid #722ed1' }}>
                <Statistic title="📦 Total Despachado" value={totales.totalDespachado} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#722ed1', fontSize: 30 }} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ border: '1px solid #fa8c16' }}>
                <Statistic title="⏳ Pendiente por Reponer" value={totales.totalPendiente} prefix="$" formatter={(v) => Number(v).toLocaleString('es-CO')} valueStyle={{ color: '#fa8c16', fontSize: 30 }} />
              </Card>
            </Col>
          </Row>

          <Card title={`Visitas encontradas (${visitas.length})`}>
            {visitas.length === 0 ? (
              <Alert type="info" showIcon message="No hay resultados para los filtros seleccionados." />
            ) : (
              <Table
                rowKey="idGrupo"
                dataSource={visitas}
                columns={columns as any}
                size="middle"
                pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `Total ${t} visita(s)` }}
                scroll={{ x: 1780 }}
              />
            )}
          </Card>
        </>
      )}

      <Drawer
        title={detalleSel ? `Detalle de la Visita #${detalleSel.idGrupo}` : 'Detalle'}
        width={620}
        open={!!detalleSel}
        onClose={() => setDetalleSel(null)}
      >
        {detalleSel && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Fecha">{new Date(detalleSel.fechaVisita).toLocaleString('es-CO')}</Descriptions.Item>
              <Descriptions.Item label="Máquina">{detalleSel.serial ?? `Máq #${detalleSel.idMaquina}`}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{detalleSel.cliente ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Operador">{detalleSel.operador}</Descriptions.Item>
              <Descriptions.Item label="Zona">{detalleSel.zona ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="NR Anterior">{detalleSel.nrAnterior.toLocaleString('es-CO')}</Descriptions.Item>
              <Descriptions.Item label="NR Actual">{detalleSel.nrActual.toLocaleString('es-CO')}</Descriptions.Item>
              <Descriptions.Item label="Total Vendido ($)">{fmt(detalleSel.totalVendido)}</Descriptions.Item>
              <Descriptions.Item label="Vendido Productos ($)">{fmt(detalleSel.totalVendidoProductos)}</Descriptions.Item>
              <Descriptions.Item label="Sugerido ($)">{fmt(detalleSel.totalSugerido)}</Descriptions.Item>
              <Descriptions.Item label="Despachado ($)">{fmt(detalleSel.totalDespachado)}</Descriptions.Item>
              <Descriptions.Item label="Pendiente ($)">{fmt(detalleSel.totalPendiente)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" type="inner" title="Desglose por producto" style={{ marginTop: 16 }}>
              <Table
                rowKey="idProducto"
                size="small"
                pagination={false}
                dataSource={detalleSel.detalle}
                columns={[
                  { title: 'Producto ID', dataIndex: 'idProducto', key: 'id' },
                  { title: 'Sugerido', dataIndex: 'cantidadSugerida', key: 'cs', align: 'center' as const },
                  { title: 'Despachado', dataIndex: 'despachado', key: 'd', align: 'center' as const },
                  { title: 'Pendiente', dataIndex: 'pendiente', key: 'pd', align: 'center' as const, render: (v: number) => (v > 0 ? <Tag color="orange">{v}</Tag> : v) },
                  { title: 'Precio Und', dataIndex: 'precio', key: 'p', align: 'right' as const, render: (v: number) => fmt(v) },
                  { title: 'Subtotal despach.', dataIndex: 'subtotal', key: 's', align: 'right' as const, render: (v: number) => <strong>{fmt(v)}</strong> },
                  { title: 'Vendido', dataIndex: 'subtotalVendido', key: 'sv', align: 'right' as const, render: (v?: number) => <Tag color="cyan">{v == null ? '—' : fmt(v)}</Tag> },
                ]}
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  )
}

export default VendidoPorVisita