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
  Select,
  Tabs,
  InputNumber,
  Card,
  Badge,
  Drawer,
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, DesktopOutlined, ReloadOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'
import { apiService } from '../../api/services/api'

const { Title } = Typography
const { Option } = Select

interface Espiral {
  id: number
  espiral: string
  capacidad_max: number
  cantidad_actual: number
  productoId?: number
  productoNombre?: string
  precio_venta_cliente?: number
}
interface BotonNRQ {
  id: number
  boton: string
  productoId?: number
  productoNombre?: string
  precio_venta_cliente?: number
}

interface Maquina {
  id: number
  serial: string
  marca: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  clienteId: number
  clienteNombre: string
  operadorId: number
  operadorNombre: string
  zona: string
  estado: 'OPERANDO' | 'FUERA_SERVICIO' | 'MANTENIMIENTO'
  espirales?: Espiral[]
  botonesNRQ?: BotonNRQ[]
}

const genEspiralesVacio = (): Espiral[] => []
const genBotonesVacio = (): BotonNRQ[] => []

const normalizarTipo = (t: any): 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA' => {
  const s = String(t || '').toUpperCase()
  if (s === 'SNACK' || s === 'BEBIDA' || s === 'CAFE' || s === 'CAFÉ' || s === 'COMBINADA') {
    if (s === 'CAFÉ') return 'CAFE'
    return s as any
  }
  return 'SNACK'
}

const normalizarEstado = (e: any): 'OPERANDO' | 'FUERA_SERVICIO' | 'MANTENIMIENTO' => {
  const s = String(e || '').toUpperCase()
  if (s === 'OPERANDO' || s === 'FUERA_SERVICIO' || s === 'FUERA SERVICIO' || s === 'MANTENIMIENTO') {
    if (s === 'FUERA SERVICIO') return 'FUERA_SERVICIO'
    return s as any
  }
  return 'OPERANDO'
}

const Maquinas = () => {
  const [data, setData] = useState<Maquina[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [operadores, setOperadores] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Maquina | null>(null)
  const [loading, setLoading] = useState(false)
  const [espirales, setEspirales] = useState<Espiral[]>([])
  const [botones, setBotones] = useState<BotonNRQ[]>([])
  const perm = usePermissions('maquinas')

  const [openEspModal, setOpenEspModal] = useState(false)
  const [editEspIdx, setEditEspIdx] = useState<number | null>(null)
  const [formEsp] = Form.useForm()

  const [openBtnModal, setOpenBtnModal] = useState(false)
  const [editBtnIdx, setEditBtnIdx] = useState<number | null>(null)
  const [formBtn] = Form.useForm()

  const [rend, setRend] = useState<{ materiasPrimas: any[]; dosificados: any[]; maquina?: any } | null>(null)

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [maquinasRes, clientesRes, operadoresRes, productosRes] = await Promise.all([
        apiService.get('/maquinas?include=cliente,operador'),
        apiService.get('/clientes'),
        apiService.get('/operadores'),
        apiService.get('/productos?limit=2000&take=2000'),
      ])

      const maquinasList = Array.isArray(maquinasRes) ? maquinasRes : (maquinasRes?.data || [])
      const clientesList = Array.isArray(clientesRes) ? clientesRes : (clientesRes?.data || [])
      const operadoresList = Array.isArray(operadoresRes) ? operadoresRes : (operadoresRes?.data || [])
      const productosList = Array.isArray(productosRes) ? productosRes : (productosRes?.data || [])

      const maquinasMapeadas: Maquina[] = maquinasList.map((m: any) => ({
        id: m.idMaquina ?? m.id,
        serial: m.serial ?? '',
        marca: m.marca ?? '',
        tipo: normalizarTipo(m.tipo ?? m.Tipo_Maquina),
        clienteId: m.idCliente ?? m.clienteId,
        clienteNombre: m.cliente?.razonSocial ?? m.clienteNombre ?? '',
        operadorId: m.idOperador ?? m.operadorId,
        operadorNombre: m.operador?.nombreCompleto ?? m.operador?.usuario?.nombre ?? m.operadorNombre ?? '',
        zona: m.ubicacionEsp ?? m.zona ?? '',
        estado: normalizarEstado(m.estado ?? m.estado_operacion),
        espirales: Array.isArray(m.mapaMateriaPrima)
          ? m.mapaMateriaPrima.map((e: any) => ({
              id: e.idMapaMp ?? Math.random(),
              espiral: e.espiralCodigo ?? '',
              capacidad_max: e.capacidadMax ?? 0,
              cantidad_actual: Number(e.capacidadActual ?? e.cantidad_actual ?? 0),
              productoId: e.idProducto,
              productoNombre: e.producto?.nombreProducto ?? e.producto?.nombre ?? '',
              precio_venta_cliente: e.precioVentaCliente,
            }))
          : (m.espirales ?? genEspiralesVacio()),
        botonesNRQ: Array.isArray(m.mapaCafeNrq)
          ? m.mapaCafeNrq.map((b: any) => ({
              id: b.idMapaNrq ?? Math.random(),
              boton: b.opcionBoton ?? '',
              productoId: b.idProdTerm,
              productoNombre: b.productoTerminado?.nombreProducto ?? b.productoTerminado?.nombre ?? '',
              precio_venta_cliente: b.precioVentaCliente,
            }))
          : (m.botonesNRQ ?? genBotonesVacio()),
      }))

      setData(maquinasMapeadas)
      setClientes(clientesList)
      setOperadores(operadoresList)
      setProductos(productosList)
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

  const filtered = useMemo(() => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter((c) => c.serial.toLowerCase().includes(s) || c.marca.toLowerCase().includes(s) || c.clienteNombre.toLowerCase().includes(s))
  }, [data, search])

  const resetDrawer = () => {
    setEditing(null)
    setEspirales([])
    setBotones([])
    setRend(null)
    setOpen(false)
  }

  const loadRendimiento = async (id: number) => {
    try {
      const rd: any = await apiService.get(`/maquinas/${id}/rendimiento`)
      const rdata = rd?.data ?? rd ?? {}
      setRend({ materiasPrimas: rdata.materiasPrimas ?? [], dosificados: rdata.dosificados ?? [], maquina: rdata.maquina })
    } catch {
      setRend({ materiasPrimas: [], dosificados: [] })
    }
  }

  const openEdit = async (m: Maquina) => {
    setEditing(m)
    setEspirales([])
    setBotones([])
    setRend(null)
    setOpen(true)
    try {
      // Cargar detalle completo (mapa espirales/botones + precio de venta por cliente)
      const det: any = await apiService.get(`/maquinas/${m.id}`)
      const info: any = det?.data ?? det ?? {}
      const esp = info.mapaMateriaPrima ?? []
      const bot = info.mapaCafeNrq ?? []
      setEspirales(
        esp.map((e: any) => ({
          id: e.idMapaMp ?? Math.random(),
          espiral: e.espiralCodigo ?? '',
          capacidad_max: e.capacidadMax ?? 0,
          cantidad_actual: Number(e.capacidadActual ?? e.cantidad_actual ?? 0),
          productoId: e.idProducto,
          productoNombre: e.producto?.nombreProducto ?? e.producto?.nombre ?? '',
          precio_venta_cliente: e.precioVentaCliente,
        })),
      )
      setBotones(
        bot.map((b: any) => ({
          id: b.idMapaNrq ?? Math.random(),
          boton: b.opcionBoton ?? '',
          productoId: b.idProdTerm,
          productoNombre: b.productoTerminado?.nombreProducto ?? b.productoTerminado?.nombre ?? '',
          precio_venta_cliente: b.precioVentaCliente,
        })),
      )
      if (m.tipo === 'CAFE') {
        loadRendimiento(m.id)
      }
    } catch {
      // Si falla el detalle, mantener lo que venga en la lista
      setEspirales(m.espirales ? [...m.espirales] : [])
      setBotones(m.botonesNRQ ? [...m.botonesNRQ] : [])
    }
  }
  const openCreate = () => {
    setEditing(null)
    setEspirales([])
    setBotones([])
    setOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const body: any = {
        serial: values.serial,
        marca: values.marca,
        tipo: values.tipo,
        idCliente: values.clienteId,
        idOperador: values.operadorId,
        ubicacionEsp: values.zona,
        estado: values.estado ? values.estado !== 'FUERA_SERVICIO' && values.estado !== 'FUERA SERVICIO' : true,
      }

      let savedMaquina: any
      if (editing) {
        savedMaquina = await apiService.patch(`/maquinas/${editing.id}`, body)
        message.success('Máquina actualizada')
      } else {
        savedMaquina = await apiService.post('/maquinas', body)
        message.success('Máquina creada')
      }

      if (espirales.length > 0 || botones.length > 0) {
        try {
          if (espirales.length > 0) {
            await apiService.post(`/maquinas/${savedMaquina?.idMaquina ?? savedMaquina?.id ?? editing?.id}/espirales`, { espirales })
          }
          if (botones.length > 0) {
            await apiService.post(`/maquinas/${savedMaquina?.idMaquina ?? savedMaquina?.id ?? editing?.id}/botones`, { botones })
          }
        } catch {
          message.warning('Espirales/Botones guardados localmente (endpoint no disponible en API')
        }
      }

      await loadData()
      resetDrawer()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar máquina')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiService.remove(`/maquinas/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Máquina eliminada')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al eliminar máquina')
    }
  }

  const estadoColor = (e: string) => (e === 'OPERANDO' ? 'green' : e === 'MANTENIMIENTO' ? 'gold' : 'red')
  const tipoColor = (t: string) => (t === 'SNACK' ? 'orange' : t === 'BEBIDA' ? 'blue' : t === 'CAFE' ? 'purple' : 'cyan')

  const openAddEspiral = () => {
    setEditEspIdx(null)
    formEsp.resetFields()
    formEsp.setFieldsValue({
      espiral: '',
      productoId: undefined,
      capacidad_max: 15,
      cantidad_actual: 0,
    })
    setOpenEspModal(true)
  }

  const openEditEspiral = (idx: number) => {
    const esp = espirales[idx]
    setEditEspIdx(idx)
    formEsp.setFieldsValue({
      espiral: esp.espiral,
      productoId: esp.productoId,
      cantidad_actual: esp.cantidad_actual ?? 0,
      capacidad_max: esp.capacidad_max,
    })
    setOpenEspModal(true)
  }

  const closeEspModal = () => {
    setOpenEspModal(false)
    setEditEspIdx(null)
  }

  const saveEspiral = async () => {
    try {
      const values = await formEsp.validateFields()
      const prod = productos.find((p) => p.idProducto ?? p.id === values.productoId)
      const prodName = prod?.nombreProducto ?? prod?.nombre

      let ns: Espiral[]
      if (editEspIdx === null) {
        const newId = Math.max(0, ...espirales.map((e) => e.id), 0) + 1
        const nuevo: Espiral = {
          id: newId,
          espiral: String(values.espiral).trim().toUpperCase(),
          capacidad_max: Number(values.capacidad_max),
          cantidad_actual: Number(values.cantidad_actual ?? 0),
          productoId: values.productoId,
          productoNombre: prodName,
          precio_venta_cliente: undefined,
        }
        ns = [...espirales, nuevo]
        message.success(`Espiral ${nuevo.espiral} agregada`)
      } else {
        ns = [...espirales]
        const original = ns[editEspIdx]
        ns[editEspIdx] = {
          ...original,
          espiral: String(values.espiral).trim().toUpperCase(),
          capacidad_max: Number(values.capacidad_max),
          cantidad_actual: Number(values.cantidad_actual ?? 0),
          productoId: values.productoId,
          productoNombre: prodName,
          precio_venta_cliente: original?.precio_venta_cliente,
        }
        message.success(`Espiral ${ns[editEspIdx].espiral} actualizada`)
      }

      setEspirales(ns)
      // Persistir a BD si la máquina ya existe
      if (editing?.id) {
        try {
          await apiService.post(`/maquinas/${editing.id}/espirales`, { espirales: ns })
          if (editing.tipo === 'CAFE') loadRendimiento(editing.id)
        } catch {
          message.warning('El espiral quedó pendiente de guardar (verifica conexión y vuelve a Guardar la máquina)')
        }
      }
      closeEspModal()
    } catch {}
  }

  const deleteEspiral = (idx: number) => {
    const ns = [...espirales]
    const removed = ns.splice(idx, 1)[0]
    setEspirales(ns)
    message.success(`Espiral ${removed.espiral} eliminada`)
    if (editing?.id && editing.tipo === 'CAFE') {
      apiService.post(`/maquinas/${editing.id}/espirales`, { espirales: ns }).then(() => loadRendimiento(editing.id)).catch(() => {})
    }
  }

  const openAddBoton = () => {
    setEditBtnIdx(null)
    formBtn.resetFields()
    formBtn.setFieldsValue({
      boton: '',
      productoId: undefined,
    })
    setOpenBtnModal(true)
  }

  const openEditBoton = (idx: number) => {
    const b = botones[idx]
    setEditBtnIdx(idx)
    formBtn.setFieldsValue({
      boton: b.boton,
      productoId: b.productoId,
    })
    setOpenBtnModal(true)
  }

  const closeBtnModal = () => {
    setOpenBtnModal(false)
    setEditBtnIdx(null)
  }

  const saveBoton = async () => {
    try {
      const values = await formBtn.validateFields()
      const prod = productos.find((p) => p.idProducto ?? p.id === values.productoId)
      const prodName = prod?.nombreProducto ?? prod?.nombre
      let ns: BotonNRQ[]

      if (editBtnIdx === null) {
        const newId = Math.max(0, ...botones.map((b) => b.id), 0) + 1
        const nuevo: BotonNRQ = {
          id: newId,
          boton: String(values.boton).trim().toUpperCase(),
          productoId: values.productoId,
          productoNombre: prodName,
          precio_venta_cliente: undefined,
        }
        ns = [...botones, nuevo]
        message.success(`Botón ${nuevo.boton} agregado`)
      } else {
        ns = [...botones]
        ns[editBtnIdx] = {
          ...ns[editBtnIdx],
          boton: String(values.boton).trim().toUpperCase(),
          productoId: values.productoId,
          productoNombre: prodName,
          precio_venta_cliente: ns[editBtnIdx]?.precio_venta_cliente,
        }
        message.success(`Botón ${ns[editBtnIdx].boton} actualizado`)
      }
      setBotones(ns)
      // Persistir a BD si la máquina ya existe
      if (editing?.id) {
        try {
          await apiService.post(`/maquinas/${editing.id}/botones`, { botones: ns })
          if (editing.tipo === 'CAFE') loadRendimiento(editing.id)
        } catch {
          message.warning('El botón quedó pendiente de guardar (verifica conexión y vuelve a Guardar la máquina)')
        }
      }
      closeBtnModal()
    } catch {}
  }

  const deleteBoton = (idx: number) => {
    const ns = [...botones]
    const removed = ns.splice(idx, 1)[0]
    setBotones(ns)
    message.success(`Botón ${removed.boton} eliminado`)
    if (editing?.id && editing.tipo === 'CAFE') {
      apiService.post(`/maquinas/${editing.id}/botones`, { botones: ns }).then(() => loadRendimiento(editing.id)).catch(() => {})
    }
  }

  const columns = [
    { title: 'Serial', dataIndex: 'serial', key: 's', render: (v: string) => <code>{v}</code> },
    { title: 'Marca', dataIndex: 'marca', key: 'm' },
    { title: 'Tipo', dataIndex: 'tipo', key: 't', render: (v: string) => <Tag color={tipoColor(v)}>{v}</Tag> },
    { title: 'Cliente', dataIndex: 'clienteNombre', key: 'c', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Operador', dataIndex: 'operadorNombre', key: 'o' },
    { title: 'Zona', dataIndex: 'zona', key: 'z' },
    {
      title: 'Estado',
      key: 'e',
      dataIndex: 'estado',
      render: (v: string) => (
        <Badge status={v === 'OPERANDO' ? 'success' : v === 'MANTENIMIENTO' ? 'warning' : 'error'} text={<Tag color={estadoColor(v)}>{v}</Tag>} />
      ),
    },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Maquina) => (
        <Space>
          {perm.editar && <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>Editar</Button>}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar máquina?" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>Eliminar</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const totalEspirales = espirales.length
  const totalBotones = botones.length

  // Solo productos DOSIFICADOS (receta café) para asignar a los botones NRQ.
  const productosDosificados = useMemo(
    () => productos.filter((p: any) => {
      const t = String(p?.tipoProducto ?? p?.Tipo_Producto ?? p?.tipo ?? '').toUpperCase()
      return t.includes('DOSIF') || t === 'DOSIFICADO'
    }),
    [productos],
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Máquinas Vending</Title>
        <Space>
          <Button icon={<ReloadOutlined spin={fetching} />} onClick={loadData}>Recargar</Button>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar serial, marca..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} />
          {perm.crear && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva Máquina</Button>}
        </Space>
      </div>
      <Spin spinning={initialLoading}>
        <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} máquinas` }} scroll={{ x: 1100 }} />
      </Spin>
      <ModalDrawer
        title={editing ? 'Editar Máquina' : 'Nueva Máquina'} open={open} onClose={resetDrawer} onSubmit={handleSubmit}
        initialValues={editing || { tipo: 'SNACK', estado: 'OPERANDO' }} loading={loading} width={920}
      >
        <Form.Item name="tipo" label="Tipo Máquina" rules={[{ required: true }]} initialValue="SNACK">
          <Select>
            <Option value="SNACK">🥨 SNACK (Sólidos)</Option>
            <Option value="BEBIDA">🥤 BEBIDA (Líquidos)</Option>
            <Option value="COMBINADA">🧃 COMBINADA</Option>
            <Option value="CAFE">☕ CAFÉ (Dosificadora)</Option>
          </Select>
        </Form.Item>
        <Tabs
          items={[
            {
              key: 'GENERAL',
              label: '📋 Datos Básicos',
              children: (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="serial" label="Serial" rules={[{ required: true }]}><Input prefix={<DesktopOutlined />} /></Form.Item>
                    <Form.Item name="marca" label="Marca" rules={[{ required: true }]}><Input /></Form.Item>
                  </div>
                  <Form.Item name="zona" label="Ubicación / Zona" rules={[{ required: true }]}><Input placeholder="Ej: Piso 3 - Cafetería" /></Form.Item>
                </>
              ),
            },
            {
              key: 'ASIG',
              label: '👥 Asignaciones',
              children: (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="clienteId" label="Cliente" rules={[{ required: true }]}>
                      <Select placeholder="Seleccione cliente">
                        {clientes.map((c) => <Option key={c.idCliente ?? c.id} value={c.idCliente ?? c.id}>{c.razonSocial ?? c.nombre}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="operadorId" label="Operador a Cargo" rules={[{ required: true }]}>
                      <Select placeholder="Seleccione operador">
                        {operadores.map((o) => <Option key={o.idOperador ?? o.id} value={o.idOperador ?? o.id}>{o.nombreCompleto ?? o.usuario?.nombre ?? o.nombre}</Option>)}
                      </Select>
                    </Form.Item>
                  </div>
                </>
              ),
            },
            ...[
              {
                key: 'MAPA',
                label: `🗂️ Mapa MP (Espirales) ${totalEspirales > 0 ? `· ${totalEspirales}` : ''}`,
                children: (
                  <Card
                    size="small"
                    title="Configurar espirales y productos — defínelas una a una"
                    type="inner"
                    extra={
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddEspiral}>
                        Agregar Espiral
                      </Button>
                    }
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={espirales}
                      pagination={false}
                      locale={{ emptyText: 'Sin espirales asignadas. Clic en "Agregar Espiral" para crear una.' }}
                      columns={[
                        {
                          title: 'Espiral',
                          dataIndex: 'espiral',
                          width: 100,
                          render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                        },
                        {
                          title: 'Producto Asignado',
                          dataIndex: 'productoNombre',
                          render: (v: string) => v ? <span>{v}</span> : <Tag color="default">Sin asignar</Tag>,
                        },
                        {
                          title: 'Precio Venta',
                          dataIndex: 'precio_venta_cliente',
                          width: 120,
                          align: 'right',
                          render: (v: number) =>
                            v != null && !isNaN(v) ? (
                              <b style={{ color: '#1677ff' }}>${Number(v).toLocaleString('es-CO')}</b>
                            ) : (
                              <Tag color="gold">Sin precio</Tag>
                            ),
                        },
                        {
                          title: 'Capacidad Actual',
                          dataIndex: 'cantidad_actual',
                          width: 130,
                          align: 'right',
                          render: (v: number, r: Espiral) => {
                            const val = v ?? 0
                            const max = r.capacidad_max ?? 1
                            const pct = Math.min(100, Math.round((val / max) * 100))
                            return (
                              <Space>
                                <b>{val}</b>
                                <Tag color={val === 0 ? 'red' : pct > 50 ? 'green' : 'gold'}>
                                  {pct}%
                                </Tag>
                              </Space>
                            )
                          },
                        },
                        {
                          title: 'Capacidad Máx.',
                          dataIndex: 'capacidad_max',
                          width: 120,
                          align: 'right',
                          render: (v: number) => <span>{v ?? 0}</span>,
                        },
                        {
                          title: 'Acciones',
                          key: 'acc',
                          width: 140,
                          render: (_: any, r: Espiral, i: number) => (
                            <Space size={4}>
                              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditEspiral(i)}>
                                Editar
                              </Button>
                              <Popconfirm title={`¿Eliminar espiral ${r.espiral}?`} onConfirm={() => deleteEspiral(i)}>
                                <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                                  Quitar
                                </Button>
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                ),
              },
              ...(editing?.tipo === 'CAFE'
                ? [
                    {
                      key: 'NRQ',
                    label: `🔘 Mapa NRQ (Botones Café) ${totalBotones > 0 ? `· ${totalBotones}` : ''}`,
                    children: (
                      <>
                      <Card
                        size="small"
                        title="Configurar botones dosificadora — defínelos uno a uno"
                        type="inner"
                        extra={
                          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddBoton}>
                            Agregar Botón
                          </Button>
                        }
                      >
                        <Table
                          size="small"
                          rowKey="id"
                          dataSource={botones}
                          pagination={false}
                          locale={{ emptyText: 'Sin botones asignados. Clic en "Agregar Botón" para crear uno.' }}
                          columns={[
                            {
                              title: 'Botón',
                              dataIndex: 'boton',
                              width: 120,
                              render: (v: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                            },
                            {
                              title: 'Producto Dosificado',
                              dataIndex: 'productoNombre',
                              render: (v: string) => v ? <span>{v}</span> : <Tag color="default">Sin asignar</Tag>,
                            },
                            {
                              title: 'Precio Venta',
                              dataIndex: 'precio_venta_cliente',
                              width: 120,
                              align: 'right',
                              render: (v: number) =>
                                v != null && !isNaN(v) ? (
                                  <b style={{ color: '#1677ff' }}>${Number(v).toLocaleString('es-CO')}</b>
                                ) : (
                                  <Tag color="gold">Sin precio</Tag>
                                ),
                            },
                            {
                              title: 'Acciones',
                              key: 'acc',
                              width: 140,
                              render: (_: any, r: BotonNRQ, i: number) => (
                                <Space size={4}>
                                  <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditBoton(i)}>
                                    Editar
                                  </Button>
                                  <Popconfirm title={`¿Eliminar botón ${r.boton}?`} onConfirm={() => deleteBoton(i)}>
                                    <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                                      Quitar
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </Card>
                      <Card
                        size="small"
                        title="📈 Rendimiento de Producción (tazas servibles según Materia Prima en las espirales)"
                        type="inner"
                        style={{ marginTop: 12 }}
                        extra={
                          rend ? <Tag color="green">Actualizado</Tag> : <Tag color="default">Requiere guardar</Tag>
                        }
                      >
                        {rend && rend.dosificados.length > 0 ? (
                          <Table
                            size="small"
                            rowKey="idMapaNrq"
                            dataSource={rend.dosificados}
                            pagination={false}
                            columns={[
                              {
                                title: 'Botón',
                                dataIndex: 'boton',
                                width: 90,
                                render: (v: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag>,
                              },
                              {
                                title: 'Dosificado',
                                dataIndex: 'nombre',
                                render: (v: string) => (v ? <strong>{v}</strong> : <Tag color="default">Sin asignar</Tag>),
                              },
                              {
                                title: 'Tazas posibles',
                                dataIndex: 'tazasPosibles',
                                width: 130,
                                align: 'right',
                                render: (v: number) => <b style={{ color: '#1677ff' }}>{v.toLocaleString('es-CO')} 🥤</b>,
                              },
                              {
                                title: 'Factor limitante',
                                key: 'limitante',
                                render: (_, r) =>
                                  r.limitante ? <Tag color="gold">Falta: {r.limitante}</Tag> : <Tag color="green">Sin restricción</Tag>,
                              },
                              {
                                title: 'Ingredientes por servicio',
                                key: 'ing',
                                render: (_, r) => (
                                  <Space wrap size={4}>
                                    {r.ingredientes && r.ingredientes.length > 0
                                      ? r.ingredientes.map((ing: any, i: number) => (
                                          <Tag key={i} color={ing.tazasPosibles === 0 ? 'red' : 'blue'}>
                                            {ing.dosis} {ing.unidad} {ing.nombre}
                                            {ing.tazasPosibles === 0 ? ' (sin MP)' : ''}
                                          </Tag>
                                        ))
                                      : <Tag color="default">Sin receta</Tag>}
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        ) : (
                          <Tag style={{ display: 'block' }}>Asigne los botones y guarde (o ajuste las cantidades de MP en las espirales) para ver el cálculo de tazas.</Tag>
                        )}
                      </Card>
                      <Card
                        size="small"
                        title="🗂️ Resumen Materias Primas (empaque → unidades → consumo de los botones)"
                        type="inner"
                        style={{ marginTop: 12 }}
                      >
                        {rend && rend.materiasPrimas.length > 0 ? (
                          <Table
                            size="small"
                            rowKey="idProducto"
                            dataSource={rend.materiasPrimas}
                            pagination={false}
                            columns={[
                              {
                                title: 'Materia Prima',
                                dataIndex: 'nombre',
                                render: (v: string) => <strong>{v || '—'}</strong>,
                              },
                              { title: 'Espiral', dataIndex: 'espiral', width: 80, render: (v: string) => <Tag color="blue">{v}</Tag> },
                              { title: 'Empaques', dataIndex: 'empaques', width: 90, align: 'right', render: (v: number) => <span>{v}</span> },
                              { title: 'Und/empaque', dataIndex: 'equivalencia', width: 100, align: 'right', render: (v: number) => <span>{v?.toLocaleString?.('es-CO') ?? v}</span> },
                              { title: 'Unidades disp.', dataIndex: 'unidadesDisponibles', width: 110, align: 'right', render: (v: number) => <span>{v?.toLocaleString?.('es-CO') ?? v} {rend?.materiasPrimas?.[0]?.unidad || ''}</span> },
                              {
                                title: 'Dosis/servicio (suma botones)',
                                dataIndex: 'dosisPorServicioTotal',
                                width: 150,
                                align: 'right',
                                render: (v: number) => <span>{v || 0}</span>,
                              },
                              {
                                title: 'Servicios posibles',
                                dataIndex: 'serviciosPosibles',
                                width: 130,
                                align: 'right',
                                render: (v: number) => <b style={{ color: '#1677ff' }}>{v?.toLocaleString?.('es-CO') ?? v} 🥤</b>,
                              },
                              {
                                title: 'Despacho',
                                key: 'despacho',
                                width: 120,
                                align: 'center',
                                render: (_, r) =>
                                  r.serviciosPosibles > 20 ? (
                                    <Tag color="green">OK</Tag>
                                  ) : r.serviciosPosibles > 0 ? (
                                    <Tag color="gold">Próximo a reponer</Tag>
                                  ) : (
                                    <Tag color="red">Despachar MP</Tag>
                                  ),
                              },
                            ]}
                          />
                        ) : (
                          <Tag style={{ display: 'block' }}>No hay Materias Primas en las espirales de esta máquina café. Asigne MP en "Capacidad Actual" de las espirales para calcular el despacho.</Tag>
                        )}
                      </Card>
                      </>
                    ),
                  },
                ]
              : []),
            ],
          ]}
        />
      </ModalDrawer>

      <Drawer
        title={editEspIdx === null ? 'Agregar Espiral' : `Editar Espiral ${editEspIdx !== null && espirales[editEspIdx] ? espirales[editEspIdx].espiral : ''}`}
        width={520}
        open={openEspModal}
        onClose={closeEspModal}
        destroyOnClose={false}
        maskClosable={false}
        zIndex={1500}
        extra={
          <Space>
            <Button onClick={closeEspModal}>Cancelar</Button>
            <Button type="primary" onClick={saveEspiral}>Guardar</Button>
          </Space>
        }
      >
        <Spin spinning={false}>
          <Form form={formEsp} layout="vertical" requiredMark={false} style={{ maxWidth: '100%' }} preserve>
            <Form.Item
              label="Código Espiral"
              name="espiral"
              rules={[
                { required: true, message: 'Digite el código de la espiral' },
                { max: 3, message: 'Máximo 3 caracteres permitidos' },
                { pattern: /^[A-Za-z0-9_-]+$/, message: 'Solo letras, números, _ o -' },
              ]}
              extra="Escriba el código manualmente (máx 3 carácteres). Ej: A1, ZZ, 01, -A"
            >
              <Input
                maxLength={3}
                placeholder="Ej: A1"
                style={{ textTransform: 'uppercase', letterSpacing: 2, fontSize: 18, fontFamily: 'monospace', fontWeight: 600 }}
              />
            </Form.Item>
            <Form.Item label="Producto Asignado" name="productoId">
              <Select allowClear placeholder="Seleccione el producto para esta espiral">
                {productos.map((p) => <Option key={p.idProducto ?? p.id} value={p.idProducto ?? p.id}>{p.nombreProducto ?? p.nombre}</Option>)}
              </Select>
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item
                label="Capacidad Máxima"
                name="capacidad_max"
                rules={[{ required: true, message: 'Digite capacidad máxima' }]}
                initialValue={15}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Capacidad Actual"
                name="cantidad_actual"
                rules={[{ required: true }]}
                initialValue={0}
                extra="Stock actual del producto en la espiral."
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          </Form>
        </Spin>
      </Drawer>

      <Drawer
        title={editBtnIdx === null ? 'Agregar Botón Café (NRQ)' : `Editar Botón NRQ ${editBtnIdx !== null && botones[editBtnIdx] ? botones[editBtnIdx].boton : ''}`}
        width={520}
        open={openBtnModal}
        onClose={closeBtnModal}
        destroyOnClose={false}
        maskClosable={false}
        zIndex={1500}
        extra={
          <Space>
            <Button onClick={closeBtnModal}>Cancelar</Button>
            <Button type="primary" onClick={saveBoton}>Guardar</Button>
          </Space>
        }
      >
        <Spin spinning={false}>
          <Form form={formBtn} layout="vertical" requiredMark={false} style={{ maxWidth: '100%' }} preserve>
            <Form.Item
              label="Código Botón"
              name="boton"
              rules={[
                { required: true, message: 'Digite el código del botón' },
                { max: 3, message: 'Máximo 3 caracteres permitidos' },
                { pattern: /^[A-Za-z0-9_-]+$/, message: 'Solo letras, números, _ o -' },
              ]}
              extra="Escriba el código manualmente (máx 3 carácteres). Ej: C1, ESP, A12, -B"
            >
              <Input
                maxLength={3}
                placeholder="Ej: C1"
                style={{ textTransform: 'uppercase', letterSpacing: 2, fontSize: 18, fontFamily: 'monospace', fontWeight: 600 }}
              />
            </Form.Item>
            <Form.Item
              label="Producto Dosificado"
              name="productoId"
              rules={[{ required: true, message: 'Seleccione un producto DOSIFICADO para este botón' }]}
              extra={`Solo se muestran productos DOSIFICADOS (receta café). Disponibles: ${productosDosificados.length}`}
            >
              <Select
                allowClear
                showSearch
                placeholder="Seleccione el producto DOSIFICADO para este botón"
                filterOption={(input, option: any) => String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              >
                {productosDosificados.map((p) => <Option key={p.idProducto ?? p.id} value={p.idProducto ?? p.id}>{p.nombreProducto ?? p.nombre}</Option>)}
              </Select>
            </Form.Item>
          </Form>
        </Spin>
      </Drawer>
    </div>
  )
}

export default Maquinas
