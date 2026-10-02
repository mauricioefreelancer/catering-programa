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
  Modal,
  Radio,
  Tag,
  AutoComplete,
} from 'antd'
import { PlusSquareOutlined, MinusCircleOutlined, SendOutlined, InboxOutlined, DollarOutlined, ReloadOutlined, FileAddOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { apiService } from '../../api/services/api'
import CampoCodigoBarras from '../../components/CampoCodigoBarras'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// Categorías de insumo disponibles (qué es el producto físicamente)
const CATEGORIAS_INSUMO = [
  'CAFE', 'VASO', 'MEZCLADOR', 'AZUCAR', 'GRANO', 'LACTEO',
  'CHOCOLATE', 'AROMATICA', 'SNACK', 'BEBIDA', 'EMPAQUE',
].map((v) => ({ value: v }))

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
  const { usuario } = useAuth()
  const [form] = Form.useForm()
  const [items, setItems] = useState<ItemIngreso[]>([])
  const [loading, setLoading] = useState(false)
  const [proveedores, setProveedores] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const perm = usePermissions('inventario')
  const permProductos = usePermissions('productos')

  // --- Creación de producto nuevo desde el ingreso ---
  const [openNuevo, setOpenNuevo] = useState(false)
  const [nuevoParaItem, setNuevoParaItem] = useState<number | null>(null)
  const [formNuevo] = Form.useForm()
  const [tipoNuevo, setTipoNuevo] = useState<'ESTANDAR' | 'MATERIA_PRIMA'>('ESTANDAR')
  const [creandoNuevo, setCreandoNuevo] = useState(false)

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [proveedoresRes, productosRes] = await Promise.all([
        apiService.get('/proveedores'),
        apiService.get('/productos?limit=2000&take=2000'),
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
        proveedorNombre: (p.proveedor?.razonSocial ?? p.proveedor?.razon_social ?? p.proveedor?.nombre ?? ''),
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

  // --- Confirmar creación de producto nuevo (Estándar / Materia Prima) ---
  const confirmarNuevo = async () => {
    let values: any
    try {
      values = await formNuevo.validateFields()
    } catch {
      return
    }
    setCreandoNuevo(true)
    try {
      const costoBase = Number(values.costo_base || 0)
      const iva = Number(values.iva || 0)
      const payload: any = {
        idProveedor: values.idProveedor ? Number(values.idProveedor) : null,
        codigoBarras: values.codigo_barras,
        nombre: values.nombre,
        categoriaInsumo: values.categoria_insumo || null,
        Tipo_Producto: tipoNuevo,
        unidadCompra: values.unidad_compra,
        unidadConsumo: values.unidad_consumo,
        equivalencia: Number(values.equivalencia || 1),
        costoBase,
        IVA: iva,
        costoTotal: Math.round(costoBase * (1 + iva) * 100) / 100,
        stockActual: Number(values.stock_actual || 0),
        stockMin: Number(values.stock_min || 0),
        stockMax: Number(values.stock_max || 0),
      }
      const nuevo: any = await apiService.post('/productos', payload)
      const idNuevo = nuevo?.idProducto ?? nuevo?.id
      if (!idNuevo) throw new Error('No se obtuvo el id del producto creado')
      message.success(`Producto "${values.nombre}" creado`)

      // Refrescar la lista de productos para que el Select lo incluya
      await loadData()

      // Si el modal se abrió desde un item del ingreso, seleccionarlo ahí
      if (nuevoParaItem != null) {
        const idx = items.findIndex((i) => i.id === nuevoParaItem)
        if (idx >= 0) {
          updateItem(idx, { productoId: idNuevo, productoNombre: values.nombre, costo: costoBase })
        }
      }

      formNuevo.resetFields()
      setTipoNuevo('ESTANDAR')
      setOpenNuevo(false)
      setNuevoParaItem(null)
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Error al crear el producto')
    } finally {
      setCreandoNuevo(false)
    }
  }

  const handleConfirm = async () => {
    let values: any
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    if (items.length === 0) {
      message.error('Debe agregar al menos un producto')
      return
    }
    if (!(usuario?.idUsuario) && !(usuario?.id)) {
      message.error('No hay sesión de usuario válida (idUsuario) para registrar quién hace el ingreso. Re-inicia sesión.')
      return
    }
    setLoading(true)
    try {
      const body = {
        idProveedor: Number(values.proveedorId),
        facturaNum: values.factura,
        fechaHora: values.fecha ? dayjs(values.fecha).format('YYYY-MM-DDTHH:mm:ss') : dayjs().format('YYYY-MM-DDTHH:mm:ss'),
        observaciones: values.observaciones,
        idUsuario: Number(usuario?.idUsuario ?? usuario?.id),
        detalle: items.map((i) => ({
          idProducto: Number(i.productoId),
          cantidadRecib: Number(i.cantidad),
          costoUnitarioCompra: Number(i.costo),
          fechaVenc: i.vencimiento ? dayjs(i.vencimiento).format('YYYY-MM-DD') : undefined,
        })),
      }
      const res: any = await apiService.post('/ingresos-bodega', body)
      message.success(`Ingreso #${res?.idIngreso ?? res?.id ?? Math.floor(Math.random() * 1000)} confirmado. ${items.length} productos, Total $${total.toLocaleString('es-CO')}`)
      form.resetFields()
      setItems([])
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar ingreso')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Producto',
      dataIndex: 'productoId',
      width: 300,
      render: (_: any, r: ItemIngreso, i: number) => (
        <Select
          showSearch
          value={r.productoId}
          style={{ width: '100%' }}
          optionFilterProp="label"
          onChange={(v: any) => {
            const p = productos.find((x) => x.id === v)!
            updateItem(i, { productoId: v, productoNombre: p?.nombre ?? '', costo: p?.costo ?? 0 })
          }}
        >
          {productos.map((p) => {
            const lbl = p.proveedorNombre ? `${p.nombre} · ${p.proveedorNombre}` : p.nombre
            return (
              <Option key={p.id} value={p.id} label={lbl}>
                <span>{p.nombre}</span>
                {p.proveedorNombre ? <Tag color="cyan" style={{ marginLeft: 8 }}>{p.proveedorNombre}</Tag> : null}
              </Option>
            )
          })}
        </Select>
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'cantidad',
      width: 120,
      render: (_: any, r: ItemIngreso, i: number) => (
        <InputNumber min={1} value={r.cantidad} style={{ width: '100%' }} onChange={(v: any) => updateItem(i, { cantidad: Number(v) })} />
      ),
    },
    {
      title: 'Costo Und',
      dataIndex: 'costo',
      width: 140,
      render: (_: any, r: ItemIngreso, i: number) => (
        <InputNumber min={0} prefix="$" value={r.costo} style={{ width: '100%' }} onChange={(v: any) => updateItem(i, { costo: Number(v) })} />
      ),
    },
    {
      title: 'Vencimiento',
      dataIndex: 'vencimiento',
      width: 160,
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
      width: 130,
      align: 'right' as const,
      render: (v: number) => <strong>$ {v.toLocaleString('es-CO')}</strong>,
    },
    {
      title: '',
      width: 140,
      render: (_: any, r: ItemIngreso, i: number) => (
        <Space>
          {permProductos.crear && (
            <Button
              type="link"
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => { setNuevoParaItem(r.id); formNuevo.resetFields(); setTipoNuevo('ESTANDAR'); setOpenNuevo(true) }}
            >
              Nuevo
            </Button>
          )}
          <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => removeItem(r.id)} />
        </Space>
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
            scroll={{ x: 990 }}
          />
          {items.length > 0 && (
            <>
              <Divider />
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Tag color="geekblue" style={{ fontSize: 12 }}>
                  Si el artículo recibido no está en la lista (producto nuevo), use el botón <b>Nuevo</b> de la fila para crearlo directamente.
                </Tag>
              </div>
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

      <Modal
        title="Nuevo Producto (desde Ingreso a Bodega)"
        open={openNuevo}
        onOk={confirmarNuevo}
        onCancel={() => { setOpenNuevo(false); setNuevoParaItem(null); formNuevo.resetFields() }}
        confirmLoading={creandoNuevo}
        okText="Crear producto"
        cancelText="Cancelar"
        width={680}
        destroyOnClose
      >
        <Form form={formNuevo} layout="vertical" initialValues={{ tipo: 'ESTANDAR', equivalencia: 1, iva: 0 }}>
          <Form.Item name="tipo" label="Clasificación del producto" extra="Se creará con la misma lógica de la sección Productos. Los DOSIFICADOS no se crean desde aquí (vienen parametrizados).">
            <Radio.Group onChange={(e: any) => setTipoNuevo(e.target.value)}>
              <Radio.Button value="ESTANDAR">🔵 Estándar</Radio.Button>
              <Radio.Button value="MATERIA_PRIMA">🟣 Materia Prima (insumo)</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="idProveedor" label="Proveedor (Opcional)">
              <Select allowClear placeholder="Seleccione el proveedor de este producto">
                {proveedores.map((pr) => (
                  <Option key={pr.id} value={pr.id}>{pr.nombre}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="codigo_barras" label="Código Barras" rules={[{ required: true, message: 'Código requerido' }]}>
              <CampoCodigoBarras />
            </Form.Item>
          </div>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Nombre requerido' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="categoria_insumo"
            label="Categoría de Insumo"
            extra="Qué es físicamente el producto (café, vaso, mezclador...). Elija de la lista o escriba otra."
          >
            <AutoComplete
              options={CATEGORIAS_INSUMO}
              placeholder="Ej: MEZCLADOR / Otro..."
              style={{ width: '100%' }}
              filterOption={(inputValue, option: any) =>
                option!.value.toUpperCase().includes(inputValue.toUpperCase())
              }
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="unidad_compra" label="Unidad Compra (Empaque)" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: CAJA 24 / KILO / BOLSA" />
            </Form.Item>
            <Form.Item name="unidad_consumo" label="Unidad Consumo (Fracción)" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: UND / Gramo / ml" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="equivalencia" label="Equivalencia (und x empaque)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="iva" label="IVA (decimal)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="costo_base" label="Costo Base" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
            </Form.Item>
            <Form.Item name="stock_actual" label="Stock Actual" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="stock_min" label="Stock Mínimo" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="stock_max" label="Stock Máximo" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default Ingresos