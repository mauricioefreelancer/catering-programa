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
  tipo_cafe?: 'SOLUBLE' | 'GRANO' | null
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
  const [variantesCodigo, setVariantesCodigo] = useState<Producto[]>([])
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
        tipo_cafe: (p.tipoCafe ?? p.tipo_cafe ?? null) || null,
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
    setVariantesCodigo([])
    setEditing(null)
    setOpen(false)
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const esDosificado = (editing?.tipo || values.tipo) === 'DOSIFICADO'
      const costoTotal = Number(values.costo_base || 0) * (1 + Number(values.iva || 0))
      const payloadBackend: any = {
        idProveedor: values.idProveedor ? Number(values.idProveedor) : null,
        codigoBarras: values.codigo_barras,
        nombre: values.nombre,
        // los DOSIFICADOS se editan como está, sin re-guardar type de forma destructiva
        ...(editing?.tipo !== 'DOSIFICADO' ? { Tipo_Producto: values.tipo || 'ESTANDAR' } : {}),
        unidadCompra: values.unidad_compra,
        unidadConsumo: values.unidad_consumo,
        ...(values.tipo_cafe ? { tipoCafe: values.tipo_cafe } : {}),
        equivalencia: Number(values.equivalencia || 1),
        costoBase: Number(values.costo_base || 0),
        IVA: Number(values.iva || 0),
        costoTotal: Math.round(costoTotal * 100) / 100,
        stockActual: Number(values.stock_actual || 0),
        stockMin: Number(values.stock_min || 0),
        stockMax: Number(values.stock_max || 0),
      }
      const recetaPayload = esDosificado
        ? (receta || []).map((r: Ingrediente) => ({
            idProductoIngrediente: Number(r.productoId),
            cantidad: Number(r.cantidad),
          }))
        : undefined

      if (editing) {
        try {
          await patch(`/productos/${editing.id}`, payloadBackend)
          if (esDosificado && recetaPayload) {
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

  const openEdit = async (p: Producto) => {
    setEditing(p)
    setTipoSel(p.tipo)
    setOpen(true)
    detectarVariantes(p.codigo_barras, p.id)
    if (p.tipo === 'DOSIFICADO') {
      setTabKey('RECETA')
      try {
        const full: any = await get(`/productos/${p.id}`)
        const recetas: any[] = (full as any)?.recetasProdTerm || []
        const ing: Ingrediente[] = recetas.map((r: any, i: number) => ({
          id: i + 1,
          productoId: Number(r.idMatPrima),
          cantidad: Number(r.cantidadDosis),
          nombre: data.find((m) => m.id === Number(r.idMatPrima))?.nombre,
        }))
        setReceta(ing)
      } catch (e) {
        setReceta([])
      }
    } else {
      setTabKey('GENERAL')
      setReceta([])
    }
  }

  const openCreate = () => {
    setEditing(null)
    setTipoSel('ESTANDAR')
    setTabKey('GENERAL')
    setReceta([])
    setVariantesCodigo([])
    setOpen(true)
  }

  const tipoColor = (t: string) => {
    if (t === 'DOSIFICADO') return 'orange'
    if (t === 'MATERIA_PRIMA') return 'purple'
    return 'blue'
  }
  const tipoLabel = (t: string) => {
    if (t === 'DOSIFICADO') return 'DOSIFICADO · Receta (Bebida Café)'
    if (t === 'MATERIA_PRIMA') return 'MATERIA PRIMA · Insumo para recetas'
    return 'ESTÁNDAR · Compra/Venta en la misma unidad'
  }
  const proveedorNombrePorId = (idP: number | null | undefined) => {
    if (!idP) return ''
    const pr = proveedoresList.find((x: any) => Number(x.idProveedor || x.id) === Number(idP))
    return pr ? (pr.razonSocial || pr.razon_social || '') : ''
  }

  const detectarVariantes = (codigo: string, idActual?: number) => {
    const cod = (codigo || '').trim()
    if (!cod) {
      setVariantesCodigo([])
      return
    }
    const variantes = data.filter((c) => c.codigo_barras === cod && c.id !== idActual)
    setVariantesCodigo(variantes)
  }

  const addIngrediente = () => {
    if (materiasPrimas.length === 0) {
      message.warning('Antes de armar una receta, marque al menos un producto como Insumo (🟣 MP) usando la columna "¿Usarlo como Insumo?".')
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
    {
      title: 'Tipo Café',
      dataIndex: 'tipo_cafe',
      key: 'tipo_cafe',
      width: 130,
      render: (v: string | null, r: Producto) => {
        if (r.tipo !== 'MATERIA_PRIMA' || !v) return <span style={{ color: '#bbb' }}>—</span>
        return v === 'SOLUBLE'
          ? <Tag color="green">☕ Soluble · 2gr</Tag>
          : <Tag color="geekblue">☕ Grano · 8gr</Tag>
      },
    },
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
      title: '¿Usarlo como Insumo?',
      key: 'mp_toggle',
      width: 165,
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
          {perm.eliminar && r.tipo === 'DOSIFICADO' && (
            <Tag color="default" style={{ cursor: 'not-allowed' }}>🔒 Fijo</Tag>
          )}
          {perm.eliminar && r.tipo !== 'DOSIFICADO' && (
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
                  {editing?.tipo === 'DOSIFICADO' ? (
                    <Form.Item label="Clasificación del producto" extra="Producto DOSIFICADO pre-parametrizado (bebida de café). El tipo no se puede cambiar; edite su receta en la pestaña 🧪 Receta (Ingredientes).">
                      <Tag color="orange">🟧 DOSIFICADO · Receta (pre-parametrizado)</Tag>
                    </Form.Item>
                  ) : (
                    <Form.Item name="tipo" label="Clasificación del producto" rules={[{ required: true }]} initialValue="ESTANDAR" extra="Un solo formulario. Aquí defines cómo se usará el producto. Los DOSIFICADOS ya están parametrizados y se asignan en las máquinas de café.">
                      <Radio.Group onChange={(e: any) => setTipoSel(e.target.value)}>
                        <Radio.Button value="ESTANDAR">🔵 Estándar</Radio.Button>
                        <Radio.Button value="MATERIA_PRIMA">🟣 Materia Prima (insumo)</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                  )}
                  {tipoSel === 'MATERIA_PRIMA' && (
                    <Tag color="purple" style={{ marginBottom: 12 }}>
                      🟣 INSUMO: Este producto actuará como ingrediente en recetas DOSIFICADAS.
                    </Tag>
                  )}
                  {tipoSel === 'DOSIFICADO' && (
                    <Tag color="orange" style={{ marginBottom: 12 }}>
                      🧪 RECETA: Pase a la pestaña "Receta (Ingredientes)" para elegir qué Materias Primas (gramos por servicio) componen este producto.
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
                    <Form.Item name="codigo_barras" label="Código Barras" rules={[{ required: true }]}>
                      <Input onChange={(e) => detectarVariantes(e.target.value, editing?.id)} />
                    </Form.Item>
                  </div>
                  {variantesCodigo.length > 0 && (
                    <div style={{ marginBottom: 12, padding: 10, border: '1px solid #faad14', background: '#fffbe6', borderRadius: 6 }}>
                      <Tag color="warning">⚠️ Este código ya existe en {variantesCodigo.length} producto(s) de otro(s) proveedor(es):</Tag>
                      <div style={{ marginTop: 6 }}>
                        {variantesCodigo.map((v) => {
                          const prov = proveedorNombrePorId(v.idProveedor)
                          return (
                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <span>{v.nombre}</span>
                              {prov ? <Tag color="cyan">{prov}</Tag> : <Tag>Sin proveedor</Tag>}
                              <Tag color={v.tipo === 'MATERIA_PRIMA' ? 'purple' : 'blue'}>{v.tipo}</Tag>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 6, color: '#8c6d00', fontSize: 12 }}>
                        Puede guardar este producto con el mismo código: se tratará como un ítem independiente para ese proveedor. Elija el proveedor correcto arriba.
                      </div>
                    </div>
                  )}
                  <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="unidad_compra" label="Unidad Compra (Empaque)" rules={[{ required: true }]}><Input placeholder="Ej: CAJA 24 / KILO / BOLSA" /></Form.Item>
                    <Form.Item name="unidad_consumo" label="Unidad Consumo (Fracción)" rules={[{ required: true }]}><Input placeholder="Ej: UND / Gramo / ml" /></Form.Item>
                  </div>
                  {tipoSel === 'MATERIA_PRIMA' && (
                    <Form.Item
                      name="tipo_cafe"
                      label="Tipo de Café (solo si este insumo es café)"
                      extra="Define la dosificación por calibración: Soluble = 2 gr por bebida · Grano (molino) = 8 gr por bebida."
                    >
                      <Select allowClear placeholder="No es café / no aplica">
                        <Option value="SOLUBLE">☕ Café SOLUBLE (2 gr por bebida)</Option>
                        <Option value="GRANO">☕ Café en GRANO (8 gr por bebida)</Option>
                      </Select>
                    </Form.Item>
                  )}
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
