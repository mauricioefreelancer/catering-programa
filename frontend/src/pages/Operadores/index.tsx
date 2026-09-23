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
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'
import { get, post, patch, remove } from '../../api/services/api'

const { Title } = Typography
const { Option } = Select

interface Operador {
  id: number
  idOperador?: number | string
  documento: string
  nombre: string
  telefono: string
  email: string
  usuario_login: string
  zona: string
  estado: 'ACTIVO' | 'INACTIVO'
  idUsuario?: number | string
  usuario?: any
}

const msgError = (e: any): string => {
  const m = e?.response?.data?.message
  if (Array.isArray(m)) return m.join(' · ')
  if (typeof m === 'string' && m.length > 0) return m
  return String(e?.message || e || 'Error desconocido')
}

const Operadores = () => {
  const [data, setData] = useState<Operador[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Operador | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)
  const perm = usePermissions('operadores')

  const loadData = useCallback(async () => {
    setLoadingTable(true)
    try {
      const resp: any = await get('/operadores')
      const raw = resp?.data || []
      const mapped: Operador[] = raw.map((o: any) => ({
        id: Number(o.idOperador),
        idOperador: o.idOperador,
        documento: o.numeroDocumento || o.usuario?.numeroDocumento || o.documento || '',
        nombre: o.nombreCompleto || o.usuario?.nombreCompleto || '',
        telefono: o.telefono || '',
        email: o.email || o.usuario?.email || '',
        usuario_login: o.usuarioLogin || o.usuario?.usuarioLogin || '',
        zona: o.zonaAsignada || '',
        estado: (o.estado === false || o.usuario?.estado === false ? 'INACTIVO' : 'ACTIVO') as 'ACTIVO' | 'INACTIVO',
        idUsuario: o.usuario?.idUsuario || o.idUsuario,
        usuario: o.usuario,
      }))
      setData(mapped)
    } catch (e: any) {
      message.error('Error cargando operadores: ' + (e?.message || e))
    } finally {
      setLoadingTable(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter(
      (c) =>
        c.nombre.toLowerCase().includes(s) ||
        c.documento.toLowerCase().includes(s) ||
        c.usuario_login.toLowerCase().includes(s) ||
        c.zona.toLowerCase().includes(s)
    )
  }, [data, search])

  const obtenerRolOperadorId = async (): Promise<number | string | undefined> => {
    try {
      const resp: any = await get('/admin/roles')
      const roles = resp?.data || []
      const rolOp = roles.find((r: any) =>
        (r.nombreRol || r.nombre || '').toUpperCase().includes('OPERADOR')
      )
      return rolOp?.idRol || rolOp?.id
    } catch {
      return undefined
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      if (editing) {
        const idOperador = editing.idOperador || editing.id
        const payloadOperador = {
          numeroDocumento: values.documento,
          nombreCompleto: values.nombre,
          telefono: values.telefono,
          email: values.email,
          usuarioLogin: values.usuario_login,
          zonaAsignada: values.zona,
          estado: values.estado || editing.estado || 'ACTIVO',
        }
        try {
          await patch(`/operadores/${idOperador}`, payloadOperador)
        } catch (e: any) {
          message.error('Error actualizando operador: ' + msgError(e))
          return
        }

        const idUsuarioFk = editing.idUsuario || editing.usuario?.idUsuario
        if (idUsuarioFk) {
          try {
            const payloadUsuario = {
              nombreCompleto: values.nombre,
              email: values.email,
              usuarioLogin: values.usuario_login,
              estado: values.estado || editing.estado || 'ACTIVO',
            }
            await patch(`/admin/usuarios/${idUsuarioFk}`, payloadUsuario)
          } catch (errUsr: any) {
            message.warning('Operador actualizado, pero error actualizando usuario vinculado: ' + msgError(errUsr))
          }
        }
        message.success('Operador actualizado (y usuario vinculado)')
      } else {
        const idRolOperador = await obtenerRolOperadorId()
        let idUsuarioCreado: number | string | undefined
        try {
          const payloadUsuario: any = {
            nombreCompleto: values.nombre,
            email: values.email,
            usuarioLogin: values.usuario_login,
            estado: values.estado || 'ACTIVO',
            password: values.password,
          }
          if (idRolOperador) payloadUsuario.idRol = idRolOperador
          const respUsr: any = await post('/admin/usuarios', payloadUsuario)
          idUsuarioCreado = respUsr?.idUsuario ?? respUsr?.data?.idUsuario ?? respUsr?.id ?? respUsr?.data?.id
          if (!idUsuarioCreado) {
            throw new Error('Respuesta inválida creando usuario vinculado (faltaba idUsuario)')
          }
        } catch (e: any) {
          message.error('Error creando usuario vinculado: ' + msgError(e))
          return
        }

        try {
          const payloadOperador = {
            numeroDocumento: values.documento,
            nombreCompleto: values.nombre,
            telefono: values.telefono,
            email: values.email,
            usuarioLogin: values.usuario_login,
            zonaAsignada: values.zona,
            idUsuario: idUsuarioCreado,
          }
          const respOp: any = await post('/operadores', payloadOperador)
          const idOpOK = respOp?.operador?.idOperador ?? respOp?.idOperador ?? respOp?.data?.idOperador
          if (!idOpOK) {
            throw new Error('Respuesta inválida creando operador (faltaba idOperador)')
          }
          message.success('Operador y usuario creados exitosamente. Credenciales: email="' + values.email + '" ó usuario="' + values.usuario_login + '" con la clave elegida.')
        } catch (e: any) {
          message.error('Error creando operador (se intentará eliminar usuario huérfano vinculado): ' + msgError(e))
          if (idUsuarioCreado) {
            try {
              await remove(`/admin/usuarios/${idUsuarioCreado}`)
              message.warning('Usuario huérfano eliminado automáticamente para evitar bloqueos de email/usuario duplicados')
            } catch (errClean: any) {
              message.warning('No se pudo limpiar usuario huérfano (favor revisar Admin / Usuarios): ' + msgError(errClean))
            }
          }
          return
        }
      }
      setOpen(false)
      setEditing(null)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await remove(`/operadores/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Operador eliminado')
    } catch (e: any) {
      message.error('Error eliminando operador: ' + (e?.message || e))
    }
  }

  const columns = [
    { title: 'Documento', dataIndex: 'documento', key: 'documento' },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre', render: (v: string) => <strong>{v}</strong> },
    { title: 'Usuario', dataIndex: 'usuario_login', key: 'usuario_login', render: (v: string) => <Tag icon={<UserOutlined />}>{v}</Tag> },
    { title: 'Teléfono', dataIndex: 'telefono', key: 'telefono' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Zona', dataIndex: 'zona', key: 'zona', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Estado', dataIndex: 'estado', key: 'estado', render: (v: string) => <Tag color={v === 'ACTIVO' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Operador) => (
        <Space>
          {perm.editar && (
            <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(r); setOpen(true) }}>
              Editar
            </Button>
          )}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar operador?" onConfirm={() => handleDelete(r.id)} okText="Sí" cancelText="No">
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
        <Title level={4} style={{ margin: 0 }}>Operadores</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loadingTable}>Recargar</Button>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} />
          {perm.crear && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true) }}>
              Nuevo Operador
            </Button>
          )}
        </Space>
      </div>
      <Spin spinning={loadingTable}>
        <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} operadores` }} scroll={{ x: 1000 }} />
      </Spin>
      <ModalDrawer
        title={editing ? 'Editar Operador' : 'Nuevo Operador (crea usuario)'} open={open} onClose={() => { setOpen(false); setEditing(null) }}
        onSubmit={handleSubmit} initialValues={editing || undefined} loading={loading}
      >
        <Form.Item name="documento" label="Documento" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="nombre" label="Nombre Completo" rules={[{ required: true }]}><Input /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="telefono" label="Teléfono" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="zona" label="Zona" rules={[{ required: true }]}>
            <Select>
              <Option value="Zona Norte">Zona Norte</Option>
              <Option value="Zona Sur">Zona Sur</Option>
              <Option value="Zona Centro">Zona Centro</Option>
              <Option value="Zona Occidente">Zona Occidente</Option>
              <Option value="Zona Oriente">Zona Oriente</Option>
            </Select>
          </Form.Item>
        </div>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <div style={{ padding: 12, background: '#f0f5ff', borderRadius: 8, marginBottom: 12 }}>
          <strong>Usuario vinculado (se crea automáticamente)</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="usuario_login" label="Usuario Login" rules={[{ required: true }]}><Input /></Form.Item>
          {!editing && (
            <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          )}
        </div>
      </ModalDrawer>
    </div>
  )
}

export default Operadores
