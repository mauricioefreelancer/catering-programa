import { useState, useMemo, useEffect, useCallback } from 'react'
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
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, SaveOutlined, RiseOutlined, ReloadOutlined } from '@ant-design/icons'
import { usePermissions } from '../../hooks/usePermissions'
import { apiService } from '../../api/services/api'

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

interface Cliente {
  id: number
  razonSocial?: string
  nombre?: string
}

interface Producto {
  id: number
  nombreProducto?: string
  nombre?: string
}

const Precios = () => {
  const [data, setData] = useState<Precio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [fetching, setFetching] = useState<boolean>(true)
  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [fCliente, setFCliente] = useState<number | null>(null)
  const [fProducto, setFProducto] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [editMap, setEditMap] = useState<Record<number, number>>({})
  const [openIPC, setOpenIPC] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ipcForm] = Form.useForm()
  const [preview, setPreview] = useState<Precio[] | null>(null)
  const [openCrear, setOpenCrear] = useState(false)
  const [crearLoading, setCrearLoading] = useState(false)
  const [crearForm] = Form.useForm()
  const perm = usePermissions('precios')

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [preciosRes, clientesRes, productosRes] = await Promise.all([
        apiService.get<any>('/precios-cliente'),
        apiService.get<any>('/clientes'),
        apiService.get<any>('/productos'),
      ])

      const preciosData = preciosRes?.data ?? preciosRes ?? []
      const clientesData = clientesRes?.data ?? clientesRes ?? []
      const productosData = productosRes?.data ?? productosRes ?? []

      setClientes(clientesData.map((c: any) => ({ id: Number(c.idCliente ?? c.id), razonSocial: c.razonSocial || c.nombre, nombre: c.nombre || c.razonSocial })))
      setProductos(productosData.map((p: any) => ({ id: Number(p.idProducto ?? p.id), nombreProducto: p.nombreProducto || p.nombre, nombre: p.nombre || p.nombreProducto })))

      const mapped: Precio[] = preciosData.reduce((acc: Precio[], p: any) => {
        // Evitar duplicados de cliente+producto (unique en BD intenta forzarlo,
        // pero si la BD ya tiene filas repetidas de versiones viejas, se muestran todas).
        if (acc.some((x) => x.clienteId === p.idCliente && x.productoId === p.idProducto)) return acc;
        const cli = p.cliente || clientesData.find((c: any) => Number(c.idCliente ?? c.id) === Number(p.idCliente))
        const prod = p.producto || productosData.find((pr: any) => Number(pr.idProducto ?? pr.id) === Number(p.idProducto))
        acc.push({
          id: p.idPrecio ?? p.idPrecioCliente ?? p.id,
          clienteId: p.idCliente,
          clienteNombre: cli?.razonSocial || cli?.nombre || `Cliente #${p.idCliente}`,
          productoId: p.idProducto,
          productoNombre: prod?.nombreProducto || prod?.nombre || `Producto #${p.idProducto}`,
          costo_total: Number(prod?.costoTotal ?? p.costoTotal ?? p.costo_total ?? 0),
          precio_venta: Number(p.precioVenta ?? p.precio_venta ?? 0),
        })
        return acc
      }, [])

      setData(mapped)
    } catch (err: any) {
      message.error('Error al cargar los datos: ' + (err?.message || err))
    } finally {
      setFetching(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const saveAll = async () => {
    const cambios = Object.entries(editMap).map(([id, precio_venta]) => ({
      id: Number(id),
      precio_venta,
    }))
    if (cambios.length === 0) return
    try {
      await apiService.patch('/precios-cliente/bulk', { cambios })
      message.success(`Precios actualizados (${cambios.length} cambios)`)
      setEditMap({})
      await loadData()
    } catch (err: any) {
      const is404 = err?.response?.status === 404 || err?.status === 404
      message.error(is404 ? 'Endpoint bulk no disponible (404). Cambios mantenidos localmente.' : 'Error al guardar: ' + (err?.message || err) + '. Cambios mantenidos localmente.')
    }
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

  const confirmIPC = async () => {
    if (!preview) return
    setData(preview)
    const cambios = preview
      .filter((p, i) => data[i] && p.precio_venta !== data[i].precio_venta)
      .map((p) => ({
        id: p.id,
        precio_venta: p.precio_venta,
      }))
    if (cambios.length > 0) {
      try {
        await apiService.patch('/precios-cliente/bulk', { cambios })
        message.success(`Aumento IPC aplicado exitosamente (${cambios.length} cambios)`)
      } catch (err: any) {
        const is404 = err?.response?.status === 404 || err?.status === 404
        message.error(is404 ? 'Endpoint bulk no disponible (404). Cambios mantenidos localmente.' : 'Error al guardar IPC: ' + (err?.message || err) + '. Cambios mantenidos localmente.')
      }
    } else {
      message.success('Aumento IPC aplicado (sin cambios detectados)')
    }
    setPreview(null)
    setOpenIPC(false)
    ipcForm.resetFields()
  }

  const handleCrear = async (values: any) => {
    setCrearLoading(true)
    try {
      await apiService.post('/precios-cliente', {
        idCliente: values.idCliente,
        idProducto: values.idProducto,
        precioVenta: Number(values.precioVenta),
      })
      message.success('Precio asignado correctamente')
      setOpenCrear(false)
      crearForm.resetFields()
      await loadData()
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al asignar precio'
      message.error(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setCrearLoading(false)
    }
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
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
          <Select allowClear placeholder="Filtrar Cliente" value={fCliente} onChange={(v) => setFCliente(v)} style={{ width: 220 }}>
            {clientes.map((c) => <Option key={c.id} value={c.id}>{c.razonSocial || c.nombre || `Cliente #${c.id}`}</Option>)}
          </Select>
          <Select allowClear placeholder="Filtrar Producto" value={fProducto} onChange={(v) => setFProducto(v)} style={{ width: 240 }}>
            {productos.map((p) => <Option key={p.id} value={p.id}>{p.nombreProducto || p.nombre || `Producto #${p.id}`}</Option>)}
          </Select>
          {perm.crear && (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setOpenCrear(true); crearForm.resetFields() }}>
                Nueva Asignación
              </Button>
              <Button icon={<RiseOutlined />} onClick={() => setOpenIPC(true)}>
                Aumento IPC
              </Button>
            </>
          )}
          {perm.editar && (
            <Button type="primary" icon={<SaveOutlined />} onClick={saveAll} disabled={Object.keys(editMap).length === 0}>
              Guardar ({Object.keys(editMap).length})
            </Button>
          )}
        </Space>
      </div>

      <Spin spinning={initialLoading}>
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
      </Spin>

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
                          {clientes.map((c) => <Option key={c.id} value={c.id}>{c.razonSocial || c.nombre || `Cliente #${c.id}`}</Option>)}
                        </Select>
                      </Form.Item>
                    )
                  }
                  if (modo === 'PRODUCTO') {
                    return (
                      <Form.Item name="idProducto" label="Seleccionar Producto" rules={[{ required: true }]}>
                        <Select placeholder="Seleccione producto">
                          {productos.map((p) => <Option key={p.id} value={p.id}>{p.nombreProducto || p.nombre || `Producto #${p.id}`}</Option>)}
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

      <Modal
        title="Nueva Asignación de Precio"
        open={openCrear}
        onCancel={() => { setOpenCrear(false); crearForm.resetFields() }}
        okText="Asignar Precio"
        cancelText="Cancelar"
        confirmLoading={crearLoading}
        onOk={() => crearForm.submit()}
        width={520}
      >
        <Form form={crearForm} layout="vertical" onFinish={handleCrear}>
          <Form.Item name="idCliente" label="Cliente" rules={[{ required: true, message: 'Seleccione el cliente' }]}>
            <Select showSearch placeholder="Seleccione el cliente" optionFilterProp="children">
              {clientes.map((c) => <Option key={c.id} value={c.id}>{c.razonSocial || c.nombre || `Cliente #${c.id}`}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="idProducto" label="Producto" rules={[{ required: true, message: 'Seleccione el producto' }]}>
            <Select showSearch placeholder="Seleccione el producto" optionFilterProp="children">
              {productos.map((p) => <Option key={p.id} value={p.id}>{p.nombreProducto || p.nombre || `Producto #${p.id}`}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="precioVenta" label="Precio de Venta" rules={[{ required: true, message: 'Ingrese el precio de venta' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100} prefix="$" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Precios
