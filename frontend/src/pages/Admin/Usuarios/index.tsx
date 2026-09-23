import { useState, useEffect, useCallback } from 'react'
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
  Switch,
  Checkbox,
  Select,
  Alert,
  Tabs,
  Spin,
  Modal,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined, UserSwitchOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons'
import ModalDrawer from '../../../components/common/ModalDrawer'
import { usePermissions } from '../../../hooks/usePermissions'
import { Permisos } from '../../../store/auth.store'
import { get, post, patch, remove } from '../../../api/services/api'

const { Title } = Typography
const { Option } = Select

const MODULOS = ['dashboard', 'clientes', 'proveedores', 'productos', 'precios', 'maquinas', 'operadores', 'inventario', 'despachos', 'tesoreria', 'admin']
const MOD_LABELS: Record<string, string> = {
  dashboard: '📊 Dashboard', clientes: '👥 Clientes', proveedores: '🏭 Proveedores',
  productos: '📦 Productos', precios: '💰 Precios', maquinas: '🖥️ Máquinas',
  operadores: '👷 Operadores', inventario: '📥 Inventario', despachos: '📤 Despachos',
  tesoreria: '💵 Tesorería', admin: '⚙️ Administración',
}
const ACCIONES = ['ver', 'crear', 'editar', 'eliminar']
const ACC_LABELS: Record<string, string> = { ver: '👁️ Ver', crear: '➕ Crear', editar: '✏️ Editar', eliminar: '🗑️ Eliminar' }

interface RolDto {
  idRol: number
  nombreRol: string
}

interface UsuarioRow {
  id: number
  nombre: string
  email: string
  usuario_login: string
  rolId: number
  rolNombre: string
  estado: 'ACTIVO' | 'INACTIVO'
  excepciones_permisos?: Permisos
  zonaAsignada?: string | null
  telefono?: string | null
  operadorId?: number | null
  esOperador?: boolean
}

const todoFalse = () => ({ ver: false, crear: false, editar: false, eliminar: false })
const emptyExc = (): Permisos => Object.fromEntries(MODULOS.map((m) => [m, { ...todoFalse() }]))

const Usuarios = () => {
  const [data, setData] = useState<UsuarioRow[]>([])
  const [rolList, setRolList] = useState<RolDto[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioRow | null>(null)
  const [useExc, setUseExc] = useState(false)
  const [exc, setExc] = useState<Permisos>(emptyExc())
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [openVinculo, setOpenVinculo] = useState<{ idUsuario: number; nombre: string; login: string } | null>(null)
  const [loadingVinculo, setLoadingVinculo] = useState(false)
  const perm = usePermissions('admin')

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        get<{ data: any[]; total: number }>('/admin/usuarios', { skip: 0, take: 200 }),
        get<{ data: RolDto[]; total: number }>('/admin/roles', { skip: 0, take: 100 }),
      ])
      const rows: UsuarioRow[] = (usersRes.data || []).map((u: any) => ({
        id: Number(u.idUsuario || u.id) || 0,
        nombre: u.nombreCompleto || u.nombre || '',
        email: u.email || '',
        usuario_login: u.usuarioLogin || u.usuario_login || '',
        rolId: Number(u.idRol || u.rolId) || 0,
        rolNombre: u.rol?.nombreRol || u.rolNombre || '',
        estado: u.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        excepciones_permisos: u.excepcionesPermisos || u.excepciones_permisos || undefined,
        zonaAsignada: u.operador?.zonaAsignada || u.zonaAsignada || null,
        telefono: u.operador?.telefono || u.telefono || null,
        operadorId: u.operador?.idOperador ?? u.operadorId ?? null,
        esOperador: Number(u.idRol || u.rol?.idRol) === 4 || String(u.rol?.nombreRol || '').toUpperCase().includes('OPERADOR'),
      }))
      setData(rows)
      setRolList(rolesRes.data || [])
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al cargar usuarios')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = data.filter((u) => !search || (u.nombre + u.email + u.usuario_login + (u.zonaAsignada || '')).toLowerCase().includes(search.toLowerCase()))

  const reset = () => {
    setEditing(null)
    setUseExc(false)
    setExc(emptyExc())
    setOpen(false)
  }

  const toggleExc = (modulo: string, accion: string) => {
    const next = { ...exc }
    const m = { ...(next[modulo] || {}) }
    m[accion] = !m[accion]
    if (accion !== 'ver' && m[accion] && !m.ver) m.ver = true
    next[modulo] = m
    setExc(next)
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const rol = rolList.find((r) => r.idRol === values.rolId)
      const payload: any = {
        nombreCompleto: values.nombre,
        email: values.email,
        usuarioLogin: values.usuario_login,
        idRol: values.rolId,
        estado: values.estado ? 'ACTIVO' : 'INACTIVO',
        excepcionesPermisos: useExc ? exc : null,
      }
      if (values.password) payload.password = values.password
      let created: UsuarioRow | null = null
      if (editing) {
        const resp = await patch<any>(`/admin/usuarios/${editing.id}`, payload)
        created = {
          id: Number(resp.idUsuario || resp.id) || editing.id,
          nombre: resp.nombreCompleto || payload.nombreCompleto,
          email: resp.email || payload.email,
          usuario_login: resp.usuarioLogin || payload.usuarioLogin,
          rolId: resp.idRol || payload.idRol,
          rolNombre: resp.rol?.nombreRol || rol?.nombreRol || editing.rolNombre,
          estado: payload.estado,
          excepciones_permisos: resp.excepcionesPermisos || (useExc ? exc : undefined),
          zonaAsignada: editing.zonaAsignada,
          telefono: editing.telefono,
        }
        setData(data.map((r) => (r.id === editing.id ? { ...r, ...(created as UsuarioRow) } : r)))
        message.success('Usuario actualizado')
      } else {
        const resp = await post<any>('/admin/usuarios', payload)
        created = {
          id: Number(resp.idUsuario || resp.id) || 0,
          nombre: resp.nombreCompleto || payload.nombreCompleto,
          email: resp.email || payload.email,
          usuario_login: resp.usuarioLogin || payload.usuarioLogin,
          rolId: resp.idRol || payload.idRol,
          rolNombre: resp.rol?.nombreRol || rol?.nombreRol || '',
          estado: payload.estado,
          excepciones_permisos: resp.excepcionesPermisos || (useExc ? exc : undefined),
          zonaAsignada: resp.operador?.zonaAsignada || null,
          telefono: resp.operador?.telefono || null,
        }
        setData([created as UsuarioRow, ...data])
        message.success('Usuario creado')
      }
      reset()
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al guardar usuario')
    } finally {
      setLoading(false)
    }
  }
  const handleDelete = async (id: number) => {
    try {
      await remove(`/admin/usuarios/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Usuario eliminado')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al eliminar usuario')
    }
  }

  const handleSubmitVinculo = async (values: any) => {
    if (!openVinculo) return
    setLoadingVinculo(true)
    try {
      await post<any>('/operadores', {
        idUsuario: openVinculo.idUsuario,
        nombreCompleto: values.nombreV || openVinculo.nombre,
        telefono: values.telefonoV || null,
        zonaAsignada: values.zonaV,
        numeroDocumento: values.documentoV || null,
      })
      message.success('Operador vinculado exitosamente al usuario. Ahora aparece en Operadores.')
      setOpenVinculo(null)
      await loadData()
    } catch (e: any) {
      const m = e?.response?.data?.message
      const msg = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : String(e?.message || e || 'Error')
      message.error('Error vinculando operador: ' + msg)
    } finally {
      setLoadingVinculo(false)
    }
  }

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'n', render: (v: any) => <strong>{v}</strong> },
    { title: 'Email', dataIndex: 'email', key: 'e' },
    { title: 'Login', dataIndex: 'usuario_login', key: 'l', render: (v: any) => <Tag icon={<UserOutlined />} color="geekblue">{v}</Tag> },
    { title: 'Rol', dataIndex: 'rolNombre', key: 'r', render: (v: any) => <Tag color="purple">{v || '—'}</Tag> },
    { title: 'Zona Asignada', dataIndex: 'zonaAsignada', key: 'zona', render: (v: any) => v ? <Tag color="blue">{v}</Tag> : <span style={{color:'#bfbfbf'}}>—</span> },
    { title: 'Teléfono', dataIndex: 'telefono', key: 'tel', render: (v: any) => v || <span style={{color:'#bfbfbf'}}>—</span> },
    {
      title: 'Vinculación Operador',
      key: 'vinculo',
      render: (_: any, r: UsuarioRow) => {
        if (!r.esOperador) return <Tag style={{color:'#8c8c8c', background:'#fafafa'}}>No aplica (otro rol)</Tag>
        if (r.operadorId) return <Tag color="green" icon={<LinkOutlined />}>✅ Operador OK · #{r.operadorId}</Tag>
        return (
          <Space size={6}>
            <Tag color="orange" icon={<UserOutlined />}>⚠️ Huérfano (sin operador)</Tag>
            {perm.crear && (
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setOpenVinculo({ idUsuario: r.id, nombre: r.nombre, login: r.usuario_login })}
                style={{ padding: 0 }}
              >
                Crear vínculo
              </Button>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Excepciones',
      key: 'exc',
      render: (_: any, r: UsuarioRow) => r.excepciones_permisos ? <Tag color="gold">Permisos personalizados</Tag> : <Tag type="circle">Hereda del rol</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'st',
      render: (v: any) => <Tag color={v === 'ACTIVO' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: UsuarioRow) => (
        <Space>
          {perm.editar && <Button type="link" icon={<EditOutlined />} onClick={() => {
            setEditing(r)
            setUseExc(!!r.excepciones_permisos)
            setExc(r.excepciones_permisos || emptyExc())
            setOpen(true)
          }}>Editar</Button>}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar usuario?" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>Eliminar</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}><UserSwitchOutlined /> Administración de Usuarios</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar usuario, zona..." value={search} onChange={(e: any) => setSearch(e.target.value)} style={{ width: 280 }} />
          {perm.crear && <Button type="primary" icon={<PlusOutlined />} onClick={reset}>Nuevo Usuario</Button>}
        </Space>
      </div>

      {fetching ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="Cargando usuarios..." /></div>
      ) : (
        <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }} />
      )}

      <ModalDrawer
        title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}
        open={open} onClose={reset} onSubmit={handleSubmit}
        initialValues={editing ? {
          nombre: editing.nombre,
          email: editing.email,
          usuario_login: editing.usuario_login,
          rolId: editing.rolId,
          estado: editing.estado === 'ACTIVO',
        } : { estado: true }}
        loading={loading} width={780}
      >
        <Tabs
          items={[
            {
              key: 'GEN',
              label: '👤 Datos Generales',
              children: (
                <>
                  <Form.Item name="nombre" label="Nombre Completo" rules={[{ required: true }]}><Input /></Form.Item>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
                    <Form.Item name="usuario_login" label="Usuario de Login" rules={[{ required: true }]}><Input /></Form.Item>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Form.Item name="rolId" label="Rol" rules={[{ required: true }]}>
                      <Select placeholder="Seleccione rol">
                        {rolList.map((r) => <Option key={r.idRol} value={r.idRol}>{r.nombreRol}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="estado" label="Estado" valuePropName="checked">
                      <Switch checkedChildren="ACTIVO" unCheckedChildren="INACTIVO" />
                    </Form.Item>
                  </div>
                  {!editing && (
                    <Form.Item name="password" label="Contraseña Inicial" rules={[{ required: true, min: 6 }]}>
                      <Input.Password />
                    </Form.Item>
                  )}
                </>
              ),
            },
            {
              key: 'EXC',
              label: '🔐 Excepciones Permisos (opcional)',
              children: (
                <>
                  <Alert
                    type="warning"
                    showIcon
                    message="Permisos personalizados"
                    description={(
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <span>Activa la excepción para hacer un MERGE con los permisos del rol (sobrescribe acciones).</span>
                        <Switch checked={useExc} onChange={(v: any) => setUseExc(v)} checkedChildren="Usar Excepciones" unCheckedChildren="Solo Rol" />
                      </Space>
                    )}
                    style={{ marginBottom: 16 }}
                  />
                  {useExc && (
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr repeat(4, 1fr)',
                          background: '#fffbe6',
                          fontWeight: 'bold',
                          padding: '10px 12px',
                          borderBottom: '1px solid #ffe58f',
                        }}
                      >
                        <div>Módulo (excepción)</div>
                        {ACCIONES.map((a) => (
                          <div key={a} style={{ textAlign: 'center' }}>{ACC_LABELS[a]}</div>
                        ))}
                      </div>
                      {MODULOS.map((m) => {
                        const mod = exc[m] || todoFalse()
                        return (
                          <div
                            key={m}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2fr repeat(4, 1fr)',
                              padding: '8px 12px',
                              alignItems: 'center',
                              borderBottom: '1px solid #fafafa',
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{MOD_LABELS[m]}</div>
                            {ACCIONES.map((a) => (
                              <div key={a} style={{ textAlign: 'center' }}>
                                <Checkbox checked={!!mod[a]} onChange={() => toggleExc(m, a)} />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ),
            },
          ]}
        />
      </ModalDrawer>

      <Modal
        title={openVinculo ? `🔗 Crear Vínculo Operador (para ${openVinculo.nombre} · @${openVinculo.login})` : ''}
        open={!!openVinculo}
        onCancel={() => setOpenVinculo(null)}
        onOk={() => document.getElementById('__vinculo_form_submit_btn__')?.click?.()}
        confirmLoading={loadingVinculo}
        okText="Vincular"
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleSubmitVinculo} preserve={false}>
          <Alert
            type="info"
            showIcon
            message="Sincronizar este usuario Rol Operador"
            description="Este usuario tiene Rol Operador PERO NO tiene una ficha de Operador en la tabla Operadores. Completa los datos para crear el vínculo y que aparezca correctamente en el listado Operadores."
            style={{ marginBottom: 14 }}
          />
          <Form.Item label="Nombre Completo" name="nombreV" initialValue={openVinculo?.nombre} rules={[{ required: true }]}>
            <Input placeholder="Nombre completo del operador" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Número Documento" name="documentoV">
              <Input placeholder="C.C. / Cédula" />
            </Form.Item>
            <Form.Item label="Teléfono" name="telefonoV">
              <Input placeholder="Celular contacto" />
            </Form.Item>
          </div>
          <Form.Item label="Zona Asignada" name="zonaV" rules={[{ required: true }]}>
            <Select placeholder="Selecciona la zona">
              <Option value="Zona Norte">Zona Norte</Option>
              <Option value="Zona Sur">Zona Sur</Option>
              <Option value="Zona Centro">Zona Centro</Option>
              <Option value="Zona Occidente">Zona Occidente</Option>
              <Option value="Zona Oriente">Zona Oriente</Option>
              <Option value="Sin asignar">Sin asignar</Option>
            </Select>
          </Form.Item>
          <button id="__vinculo_form_submit_btn__" type="submit" style={{ display: 'none' }} />
        </Form>
      </Modal>
    </div>
  )
}

export default Usuarios
