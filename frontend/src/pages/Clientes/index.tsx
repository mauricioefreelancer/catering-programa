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
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'

const { Title } = Typography

interface Cliente {
  id: number
  nit: string
  razon_social: string
  contacto: string
  telefono: string
  ciudad: string
  fecha_contrato: string
  estado: 'ACTIVO' | 'INACTIVO'
}

const initialData: Cliente[] = [
  { id: 1, nit: '901.234.567-8', razon_social: 'Alimentos S.A.S.', contacto: 'Carlos Pérez', telefono: '3101234567', ciudad: 'Bogotá', fecha_contrato: '2024-01-15', estado: 'ACTIVO' },
  { id: 2, nit: '890.456.789-1', razon_social: 'Empresa de Servicios Ltda.', contacto: 'María Gómez', telefono: '3119876543', ciudad: 'Medellín', fecha_contrato: '2024-02-20', estado: 'ACTIVO' },
  { id: 3, nit: '900.789.012-3', razon_social: 'Industrias Alimenticias', contacto: 'Luis Torres', telefono: '3154567890', ciudad: 'Cali', fecha_contrato: '2023-11-10', estado: 'ACTIVO' },
  { id: 4, nit: '860.123.789-0', razon_social: 'Corporativo Nacional', contacto: 'Ana Rodríguez', telefono: '3207890123', ciudad: 'Barranquilla', fecha_contrato: '2024-05-01', estado: 'INACTIVO' },
]

const Clientes = () => {
  const [data, setData] = useState<Cliente[]>(initialData)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('clientes')

  const filtered = useMemo(() => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(s) ||
        c.nit.toLowerCase().includes(s) ||
        c.contacto.toLowerCase().includes(s) ||
        c.ciudad.toLowerCase().includes(s)
    )
  }, [data, search])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      if (editing) {
      setData(data.map((c) => (c.id === editing.id ? { ...c, ...values } : c)))
      message.success('Cliente actualizado')
      } else {
        const newId = Math.max(0, ...data.map((d) => d.id)) + 1
        setData([...data, { id: newId, estado: 'ACTIVO', ...values }])
        message.success('Cliente creado')
      }
      setOpen(false)
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    setData(data.filter((c) => c.id !== id))
    message.success('Cliente eliminado')
  }

  const columns = [
    { title: 'NIT', dataIndex: 'nit', key: 'nit' },
    { title: 'Razón Social', dataIndex: 'razon_social', key: 'razon_social', render: (v: string, _r: Cliente) => <strong>{v}</strong> },
    { title: 'Contacto', dataIndex: 'contacto', key: 'contacto' },
    { title: 'Teléfono', dataIndex: 'telefono', key: 'telefono' },
    { title: 'Ciudad', dataIndex: 'ciudad', key: 'ciudad' },
    { title: 'Fecha Contrato', dataIndex: 'fecha_contrato', key: 'fecha_contrato', render: (v: string, _t: any) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Estado', dataIndex: 'estado', key: 'estado', render: (v: string) => <Tag color={v === 'ACTIVO' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Cliente) => (
        <Space>
          {perm.editar && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r)
                setOpen(true)
              }}
            >
              Editar
            </Button>
          )}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar cliente?" onConfirm={() => handleDelete(r.id)} okText="Sí" cancelText="No">
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
        <Title level={4} style={{ margin: 0 }}>
          Clientes
        </Title>
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar NIT, razón social, contacto..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          {perm.crear && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              Nuevo Cliente
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t: any) => `Total ${t} clientes` }}
        scroll={{ x: 1000 }}
      />

      <ModalDrawer
        title={editing ? 'Editar Cliente' : 'Nuevo Cliente'}
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={editing || undefined}
        loading={loading}
      >
        <Form.Item name="nit" label="NIT" rules={[{ required: true, message: 'Ingrese NIT' }]}>
          <Input placeholder="901.234.567-8" />
        </Form.Item>
        <Form.Item name="razon_social" label="Razón Social" rules={[{ required: true }]}>
          <Input placeholder="Nombre empresa S.A.S." />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="contacto" label="Contacto" rules={[{ required: true }]}>
            <Input placeholder="Nombre contacto" />
          </Form.Item>
          <Form.Item name="telefono" label="Teléfono" rules={[{ required: true }]}>
            <Input placeholder="3101234567" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="ciudad" label="Ciudad" rules={[{ required: true }]}>
            <Input placeholder="Ciudad" />
          </Form.Item>
          <Form.Item name="fecha_contrato" label="Fecha Contrato" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
        </div>
      </ModalDrawer>
    </div>
  )
}

export default Clientes
