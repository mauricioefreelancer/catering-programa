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
import { get, post, patch, remove } from '../../../api/services/api'

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

const SISTEMA_ROLES = ['desarrollador', 'bodega', 'tesorería', 'tesoreria', 'operador', 'megacuadro']

const Roles = () => {
  const [data, setData] = useState<Rol[]>([])
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
      const mapped: Rol[] = raw.map((r: any) => {
        let permisosParsed: Permisos = fullPermisos()
        try {
          if (r.permisosCrud) {
            permisosParsed = typeof r.permisosCrud === 'string' ? JSON.parse(r.permisosCrud) : r.permisosCrud
          } else if (r.permisos) {
            permisosParsed = typeof r.permisos === 'string' ? JSON.parse(r.permisos) : r.permisos
          }
        } catch { permisosParsed = fullPermisos() }
        return {
          id: Number(r.idRol ?? r.id),
          nombre: r.nombreRol || r.nombre || '',
          estado: (r.estado ?? true) ? 'ACTIVO' : 'INACTIVO',
          permisos: permisosParsed,
        }
      })
      setData(mapped)
      setEndpointNoImplementado(false)
    } catch (e: any) {
      setEndpointNoImplementado(true)
      setData([])
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
      const permisosCrud = permisosForm
      if (editing) {
        await patch<any>(`/admin/roles/${editing.id}`, {
          nombreRol: values.nombre.trim(),
          estado: values.estado ? true : false,
          permisosCrud,
        })
        message.success('Rol actualizado')
      } else {
        await post<any>('/admin/roles', {
          nombreRol: values.nombre.trim(),
          estado: values.estado ? true : false,
          permisosCrud,
        })
        message.success('Rol creado')
      }
      reset()
      await loadData()
    } catch (e: any) {
      const m = e?.response?.data?.message
      message.error(Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : String(e?.message || e || 'Error al guardar rol'))
    } finally {
      setLoading(false)
    }
  }
  const handleDelete = async (id: number) => {
    try {
      await remove(`/admin/roles/${id}`)
      message.success('Rol eliminado')
      await loadData()
    } catch (e: any) {
      const m = e?.response?.data?.message
      message.error(Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : String(e?.message || e || 'Error al eliminar rol'))
    }
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
      render: (_: any, r: Rol) => {
        const esSistema = SISTEMA_ROLES.includes(String(r.nombre || '').toLowerCase())
        if (esSistema) {
          return <Tag color="default">Sistema</Tag>
        }
        return (
          <Space>
            {perm.editar && <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>Editar</Button>}
            {perm.eliminar && (
              <Popconfirm title="¿Eliminar rol?" onConfirm={() => handleDelete(r.id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>Eliminar</Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
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
