import { useState, useEffect, useCallback } from 'react'
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
  Spin,
} from 'antd'
import { PlusSquareOutlined, MinusCircleOutlined, SendOutlined, InboxOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../hooks/usePermissions'
import { apiService } from '../../api/services/api'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

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
  const [proveedores, setProveedores] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const perm = usePermissions('inventario')

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [proveedoresRes, productosRes] = await Promise.all([
        apiService.get('/proveedores'),
        apiService.get('/productos'),
      ])

      const proveedoresList = Array.isArray(proveedoresRes) ? proveedoresRes : (proveedoresRes?.data || [])
      const productosList = Array.isArray(productosRes) ? productosRes : (productosRes?.data || [])

      const proveedoresMapeados = proveedoresList.map((p: any) => ({
        id: p.idProveedor ?? p.id,
        nombre: p.razonSocial ?? p.nombre ?? '',
      }))

      const productosMapeados = productosList.map((p: any) => ({
        id: p.idProducto ?? p.id,
        nombre: p.nombreProducto ?? p.nombre ?? '',
        costo: p.costoBase ?? p.costo ?? 0,
      }))

      setProveedores(proveedoresMapeados)
      setProductos(productosMapeados)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar datos')
    } finally {
      setFetching(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addItem = () => {
    const newId = Math.max(0, ...items.map((i) => i.id), 0) + 1
    const productoDefault = productos.length > 0 ? productos[0] : { id: 0, nombre: '', costo: 0 }
    setItems([
      ...items,
      {
        id: newId,
        productoId: productoDefault.id,
        productoNombre: productoDefault.nombre,
        cantidad: 1,
        costo: productoDefault.costo,
        vencimiento: dayjs().add(6, 'month').format('YYYY-MM-DD'),
        subtotal: productoDefault.costo,
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
      const values = await form.validateFields()
      if (items.length === 0) {
        message.error('Debe agregar al menos un producto')
        return
      }
      setLoading(true)
      try {
        const body = {
          idProveedor: values.proveedorId,
          numeroFactura: values.factura,
          fechaIngreso: values.fecha ? dayjs(values.fecha).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          observaciones: values.observaciones,
          items: items.map((i) => ({
            idProducto: i.productoId,
            cantidad: i.cantidad,
            costoUnitario: i.costo,
            fechaVencimiento: i.vencimiento,
          })),
        }
        const res: any = await apiService.post('/inventory/ingresos', body)
        message.success(`Ingreso #${res?.idIngreso ?? res?.id ?? Math.floor(Math.random() * 1000)} confirmado. ${items.length} productos, Total $${total.toLocaleString('es-CO')}`)
        form.resetFields()
        setItems([])
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 404 || status === undefined) {
          message.error('Endpoint no implementado')
        } else {
          message.error(err?.response?.data?.message || 'Error al guardar ingreso')
        }
      }
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
            const p = productos.find((x) => x.id === v)!
            updateItem(i, { productoId: v, productoNombre: p.nombre, costo: p.costo })
          }}
        >
          {productos.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
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
      <Space style={{ marginBottom: 16 }} align="center">
        <Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>
          <InboxOutlined style={{ marginRight: 8 }} /> Ingresos a Bodega
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
      </Space>

      <Spin spinning={initialLoading}>
        <Card title="Encabezado del Ingreso" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" initialValues={{ fecha: dayjs() }}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Proveedor" name="proveedorId" rules={[{ required: true, message: 'Seleccione proveedor' }]}>
                  <Select placeholder="Seleccione proveedor" showSearch>
                    {proveedores.map((p) => <Option key={p.id} value={p.id}>{p.nombre}</Option>)}
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
      </Spin>

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
