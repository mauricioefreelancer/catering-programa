import { useState, useMemo } from 'react'
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
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'

const { Title } = Typography
const { Option } = Select

interface Operador {
  id: number
  documento: string
  nombre: string
  telefono: string
  email: string
  usuario_login: string
  zona: string
  estado: 'ACTIVO' | 'INACTIVO'
}

const initialData: Operador[] = [
  { id: 1, documento: '12345678', nombre: 'Andrés Felipe Herrera', telefono: '3101112222', email: 'andres@catering.com', usuario_login: 'aherrera', zona: 'Zona Norte', estado: 'ACTIVO' },
  { id: 2, documento: '23456789', nombre: 'Laura Valentina Rojas', telefono: '3112223333', email: 'laura@catering.com', usuario_login: 'lrojas', zona: 'Zona Sur', estado: 'ACTIVO' },
  { id: 3, documento: '34567890', nombre: 'Camilo Andrés Mora', telefono: '3153334444', email: 'camilo@catering.com', usuario_login: 'cmora', zona: 'Zona Centro', estado: 'ACTIVO' },
]

const Operadores = () => {
  const [data, setData] = useState<Operador[]>(initialData)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Operador | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('operadores')

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

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      if (editing) {
        setData(data.map((c) => (c.id === editing.id ? { ...c, ...values } : c)))
        message.success('Operador actualizado (y usuario vinculado)')
      } else {
        const newId = Math.max(0, ...data.map((d) => d.id)) + 1
        setData([...data, { id: newId, estado: 'ACTIVO', ...values }])
        message.success('Operador y usuario creados exitosamente')
      }
      setOpen(false)
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    setData(data.filter((c) => c.id !== id))
    message.success('Operador eliminado')
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
          <Input allowClear prefix={<SearchOutlined />} placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320 }} />
          {perm.crear && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true) }}>
              Nuevo Operador
            </Button>
          )}
        </Space>
      </div>
      <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} operadores` }} scroll={{ x: 1000 }} />
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
