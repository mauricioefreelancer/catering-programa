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
  InputNumber,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'

const { Title } = Typography
const { Option } = Select

interface Proveedor {
  id: number
  nit: string
  razon_social: string
  asesor: string
  condiciones_pago: 'CONTADO' | 'CREDITO'
  dias_credito?: number
  banco?: string
  cuenta_bancaria?: string
  estado: 'ACTIVO' | 'INACTIVO'
}

const initialData: Proveedor[] = [
  { id: 1, nit: '890.123.456-7', razon_social: 'Distribuidora de Alimentos', asesor: 'Juan Diaz', condiciones_pago: 'CREDITO', dias_credito: 30, banco: 'Bancolombia', cuenta_bancaria: '0123456789', estado: 'ACTIVO' },
  { id: 2, nit: '901.456.789-0', razon_social: 'Bebidas Nacionales', asesor: 'Sofia Lopez', condiciones_pago: 'CONTADO', banco: 'Davivienda', cuenta_bancaria: '9876543210', estado: 'ACTIVO' },
  { id: 3, nit: '860.789.012-2', razon_social: 'Snacks y Confiteria', asesor: 'Pedro Ruiz', condiciones_pago: 'CREDITO', dias_credito: 15, banco: 'Bogota', cuenta_bancaria: '4567890123', estado: 'ACTIVO' },
]

const Proveedores = () => {
  const [data, setData] = useState<Proveedor[]>(initialData)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [loading, setLoading] = useState(false)
  const [condPago, setCondPago] = useState<string>('CONTADO')
  const perm = usePermissions('proveedores')

  const filtered = useMemo(() => {
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter((c) => {
      return (
        c.razon_social.toLowerCase().includes(s) ||
        c.nit.toLowerCase().includes(s) ||
        c.asesor.toLowerCase().includes(s)
      )
    })
  }, [data, search])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      if (editing) {
        const next = data.map((c) => {
          return c.id === editing.id ? { ...c, ...values } : c
        })
        setData(next)
        message.success('Proveedor actualizado')
      } else {
        const newId = Math.max(0, ...data.map((d) => d.id)) + 1
        setData([...data, { id: newId, estado: 'ACTIVO', ...values }])
        message.success('Proveedor creado')
      }
      setOpen(false)
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: number) => {
    setData(data.filter((c) => c.id !== id))
    message.success('Proveedor eliminado')
  }

  const columns = [
    { title: 'NIT', dataIndex: 'nit', key: 'nit' },
    { title: 'Razon Social', dataIndex: 'razon_social', key: 'razon_social', render: (v: string) => <strong>{v}</strong> },
    { title: 'Asesor', dataIndex: 'asesor', key: 'asesor' },
    {
      title: 'Cond. Pago',
      dataIndex: 'condiciones_pago',
      key: 'condiciones_pago',
      render: (v: string, r: Proveedor) => {
        return (
          <Space>
            <Tag color={v === 'CONTADO' ? 'blue' : 'orange'}>{v}</Tag>
            {r.dias_credito && (
              <span style={{ fontSize: 12, color: '#666' }}>{r.dias_credito} dias</span>
            )}
          </Space>
        )
      },
    },
    { title: 'Banco', dataIndex: 'banco', key: 'banco' },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (v: string) => <Tag color={v === 'ACTIVO' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Proveedor) => {
        return (
          <Space>
            {perm.editar && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(r)
                  setCondPago(r.condiciones_pago)
                  setOpen(true)
                }}
              >
                Editar
              </Button>
            )}
            {perm.eliminar && (
              <Popconfirm title="Eliminar proveedor?" onConfirm={() => handleDelete(r.id)} okText="Si" cancelText="No">
                <Button type="link" danger icon={<DeleteOutlined />}>
                  Eliminar
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Proveedores
        </Title>
        <Space>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          {perm.crear && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null)
                setCondPago('CONTADO')
                setOpen(true)
              }}
            >
              Nuevo Proveedor
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} proveedores` }}
        scroll={{ x: 1000 }}
      />

      <ModalDrawer
        title={editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={editing || undefined}
        loading={loading}
      >
        <Form.Item name="nit" label="NIT" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="razon_social" label="Razon Social" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="asesor" label="Asesor Comercial" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="condiciones_pago"
            label="Condiciones Pago"
            rules={[{ required: true }]}
            initialValue="CONTADO"
          >
            <Select
              onChange={(v) => {
                setCondPago(v)
              }}
            >
              <Option value="CONTADO">CONTADO</Option>
              <Option value="CREDITO">CREDITO</Option>
            </Select>
          </Form.Item>
          {condPago === 'CREDITO' && (
            <Form.Item name="dias_credito" label="Dias Credito" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          )}
        </div>
        <Form.Item label="Datos Bancarios" style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="banco" noStyle>
              <Input placeholder="Banco" />
            </Form.Item>
            <Form.Item name="cuenta_bancaria" noStyle>
              <Input placeholder="N° Cuenta" />
            </Form.Item>
          </div>
        </Form.Item>
      </ModalDrawer>
    </div>
  )
}

export default Proveedores
