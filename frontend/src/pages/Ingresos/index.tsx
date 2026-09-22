import { useState } from 'react'
import {
  Form,
  Button,
  Input,
  Space,
  message,
  Typography,
  Select,
  InputNumber,
  Table,
  Card,
  DatePicker,
  Divider,
  Row,
  Col,
  Statistic,
} from 'antd'
import { PlusSquareOutlined, MinusCircleOutlined, SendOutlined, InboxOutlined, DollarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../hooks/usePermissions'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const PROVEEDORES = [
  { id: 1, nombre: 'Distribuidora de Alimentos' },
  { id: 2, nombre: 'Bebidas Nacionales' },
  { id: 3, nombre: 'Snacks y Confitería' },
]

const PRODUCTOS = [
  { id: 1, nombre: 'Coca-Cola 350ml', costo: 2500 },
  { id: 2, nombre: 'Agua Cristal 500ml', costo: 1200 },
  { id: 3, nombre: 'Jugo Hit Manzana', costo: 2000 },
  { id: 4, nombre: 'Galleta Oreo', costo: 1400 },
]

interface ItemIngreso {
  id: number
  productoId: number
  productoNombre: string
  cantidad: number
  costo: number
  vencimiento: string
  subtotal: number
}

const Ingresos = () => {
  const [form] = Form.useForm()
  const [items, setItems] = useState<ItemIngreso[]>([])
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('ingresos')

  const addItem = () => {
    const newId = Math.max(0, ...items.map((i) => i.id), 0) + 1
    setItems([
      ...items,
      {
        id: newId,
        productoId: PRODUCTOS[0].id,
        productoNombre: PRODUCTOS[0].nombre,
        cantidad: 1,
        costo: PRODUCTOS[0].costo,
        vencimiento: dayjs().add(6, 'month').format('YYYY-MM-DD'),
        subtotal: PRODUCTOS[0].costo,
      },
    ])
  }
  const removeItem = (id: number) => setItems(items.filter((i) => i.id !== id))
  const updateItem = (idx: number, patch: Partial<ItemIngreso>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    if (patch.cantidad !== undefined || patch.costo !== undefined) {
      next[idx].subtotal = (next[idx].cantidad || 0) * (next[idx].costo || 0)
    }
    setItems(next)
  }

  const total = items.reduce((s, i) => s + i.subtotal, 0)

  const handleConfirm = async () => {
    try {
      await form.validateFields()
      if (items.length === 0) {
        message.error('Debe agregar al menos un producto')
        return
      }
      setLoading(true)
      await new Promise((r) => setTimeout(r, 700))
      message.success(`Ingreso #${Math.floor(Math.random() * 1000)} confirmado. ${items.length} productos, Total $${total.toLocaleString('es-CO')}`)
      form.resetFields()
      setItems([])
    } catch {} finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Producto',
      dataIndex: 'productoId',
      width: 260,
      render: (_: any, r: ItemIngreso, i: number) => (
        <Select
          showSearch
          value={r.productoId}
          style={{ width: '100%' }}
          onChange={(v: any) => {
            const p = PRODUCTOS.find((x) => x.id === v)!
            updateItem(i, { productoId: v, productoNombre: p.nombre, costo: p.costo })
          }}
        >
          {PRODUCTOS.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
        </Select>
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      width: 130,
      render: (_: any, r: ItemIngreso, i: number) => (
        <InputNumber min={1} value={r.cantidad} style={{ width: '100%' }} onChange={(v: any) => updateItem(i, { cantidad: Number(v) })} />
      ),
    },
    {
      title: 'Costo Und',
      dataIndex: 'costo',
      width: 150,
      render: (_: any, r: ItemIngreso, i: number) => (
        <InputNumber min={0} prefix="$" value={r.costo} style={{ width: '100%' }} onChange={(v: any) => updateItem(i, { costo: Number(v) })} />
      ),
    },
    {
      title: 'Vencimiento',
      dataIndex: 'vencimiento',
      width: 180,
      render: (_: any, r: ItemIngreso, i: number) => (
        <DatePicker
          value={r.vencimiento ? dayjs(r.vencimiento) : null}
          style={{ width: '100%' }}
          onChange={(d: any) => updateItem(i, { vencimiento: d ? d.format('YYYY-MM-DD') : '' })}
        />
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      width: 140,
      align: 'right' as const,
      render: (v: number) => <strong>$ {v.toLocaleString('es-CO')}</strong>,
    },
    {
      title: '',
      width: 60,
      render: (_: any, r: ItemIngreso) => (
        <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => removeItem(r.id)} />
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        <InboxOutlined style={{ marginRight: 8 }} /> Ingresos a Bodega
      </Title>

      <Card title="Encabezado del Ingreso" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ fecha: dayjs() }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Proveedor" name="proveedorId" rules={[{ required: true, message: 'Seleccione proveedor' }]}>
                <Select placeholder="Seleccione proveedor" showSearch>
                  {PROVEEDORES.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="N° Factura Compra" name="factura" rules={[{ required: true }]}>
                <Input placeholder="FAC-2024-00123" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Fecha Ingreso" name="fecha" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Observaciones" name="observaciones" rules={[{ required: true, message: 'Ingrese observaciones' }]}>
            <TextArea rows={2} placeholder="Detalle del ingreso, lote, transportador, etc (requerido)" />
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="Items (Productos Recibidos)"
        extra={<Button icon={<PlusSquareOutlined />} type="primary" onClick={addItem}>Agregar Producto</Button>}
      >
        <Table
          rowKey="id"
          dataSource={items}
          columns={columns}
          pagination={false}
          locale={{ emptyText: 'No hay productos agregados. Haga clic en "Agregar Producto".' }}
          scroll={{ x: 900 }}
        />
        {items.length > 0 && (
          <>
            <Divider />
            <Row justify="end" gutter={16}>
              <Col xs={24} md={8}>
                <Card size="small" style={{ background: '#f0f5ff' }}>
                  <Statistic title={<Text strong>TOTAL INGRESO</Text>} value={total} prefix={<DollarOutlined />} valueStyle={{ color: '#1677ff', fontSize: 28 }} formatter={(v) => `$ ${Number(v).toLocaleString('es-CO')}`} />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Card>

      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          <Button onClick={() => { setItems([]); form.resetFields() }}>Limpiar</Button>
          {perm.crear && (
            <Button type="primary" size="large" icon={<SendOutlined />} loading={loading} onClick={handleConfirm}>
              ✅ Confirmar Ingreso Bodega
            </Button>
          )}
        </Space>
      </div>
    </div>
  )
}

export default Ingresos
