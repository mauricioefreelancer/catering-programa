import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
  Typography,
  Form,
  Radio,
  InputNumber,
  Tabs,
  Select,
  Card,
  Switch,
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, PlusSquareOutlined, ReloadOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'
import { get, post, patch, remove } from '../../api/services/api'

const { Title } = Typography
const { Option } = Select

interface Ingrediente {
  id: number
  productoId: number
  cantidad: number
  nombre?: string
}

interface Producto {
  id: number
  idProveedor?: number | null
  codigo_barras: string
  nombre: string
  tipo: 'ESTANDAR' | 'MATERIA_PRIMA' | 'DOSIFICADO'
  unidad_compra: string
  unidad_consumo: string
  equivalencia: number
  costo_base: number
  iva: number
  costo_total: number
  stock_actual: number
  stock_min: number
  stock_max: number
  receta?: Ingrediente[]
}

const TIPOS_VALIDOS = ['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO'] as const

const Productos = () => {
  const [data, setData] = useState<Producto[]>([])
  const [proveedoresList, setProveedoresList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)
  const [tipoSel, setTipoSel] = useState<'ESTANDAR' | 'MATERIA_PRIMA' | 'DOSIFICADO'>(editing?.tipo || 'ESTANDAR')
  const [tabKey, setTabKey] = useState<'GENERAL' | 'RECETA'>('GENERAL')
  const [receta, setReceta] = useState<Ingrediente[]>([])
  const perm = usePermissions('productos')

  const normalizeTipo = (t: any): 'ESTANDAR' | 'MATERIA_PRIMA' | 'DOSIFICADO' => {
    if (typeof t === 'string') {
      const up = t.trim().toUpperCase();
      if ((TIPOS_VALIDOS as readonly string[]).includes(up)) return up as any;
      if (up.includes('MATERIA')) return 'MATERIA_PRIMA';
      if (up.includes('DOSIF')) return 'DOSIFICADO';
    }
    return 'ESTANDAR'
  }

  const loadAll = useCallback(async () => {
    setLoadingTable(true)
    try {
      const [respProd, respProv] = await Promise.all([
        get('/productos?limit=500&take=500'),
        get('/proveedores?limit=500&take=500') as any,
      ])
      const raw: any[] = (respProd as any)?.data || []
      const mapped: Producto[] = raw.map((p: any) => ({
        id: Number(p.idProducto),
        idProveedor: (p.idProveedor as number | null) ?? null,
        codigo_barras: p.codigoBarras || p.codigo_barras || '',
        nombre: p.nombreProducto || p.nombre_producto || p.nombre || '',
        tipo: normalizeTipo(p.tipoProducto ?? p.Tipo_Producto ?? p.tipo),
        unidad_compra: p.unidadCompra || p.unidad_compra || 'UND',
        unidad_consumo: p.unidadConsumo || p.unidad_consumo || 'UND',
        equivalencia: Number(p.equivalencia || 1),
        costo_base: Number(p.costoBase || p.costo_base || 0),
        iva: Number(p.porcentajeImp || p.IVA || p.iva || 0),
        costo_total: Number(p.costoTotal || p.costo_total || 0),
        stock_actual: Number(p.stockActual || p.stock_actual || 0),
        stock_min: Number(p.stockMin || p.stock_min || 0),
        stock_max: Number(p.stockMax || p.stock_max || 0),
      }))
      setData(mapped)
      setProveedoresList(respProv?.data || [])
    } catch (e: any) {
      message.error('Error cargando productos: ' + (e?.message || e))
    } finally {
      setLoadingTable(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const materiasPrimas = useMemo(() => data.filter((p) => p.tipo === 'MATERIA_PRIMA'), [data])
  const filtered = useMemo(() => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter((c) => c.nombre.toLowerCase().includes(s) || c.codigo_barras.includes(s))
  }, [data, search])

  useEffect(() => {
    if (tipoSel !== 'DOSIFICADO' && tabKey === 'RECETA') setTabKey('GENERAL')
  }, [tipoSel, tabKey])

  const resetDrawer = () => {
    setTipoSel('ESTANDAR')
    setTabKey('GENERAL')
    setReceta([])
    setEditing(null)
    setOpen(false)
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const costoTotal = Number(values.costo_base || 0) * (1 + Number(values.iva || 0))
      const payloadBackend: any = {
        idProveedor: values.idProveedor ? Number(values.idProveedor) : null,
        codigoBarras: values.codigo_barras,
        nombre: values.nombre,
        Tipo_Producto: values.tipo,
        unidadCompra: values.unidad_compra,
        unidadConsumo: values.unidad_consumo,
        equivalencia: Number(values.equivalencia || 1),
        costoBase: Number(values.costo_base || 0),
        IVA: Number(values.iva || 0),
        costoTotal: Math.round(costoTotal * 100) / 100,
        stockActual: Number(values.stock_actual || 0),
        stockMin: Number(values.stock_min || 0),
        stockMax: Number(values.stock_max || 0),
      }
      const recetaPayload = values.tipo === 'DOSIFICADO'
        ? (receta || []).map((r: Ingrediente) => ({
            idProductoIngrediente: Number(r.productoId),
            cantidad: Number(r.cantidad),
          }))
        : undefined

      if (editing) {
        try {
          await patch(`/productos/${editing.id}`, payloadBackend)
          if (values.tipo === 'DOSIFICADO' && recetaPayload) {
            try {
              await post(`/productos/${editing.id}/recetas`, { receta: recetaPayload })
            } catch (errReceta: any) {
              message.warning('Producto actualizado, pero error guardando receta: ' + (errReceta?.response?.data?.message || errReceta?.message || errReceta))
            }
          }
          message.success('Producto actualizado')
        } catch (e: any) {
          message.error('Error actualizando producto: ' + (e?.response?.data?.message || e?.message || e))
          return
        }
      } else {
        try {
          const resp: any = await post('/productos', payloadBackend)
          const nuevoId = resp?.data?.idProducto || resp?.idProducto
          if (values.tipo === 'DOSIFICADO' && recetaPayload && nuevoId) {
            try {
              await post(`/productos/${nuevoId}/recetas`, { receta: recetaPayload })
            } catch (errReceta: any) {
              message.warning('Producto creado, pero error guardando receta: ' + (errReceta?.response?.data?.message || errReceta?.message || errReceta))
            }
          }
          message.success('Producto creado')
        } catch (e: any) {
          message.error('Error creando producto: ' + (e?.response?.data?.message || e?.message || e))
          return
        }
      }
      resetDrawer()
      await loadAll()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await remove(`/productos/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Producto eliminado')
    } catch (e: any) {
      message.error('Error eliminando producto: ' + (e?.message || e))
    }
  }

  const handleToggleMp = async (p: Producto, checked: boolean) => {
    if (p.tipo === 'DOSIFICADO') {
      message.warning('Un producto DOSIFICADO (receta) no puede cambiarse a Materia Prima')
      return
    }
    const nuevoTipo: 'ESTANDAR' | 'MATERIA_PRIMA' = checked ? 'MATERIA_PRIMA' : 'ESTANDAR'
    try {
      await patch(`/productos/${p.id}`, { Tipo_Producto: nuevoTipo })
      setData(data.map((c) => (c.id === p.id ? { ...c, tipo: nuevoTipo } : c)))
      message.success(checked ? 'Marcado como Insumo (Materia Prima)' : 'Volvió a Estándar')
    } catch (e: any) {
      message.error('Error actualizando tipo: ' + (e?.message || e))
    }
  }

  const openEdit = (p: Producto) => {
    setEditing(p)
    setTipoSel(p.tipo)
    setTabKey(p.tipo === 'DOSIFICADO' ? 'RECETA' : 'GENERAL')
    setReceta(p.receta || [])
    setOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    setTipoSel('ESTANDAR')
    setTabKey('GENERAL')
    setReceta([])
    setOpen(true)
  }

  const tipoColor = (t: string) => {
    if (t === 'DOSIFICADO') return 'orange'
    if (t === 'MATERIA_PRIMA') return 'purple'
    return 'blue'
  }
  const tipoLabel = (t: string) => {
    if (t === 'DOSIFICADO') return 'DOSIFICADO · Receta Café'
    if (t === 'MATERIA_PRIMA') return 'MP · Empaque Grande / Consumo Fracción'
    return 'ESTÁNDAR · Compra/Venta misma unidad'
  }
  const proveedorNombrePorId = (idP: number | null | undefined) => {
    if (!idP) return ''
    const pr = proveedoresList.find((x: any) => Number(x.idProveedor || x.id) === Number(idP))
    return pr ? (pr.razonSocial || pr.razon_social || '') : ''
  }

  const addIngrediente = () => {
    if (materiasPrimas.length === 0) {
      message.warning('Primero marque al menos un producto Estándar como Insumo MP (columna derecha Acciones)')
      return
    }
    const firstMp = materiasPrimas[0]
    const newId = Math.max(0, ...(receta.map((r) => r.id) || [0])) + 1
    setReceta([...receta, { id: newId, productoId: firstMp.id, cantidad: 1, nombre: firstMp.nombre }])
  }
  const removeIngrediente = (id: number) => setReceta(receta.filter((r) => r.id !== id))

  const columns = [
    { title: 'Código Barras', dataIndex: 'codigo_barras', key: 'codigo_barras', width: 160 },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre', render: (v: string) => <strong>{v}</strong> },
    {
      title: 'Proveedor',
      key: 'proveedor',
      width: 200,
      render: (_: any, r: Producto) => {
        const n = proveedorNombrePorId(r.idProveedor || null)
        return n ? <Tag color="cyan">{n}</Tag> : <span style={{ color: '#999' }}>Sin asignar</span>
      },
    },
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v: string) => <Tag color={tipoColor(v)}>{tipoLabel(v)}</Tag>, width: 280 },
    { title: 'Costo Base', dataIndex: 'costo_base', key: 'costo_base', render: (v: number) => `$ ${v.toLocaleString('es-CO')}` },
    { title: 'Costo Total + IVA', dataIndex: 'costo_total', key: 'costo_total', render: (v: number) => `$ ${v.toLocaleString('es-CO')}`, width: 160 },
    {
      title: 'Stock Actual',
      dataIndex: 'stock_actual',
      key: 'stock_actual',
      render: (v: number, r: Producto) => {
        const isMin = v <= r.stock_min
        return <Tag color={isMin ? 'red' : 'green'}>{isMin ? '⚠ ' : ''}{v} / Min {r.stock_min}</Tag>
      },
    },
    {
      title: 'Insumo MP',
      key: 'mp_toggle',
      width: 150,
      render: (_: any, r: Producto) => {
        if (r.tipo === 'DOSIFICADO') {
          return <Tag color="default">N/A (es Receta)</Tag>
        }
        return (
          <Switch
            checked={r.tipo === 'MATERIA_PRIMA'}
            checkedChildren="🟣 MP"
            unCheckedChildren="🔵 Est"
            onChange={(c) => handleToggleMp(r, c)}
          />
        )
      },
    },
    {
      title: 'Acciones',
      key: 'acc',
      width: 160,
      render: (_: any, r: Producto) => (
        <Space>
          {perm.editar && <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>Editar</Button>}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar producto?" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>Eliminar</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const initialVals: any = editing
    ? editing
    : { idProveedor: null, tipo: 'ESTANDAR', unidad_compra: 'UND', unidad_consumo: 'UND', equivalencia: 1, iva: 0.19, costo_base: 0, stock_actual: 0, stock_min: 0, stock_max: 100 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Productos</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loadingTable}>Recargar</Button>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar nombre, código..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} />
          {perm.crear && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Producto</Button>}
        </Space>
      </div>

      <Spin spinning={loadingTable}>
        <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} productos` }} scroll={{ x: 1280 }} />
      </Spin>

      <ModalDrawer
        title={editing ? 'Editar Producto' : 'Nuevo Producto'}
        open={open} onClose={resetDrawer} onSubmit={handleSubmit}
        initialValues={initialVals} loading={loading} width={820}
      >
        <Tabs
          activeKey={tabKey}
          onChange={(k: any) => setTabKey(k)}
          items={[
            {
              key: 'GENERAL',
              label: '📋 General',
              children: (
                <>
                  <Form.Item name="tipo" label="Tipología Producto (Manual 1.3)" rules={[{ required: true }]} initialValue="ESTANDAR">
                    <Radio.Group onChange={(e: any) => setTipoSel(e.target.value)}>
                      <Radio.Button value="ESTANDAR">🔵 Estándar · Compra/Venta misma unidad</Radio.Button>
                      <Radio.Button value="MATERIA_PRIMA">🟣 Materia Prima · Emp Grande / Fracción</Radio.Button>
                      <Radio.Button value="DOSIFICADO">🟧 Dosificado · Receta (Bebida Café)</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  {tipoSel === 'MATERIA_PRIMA' && (
                    <Tag color="purple" style={{ marginBottom: 12 }}>
                      🟣 INSUMO: Este producto se usará en recetas DOSIFICADAS. Su fracción = Unidad Consumo.
                    </Tag>
                  )}
                  {tipoSel === 'DOSIFICADO' && (
                    <Tag color="orange" style={{ marginBottom: 12 }}>
                      🧪 RECETA: Pase a la pestaña "Receta (Ingredientes)" para seleccionar qué Materias Primas componen este producto.
                    </Tag>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="idProveedor" label="Proveedor (Opcional)">
                      <Select allowClear placeholder="Seleccione el proveedor de este producto">
                        {proveedoresList.map((pr: any) => (
                          <Option key={Number(pr.idProveedor || pr.id)} value={Number(pr.idProveedor || pr.id)}>
                            {pr.razonSocial || pr.razon_social || `Proveedor ${pr.idProveedor || pr.id}`}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item name="codigo_barras" label="Código Barras" rules={[{ required: true }]}><Input /></Form.Item>
                  </div>
                  <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="unidad_compra" label="Unidad Compra (Empaque)" rules={[{ required: true }]}><Input placeholder="Ej: CAJA 24 / KILO / BOLSA" /></Form.Item>
                    <Form.Item name="unidad_consumo" label="Unidad Consumo (Fracción)" rules={[{ required: true }]}><Input placeholder="Ej: UND / Gramo / ml" /></Form.Item>
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
                </>
              ),
            },
            ...(tipoSel === 'DOSIFICADO'
              ? [
                  {
                    key: 'RECETA',
                    label: '🧪 Receta (Ingredientes)',
                    children: (
                      <Card
                        size="small"
                        title={`Ingredientes (SOLO Materia Prima) · ${materiasPrimas.length} MP disponibles`}
                        extra={
                          <Button type="primary" size="small" icon={<PlusSquareOutlined />} onClick={addIngrediente}>
                            Agregar Insumo
                          </Button>
                        }
                      >
                        {materiasPrimas.length === 0 && (
                          <Tag color="warning" style={{ marginBottom: 10, display: 'inline-block' }}>
                            ⚠️ NO hay Materias Primas. Vaya a la tabla, columna "Insumo MP" → marque el Switch de los productos que serán ingredientes.
                          </Tag>
                        )}
                        {receta.length === 0 ? (
                          <Tag type="warning">Sin ingredientes. Agregue Materias Primas (Café kg, Azúcar kg, Leche, etc).</Tag>
                        ) : (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {receta.map((ing, i) => {
                              const mp = materiasPrimas.find((m) => m.id === ing.productoId)
                              const unidad = mp?.unidad_consumo?.toUpperCase() || 'g'
                              const esEmpaque = ['UND', 'EMPAQUE', 'CAJA', 'BOLSA', 'PAQUETE', 'ROLLO', 'UNIDAD'].includes(unidad)
                              return (
                                <div key={ing.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <Select
                                    style={{ flex: 1 }}
                                    value={ing.productoId}
                                    placeholder="Seleccione un Insumo MP..."
                                    onChange={(v: any) => {
                                      const nr = [...receta]
                                      const mpx = materiasPrimas.find((m) => m.id === v)
                                      nr[i].productoId = v
                                      nr[i].nombre = mpx?.nombre
                                      setReceta(nr)
                                    }}
                                    optionRender={(opt: any) => {
                                      const mpx = materiasPrimas.find((m) => m.id === opt.value)
                                      if (!mpx) return <span>{opt.label}</span>
                                      return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>🟣 {mpx.nombre}</span>
                                          <Tag color={esEmpaque ? 'geekblue' : 'purple'} style={{ marginLeft: 8 }}>
                                            {mpx.unidad_compra} · /{mpx.unidad_consumo}
                                          </Tag>
                                        </div>
                                      )
                                    }}
                                  >
                                    {materiasPrimas.map((m) => (
                                      <Option key={m.id} value={m.id}>🟣 {m.nombre} ({m.unidad_consumo}) · Compra: {m.unidad_compra}</Option>
                                    ))}
                                  </Select>
                                  <InputNumber
                                    min={esEmpaque ? 1 : 0.01}
                                    step={esEmpaque ? 1 : 0.5}
                                    precision={esEmpaque ? 0 : 2}
                                    value={ing.cantidad}
                                    onChange={(v: any) => {
                                      const nr = [...receta]
                                      nr[i].cantidad = Number(v)
                                      setReceta(nr)
                                    }}
                                    addonBefore={
                                      mp ? (
                                        <Tag color={esEmpaque ? 'geekblue' : 'purple'}>
                                          {esEmpaque ? '📦' : '⚖️'} {mp.unidad_consumo}
                                        </Tag>
                                      ) : 'Unidad'
                                    }
                                    addonAfter={
                                      mp
                                        ? esEmpaque
                                          ? 'und/empaque'
                                          : 'fracción (g/ml/cc)'
                                        : ''
                                    }
                                    style={{ width: 240 }}
                                  />
                                  <Button danger icon={<MinusCircleOutlined />} onClick={() => removeIngrediente(ing.id)} />
                                </div>
                              )
                            })}
                          </Space>
                        )}
                      </Card>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </ModalDrawer>
    </div>
  )
}

export default Productos
