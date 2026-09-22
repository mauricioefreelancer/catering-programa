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
  cantidad_inicial: number
  cantidad_actual: number
  productoId?: number
  productoNombre?: string
}
interface BotonNRQ {
  id: number
  boton: string
  productoId?: number
  productoNombre?: string
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

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [maquinasRes, clientesRes, operadoresRes, productosRes] = await Promise.all([
        apiService.get('/maquinas?include=cliente,operador'),
        apiService.get('/clientes'),
        apiService.get('/operadores'),
        apiService.get('/productos'),
      ])

      const maquinasList = Array.isArray(maquinasRes) ? maquinasRes : (maquinasRes?.data || [])
      const clientesList = Array.isArray(clientesRes) ? clientesRes : (clientesRes?.data || [])
      const operadoresList = Array.isArray(operadoresRes) ? operadoresRes : (operadoresRes?.data || [])
      const productosList = Array.isArray(productosRes) ? productosRes : (productosRes?.data || [])

      const maquinasMapeadas: Maquina[] = maquinasList.map((m: any) => ({
        id: m.idMaquina ?? m.id,
        serial: m.serial ?? '',
        marca: m.marca ?? '',
        tipo: normalizarTipo(m.Tipo_Maquina),
        clienteId: m.idCliente ?? m.clienteId,
        clienteNombre: m.cliente?.razonSocial ?? m.clienteNombre ?? '',
        operadorId: m.idOperador ?? m.operadorId,
        operadorNombre: m.operador?.nombreCompleto ?? m.operador?.usuario?.nombre ?? m.operadorNombre ?? '',
        zona: m.ubicacionEsp ?? m.zona ?? '',
        estado: normalizarEstado(m.estado_operacion),
        espirales: m.espirales ?? genEspiralesVacio(),
        botonesNRQ: m.botonesNRQ ?? genBotonesVacio(),
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
    setOpen(false)
  }

  const openEdit = (m: Maquina) => {
    setEditing(m)
    setEspirales(m.espirales ? [...m.espirales] : [])
    setBotones(m.botonesNRQ ? [...m.botonesNRQ] : [])
    setOpen(true)
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
        Tipo_Maquina: values.tipo,
        idCliente: values.clienteId,
        idOperador: values.operadorId,
        ubicacionEsp: values.zona,
        estado_operacion: values.estado || 'OPERANDO',
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
      cantidad_inicial: 0,
      capacidad_max: 15,
    })
    setOpenEspModal(true)
  }

  const openEditEspiral = (idx: number) => {
    const esp = espirales[idx]
    setEditEspIdx(idx)
    formEsp.setFieldsValue({
      espiral: esp.espiral,
      productoId: esp.productoId,
      cantidad_inicial: esp.cantidad_inicial,
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

      if (editEspIdx === null) {
        const newId = Math.max(0, ...espirales.map((e) => e.id), 0) + 1
        const nuevo: Espiral = {
          id: newId,
          espiral: String(values.espiral).trim().toUpperCase(),
          capacidad_max: Number(values.capacidad_max),
          cantidad_inicial: Number(values.cantidad_inicial ?? 0),
          cantidad_actual: Number(values.cantidad_actual ?? values.cantidad_inicial ?? 0),
          productoId: values.productoId,
          productoNombre: prodName,
        }
        setEspirales([...espirales, nuevo])
        message.success(`Espiral ${nuevo.espiral} agregada`)
      } else {
        const ns = [...espirales]
        const original = ns[editEspIdx]
        ns[editEspIdx] = {
          ...original,
          espiral: String(values.espiral).trim().toUpperCase(),
          capacidad_max: Number(values.capacidad_max),
          cantidad_inicial: Number(values.cantidad_inicial ?? 0),
          cantidad_actual: Number(values.cantidad_actual ?? 0),
          productoId: values.productoId,
          productoNombre: prodName,
        }
        setEspirales(ns)
        message.success(`Espiral ${ns[editEspIdx].espiral} actualizada`)
      }
      closeEspModal()
    } catch {}
  }

  const deleteEspiral = (idx: number) => {
    const ns = [...espirales]
    const removed = ns.splice(idx, 1)[0]
    setEspirales(ns)
    message.success(`Espiral ${removed.espiral} eliminada`)
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

      if (editBtnIdx === null) {
        const newId = Math.max(0, ...botones.map((b) => b.id), 0) + 1
        const nuevo: BotonNRQ = {
          id: newId,
          boton: String(values.boton).trim().toUpperCase(),
          productoId: values.productoId,
          productoNombre: prodName,
        }
        setBotones([...botones, nuevo])
        message.success(`Botón ${nuevo.boton} agregado`)
      } else {
        const ns = [...botones]
        ns[editBtnIdx] = {
          ...ns[editBtnIdx],
          boton: String(values.boton).trim().toUpperCase(),
          productoId: values.productoId,
          productoNombre: prodName,
        }
        setBotones(ns)
        message.success(`Botón ${ns[editBtnIdx].boton} actualizado`)
      }
      closeBtnModal()
    } catch {}
  }

  const deleteBoton = (idx: number) => {
    const ns = [...botones]
    const removed = ns.splice(idx, 1)[0]
    setBotones(ns)
    message.success(`Botón ${removed.boton} eliminado`)
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
            ...(editing?.tipo === 'CAFE'
              ? [
                  {
                    key: 'NRQ',
                    label: `🔘 Mapa NRQ (Botones Café) ${totalBotones > 0 ? `· ${totalBotones}` : ''}`,
                    children: (
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
                    ),
                  },
                ]
              : [
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
                              title: 'Cant. Inicial',
                              dataIndex: 'cantidad_inicial',
                              width: 110,
                              align: 'right',
                              render: (v: number) => <b>{v ?? 0}</b>,
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
                ]),
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
                label="Cantidad Inicial"
                name="cantidad_inicial"
                rules={[{ required: true, message: 'Digite cantidad inicial' }]}
                initialValue={0}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Capacidad Máxima"
                name="capacidad_max"
                rules={[{ required: true, message: 'Digite capacidad máxima' }]}
                initialValue={15}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            {editEspIdx !== null && (
              <Form.Item
                label="Capacidad Actual"
                name="cantidad_actual"
                rules={[{ required: true }]}
                initialValue={0}
                extra="Mostrará 0 cuando no exista stock actual. Puede editar el valor manualmente."
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
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
            <Form.Item label="Producto Dosificado" name="productoId">
              <Select allowClear placeholder="Seleccione el producto DOSIFICADO para este botón">
                {productos.map((p) => <Option key={p.idProducto ?? p.id} value={p.idProducto ?? p.id}>{p.nombreProducto ?? p.nombre}</Option>)}
              </Select>
            </Form.Item>
          </Form>
        </Spin>
      </Drawer>
    </div>
  )
}

export default Maquinas
