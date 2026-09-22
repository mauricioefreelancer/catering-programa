import { useState, useMemo } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  message,
  Typography,
  Select,
  InputNumber,
  Modal,
  Form,
  Row,
  Col,
  Tag,
  Alert,
  Divider,
} from 'antd'
import { PlusOutlined, SearchOutlined, SaveOutlined, RiseOutlined } from '@ant-design/icons'
import { usePermissions } from '../../hooks/usePermissions'

const { Title } = Typography
const { Option } = Select

interface Precio {
  id: number
  clienteId: number
  clienteNombre: string
  productoId: number
  productoNombre: string
  costo_total: number
  precio_venta: number
}

const CLIENTES = [
  { id: 1, nombre: 'Alimentos S.A.S.' },
  { id: 2, nombre: 'Empresa Servicios Ltda.' },
  { id: 3, nombre: 'Industrias Alimenticias' },
]

const PRODUCTOS = [
  { id: 1, nombre: 'Coca-Cola 350ml', costo: 2975 },
  { id: 2, nombre: 'Agua Cristal 500ml', costo: 1200 },
  { id: 3, nombre: 'Jugo Hit Manzana 300ml', costo: 2380 },
  { id: 4, nombre: 'Galleta Oreo 6und', costo: 1666 },
]

const genInitial = (): Precio[] => {
  const arr: Precio[] = []
  let id = 1
  CLIENTES.forEach((c) => {
    PRODUCTOS.forEach((p) => {
      const margen = 0.25 + Math.random() * 0.25
      const pv = Math.round(p.costo * (1 + margen))
      arr.push({
        id: id++,
        clienteId: c.id,
        clienteNombre: c.nombre,
        productoId: p.id,
        productoNombre: p.nombre,
        costo_total: p.costo,
        precio_venta: pv,
      })
    })
  })
  return arr
}

const Precios = () => {
  const [data, setData] = useState<Precio[]>(genInitial())
  const [fCliente, setFCliente] = useState<number | null>(null)
  const [fProducto, setFProducto] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [editMap, setEditMap] = useState<Record<number, number>>({})
  const [openIPC, setOpenIPC] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ipcForm] = Form.useForm()
  const [preview, setPreview] = useState<Precio[] | null>(null)
  const perm = usePermissions('precios')

  const filtered = useMemo(() => {
    return data.filter((p) => {
      if (fCliente && p.clienteId !== fCliente) return false
      if (fProducto && p.productoId !== fProducto) return false
      if (search && !(p.productoNombre + p.clienteNombre).toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, fCliente, fProducto, search])

  const updatePrice = (id: number, newVal: number) => {
    const em = { ...editMap, [id]: newVal }
    setEditMap(em)
    setData(data.map((p) => (p.id === id ? { ...p, precio_venta: newVal } : p)))
  }

  const saveAll = () => {
    message.success(`Precios actualizados (${Object.keys(editMap).length} cambios)`)
    setEditMap({})
  }

  const margenColor = (pv: number, ct: number) => {
    if (ct === 0) return 'default'
    const m = (pv - ct) / ct
    if (m < 0.05) return 'red'
    if (m < 0.15) return 'gold'
    return 'green'
  }

  const rowBg = (pv: number, ct: number) => {
    if (ct === 0) return ''
    const m = (pv - ct) / ct
    if (m < 0.05) return { background: 'rgba(255, 77, 79, 0.12)' }
    if (m < 0.15) return { background: 'rgba(250, 173, 20, 0.15)' }
    return {}
  }

  const handleIPC = async (values: any) => {
    setLoading(true)
    try {
      const target = [...data]
      const factor = 1 + Number(values.porcentaje) / 100
      const result = target.map((p) => {
        let aplica = false
        if (values.modo === 'TODOS') aplica = true
        if (values.modo === 'CLIENTE' && values.idCliente === p.clienteId) aplica = true
        if (values.modo === 'PRODUCTO' && values.idProducto === p.productoId) aplica = true
        if (!aplica) return p
        return { ...p, precio_venta: Math.round(p.precio_venta * factor) }
      })
      setPreview(result)
    } finally {
      setLoading(false)
    }
  }

  const confirmIPC = () => {
    if (!preview) return
    setData(preview)
    setPreview(null)
    setOpenIPC(false)
    ipcForm.resetFields()
    message.success('Aumento IPC aplicado exitosamente')
  }

  const columns = [
    { title: 'Cliente', dataIndex: 'clienteNombre', key: 'c', width: 200, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Producto', dataIndex: 'productoNombre', key: 'p', render: (v: string) => <strong>{v}</strong> },
    { title: 'Costo Total', dataIndex: 'costo_total', key: 'ct', render: (v: number) => `$ ${v.toLocaleString('es-CO')}`, width: 130 },
    {
      title: 'Precio Venta (editable)',
      dataIndex: 'precio_venta',
      key: 'pv',
      width: 200,
      render: (v: number, r: Precio) => (
        <InputNumber
          min={0}
          value={v}
          prefix="$"
          style={{ width: '100%' }}
          onChange={(val) => updatePrice(r.id, Number(val))}
        />
      ),
    },
    {
      title: 'Margen %',
      key: 'm',
      width: 110,
      render: (_: any, r: Precio) => {
        const m = ((r.precio_venta - r.costo_total) / (r.costo_total || 1)) * 100
        return <Tag color={margenColor(r.precio_venta, r.costo_total)}>{m.toFixed(1)}%</Tag>
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Precios por Cliente</Title>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
          <Select allowClear placeholder="Filtrar Cliente" value={fCliente} onChange={(v) => setFCliente(v)} style={{ width: 220 }}>
            {CLIENTES.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
          </Select>
          <Select allowClear placeholder="Filtrar Producto" value={fProducto} onChange={(v) => setFProducto(v)} style={{ width: 240 }}>
            {PRODUCTOS.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
          </Select>
          {perm.crear && (
            <Button icon={<RiseOutlined />} onClick={() => setOpenIPC(true)}>
              Aumento IPC
            </Button>
          )}
          {perm.editar && (
            <Button type="primary" icon={<SaveOutlined />} onClick={saveAll} disabled={Object.keys(editMap).length === 0}>
              Guardar ({Object.keys(editMap).length})
            </Button>
          )}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Leyenda márgenes:"
        description={
          <Space>
            <Tag color="green">≥ 15% (Saludable)</Tag>
            <Tag color="gold">5% - 15% (Bajo)</Tag>
            <Tag color="red">{`< 5% (Crítico - fila resaltada)`}</Tag>
          </Space>
        }
        style={{ marginBottom: 12 }}
      />

      <Table
        rowKey="id"
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 12, showTotal: (t) => `Total ${t} precios` }}
        onRow={(r) => ({ style: rowBg(r.precio_venta, r.costo_total) })}
        scroll={{ x: 900 }}
      />

      <Modal
        title="Aumento IPC Masivo"
        open={openIPC}
        onCancel={() => { setOpenIPC(false); setPreview(null); ipcForm.resetFields() }}
        okText={preview ? '✅ Confirmar Aplicar' : '🔍 Previsualizar'}
        cancelText="Cancelar"
        confirmLoading={loading}
        onOk={preview ? confirmIPC : ipcForm.submit}
        width={640}
      >
        <Form form={ipcForm} layout="vertical" onFinish={handleIPC}>
          <Form.Item name="modo" label="Modo de Aplicación" rules={[{ required: true }]} initialValue="TODOS">
            <Select>
              <Option value="TODOS">Todos los Precios</Option>
              <Option value="CLIENTE">Solo por Cliente</Option>
              <Option value="PRODUCTO">Solo por Producto</Option>
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item noStyle shouldUpdate={(p, c) => p.modo !== c.modo}>
                {({ getFieldValue }) => {
                  const modo = getFieldValue('modo')
                  if (modo === 'CLIENTE') {
                    return (
                      <Form.Item name="idCliente" label="Seleccionar Cliente" rules={[{ required: true }]}>
                        <Select placeholder="Seleccione cliente">
                          {CLIENTES.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
                        </Select>
                      </Form.Item>
                    )
                  }
                  if (modo === 'PRODUCTO') {
                    return (
                      <Form.Item name="idProducto" label="Seleccionar Producto" rules={[{ required: true }]}>
                        <Select placeholder="Seleccione producto">
                          {PRODUCTOS.map((c) => <Option key={c.id} value={c.id}>{c.nombre}</Option>)}
                        </Select>
                      </Form.Item>
                    )
                  }
                  return null
                }}
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="porcentaje" label="Porcentaje de aumento (%)" rules={[{ required: true }]} initialValue={5}>
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {preview && (
          <>
            <Divider>PREVIEW Aumento</Divider>
            <Alert type="warning" showIcon message={`${preview.length} precios serán actualizados. Revise antes de confirmar.`} />
            <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <Table
                size="small"
                rowKey="id"
                dataSource={preview.slice(0, 50)}
                pagination={false}
                columns={[
                  { title: 'Cliente', dataIndex: 'clienteNombre' },
                  { title: 'Producto', dataIndex: 'productoNombre' },
                  {
                    title: 'Antes → Después',
                    key: 'cmp',
                    render: (_: any, r: Precio, i: number) => {
                      const old = data[i]?.precio_venta || 0
                      return (
                        <Space>
                          <span style={{ textDecoration: 'line-through', color: '#999' }}>${old.toLocaleString('es-CO')}</span>
                          <PlusOutlined style={{ color: '#52c41a' }} />
                          <strong style={{ color: '#52c41a' }}>${r.precio_venta.toLocaleString('es-CO')}</strong>
                        </Space>
                      )
                    },
                  },
                ]}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default Precios
