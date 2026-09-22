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
  Divider,
  Alert,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import ModalDrawer from '../../../components/common/ModalDrawer'
import { usePermissions } from '../../../hooks/usePermissions'
import { Permisos } from '../../../store/auth.store'
import { get } from '../../../api/services/api'

const { Title } = Typography

const MODULOS = [
  { key: 'dashboard', label: '📊 Dashboard', icon: <SettingOutlined /> },
  { key: 'clientes', label: '👥 Clientes' },
  { key: 'proveedores', label: '🏭 Proveedores' },
  { key: 'productos', label: '📦 Productos' },
  { key: 'precios', label: '💰 Precios' },
  { key: 'maquinas', label: '🖥️ Máquinas' },
  { key: 'operadores', label: '👷 Operadores' },
  { key: 'inventario', label: '📥 Inventario / Ingresos' },
  { key: 'despachos', label: '📤 Despachos' },
  { key: 'tesoreria', label: '💵 Tesorería' },
  { key: 'admin', label: '⚙️ Administración' },
]

const ACCIONES = ['ver', 'crear', 'editar', 'eliminar']
const ACC_LABELS: Record<string, string> = { ver: '👁️ Ver', crear: '➕ Crear', editar: '✏️ Editar', eliminar: '🗑️ Eliminar' }

interface Rol {
  id: number
  nombre: string
  estado: 'ACTIVO' | 'INACTIVO'
  permisos: Permisos
}

const todoFalse = (): { ver: boolean; crear: boolean; editar: boolean; eliminar: boolean } => ({
  ver: false,
  crear: false,
  editar: false,
  eliminar: false,
})

const fullPermisos = (): Permisos => {
  const p: Permisos = {}
  MODULOS.forEach((m) => (p[m.key] = { ...todoFalse() }))
  return p
}

const initialData: Rol[] = [
  {
    id: 1,
    nombre: 'GERENCIA',
    estado: 'ACTIVO',
    permisos: Object.fromEntries(MODULOS.map((m) => [m.key, { ver: true, crear: true, editar: true, eliminar: true }])),
  },
  {
    id: 2,
    nombre: 'ADMIN BODEGA',
    estado: 'ACTIVO',
    permisos: {
      ...fullPermisos(),
      dashboard: { ver: true, crear: false, editar: false, eliminar: false },
      clientes: { ver: true, crear: true, editar: true, eliminar: false },
      proveedores: { ver: true, crear: true, editar: true, eliminar: false },
      productos: { ver: true, crear: true, editar: true, eliminar: true },
      maquinas: { ver: true, crear: false, editar: true, eliminar: false },
      operadores: { ver: true, crear: false, editar: false, eliminar: false },
      inventario: { ver: true, crear: true, editar: true, eliminar: true },
      despachos: { ver: true, crear: true, editar: true, eliminar: false },
    },
  },
  {
    id: 3,
    nombre: 'TESORERO',
    estado: 'ACTIVO',
    permisos: {
      ...fullPermisos(),
      dashboard: { ver: true },
      clientes: { ver: true },
      tesoreria: { ver: true, crear: true, editar: true, eliminar: true },
      maquinas: { ver: true },
    },
  },
]

const Roles = () => {
  const [data, setData] = useState<Rol[]>(initialData)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Rol | null>(null)
  const [permisosForm, setPermisosForm] = useState<Permisos>(fullPermisos())
  const [loading, setLoading] = useState(false)
  const [endpointNoImplementado, setEndpointNoImplementado] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)
  const perm = usePermissions('admin')

  const loadData = useCallback(async () => {
    setLoadingTable(true)
    try {
      const resp: any = await get('/admin/roles')
      const raw = resp?.data || []
      if (Array.isArray(raw) && raw.length > 0) {
        const mapped: Rol[] = raw.map((r: any) => {
          let permisosParsed: Permisos = fullPermisos()
          try {
            if (r.permisos) {
              permisosParsed = typeof r.permisos === 'string' ? JSON.parse(r.permisos) : r.permisos
            }
          } catch { permisosParsed = fullPermisos() }
          return {
            id: Number(r.idRol ?? r.id),
            nombre: r.nombreRol || r.nombre || '',
            estado: (r.estado || 'ACTIVO') as 'ACTIVO' | 'INACTIVO',
            permisos: permisosParsed,
          }
        })
        setData(mapped)
      } else {
        setData(initialData)
      }
      setEndpointNoImplementado(false)
    } catch (e: any) {
      setEndpointNoImplementado(true)
      setData(initialData)
    } finally {
      setLoadingTable(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const reset = () => {
    setEditing(null)
    setPermisosForm(fullPermisos())
    setOpen(false)
  }

  const toggleAccion = (modulo: string, accion: string) => {
    const next = { ...permisosForm }
    const modNext = { ...(next[modulo] || {}) }
    modNext[accion] = !modNext[accion]
    if (accion !== 'ver' && modNext[accion] && !modNext.ver) modNext.ver = true
    if (accion === 'ver' && !modNext.ver) {
      ACCIONES.forEach((a) => (modNext[a] = false))
    }
    next[modulo] = modNext
    setPermisosForm(next)
  }
  const setAllModulo = (modulo: string, val: boolean) => {
    const next = { ...permisosForm }
    const mod: any = {}
    ACCIONES.forEach((a) => (mod[a] = val))
    next[modulo] = mod
    setPermisosForm(next)
  }
  const setTodoGlobal = (val: boolean) => {
    const next: Permisos = {}
    MODULOS.forEach((m) => {
      const mod: any = {}
      ACCIONES.forEach((a) => (mod[a] = val))
      next[m.key] = mod
    })
    setPermisosForm(next)
  }

  const openEdit = (r: Rol) => {
    setEditing(r)
    setPermisosForm({ ...fullPermisos(), ...r.permisos })
    setOpen(true)
  }
  const openCreate = () => {
    setEditing(null)
    setPermisosForm(fullPermisos())
    setOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const payload: Rol = {
        id: editing?.id || Math.max(0, ...data.map((d) => d.id)) + 1,
        nombre: values.nombre.toUpperCase(),
        estado: values.estado ? 'ACTIVO' : 'INACTIVO',
        permisos: permisosForm,
      }
      if (editing) {
        setData(data.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)))
        message.success('Rol actualizado')
      } else {
        setData([...data, payload])
        message.success('Rol creado')
      }
      reset()
    } finally {
      setLoading(false)
    }
  }
  const handleDelete = (id: number) => {
    setData(data.filter((c) => c.id !== id))
    message.success('Rol eliminado')
  }

  const contarPermisos = (p: Permisos) => {
    let total = 0
    for (const k of Object.keys(p)) {
      for (const a of ACCIONES) if (p[k]?.[a]) total++
    }
    return total
  }

  const columns = [
    { title: 'Nombre Rol', dataIndex: 'nombre', key: 'n', render: (v: string) => <Tag color="geekblue" style={{ fontSize: 14, padding: '4px 12px' }} icon={<SafetyOutlined />}>{v}</Tag> },
    {
      title: 'Permisos',
      dataIndex: 'permisos',
      key: 'p',
      render: (v: Permisos) => {
        const c = contarPermisos(v)
        const max = MODULOS.length * ACCIONES.length
        return <Tag color={c > max * 0.7 ? 'green' : c > max * 0.35 ? 'blue' : 'orange'}>{c}/{max} permisos</Tag>
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'e',
      render: (_: any, r: Rol) => (
        <Tag color={r.estado === 'ACTIVO' ? 'green' : 'red'}>
          <Switch checked={r.estado === 'ACTIVO'} size="small" style={{ marginRight: 8 }} disabled />
          {r.estado}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Rol) => (
        <Space>
          {perm.editar && <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>Editar</Button>}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar rol?" onConfirm={() => handleDelete(r.id)}>
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
        <Title level={4} style={{ margin: 0 }}><SafetyOutlined /> Roles y Matriz de Permisos</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loadingTable}>Recargar</Button>
          {perm.crear && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Rol</Button>}
        </Space>
      </div>

      {endpointNoImplementado && (
        <Alert
          type="error"
          showIcon
          message="🛑 Endpoint /admin/roles NO implementado en Backend"
          description="La lista de roles mostrada es provisional hardcodeada. Crear el endpoint en NestJS para persistencia real. Los cambios en el drawer se guardan solo localmente y se pierden al refrescar."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table rowKey="id" dataSource={data} columns={columns} pagination={{ pageSize: 8 }} />

      <ModalDrawer
        title={editing ? `Editar Rol: ${editing.nombre}` : 'Nuevo Rol'}
        open={open} onClose={reset} onSubmit={handleSubmit}
        initialValues={editing ? { nombre: editing.nombre, estado: editing.estado === 'ACTIVO' } : { estado: true }}
        loading={loading} width={860}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Form.Item name="nombre" label="Nombre del Rol" rules={[{ required: true }]}>
            <Input placeholder="Ej: SUPERVISOR ZONA NORTE" />
          </Form.Item>
          <Form.Item name="estado" label="Estado" valuePropName="checked">
            <Switch checkedChildren="ACTIVO" unCheckedChildren="INACTIVO" />
          </Form.Item>
        </div>
        <Divider>🔐 Matriz de Permisos</Divider>
        <Alert
          type="info"
          showIcon
          message="Asignación masiva:"
          description={
            <Space>
              <Button size="small" type="primary" onClick={() => setTodoGlobal(true)}>Marcar Todo</Button>
              <Button size="small" danger onClick={() => setTodoGlobal(false)}>Desmarcar Todo</Button>
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr repeat(5, 1fr)',
              background: '#fafafa',
              fontWeight: 'bold',
              padding: '10px 12px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <div>Módulo</div>
            <div style={{ textAlign: 'center' }}>Todo / Nada</div>
            {ACCIONES.map((a) => (
              <div key={a} style={{ textAlign: 'center' }}>{ACC_LABELS[a]}</div>
            ))}
          </div>
          {MODULOS.map((m) => {
            const modPerm = permisosForm[m.key] || todoFalse()
            const allOn = ACCIONES.every((a) => modPerm[a])
            return (
              <div
                key={m.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr repeat(5, 1fr)',
                  padding: '8px 12px',
                  alignItems: 'center',
                  borderBottom: '1px solid #fafafa',
                }}
              >
                <div style={{ fontWeight: 500 }}>{m.label}</div>
                <div style={{ textAlign: 'center' }}>
                  <Switch checked={allOn} onChange={(v: any) => setAllModulo(m.key, v)} size="small" />
                </div>
                {ACCIONES.map((a) => (
                  <div key={a} style={{ textAlign: 'center' }}>
                    <Checkbox checked={!!modPerm[a]} onChange={() => toggleAccion(m.key, a)} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </ModalDrawer>
    </div>
  )
}

export default Roles
