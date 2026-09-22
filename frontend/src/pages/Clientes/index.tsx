import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'
import { get, post, patch, remove } from '../../api/services/api'

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

const Clientes = () => {
  const [data, setData] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const perm = usePermissions('clientes')

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const res = await get<any>('/clientes', { skip: 0, take: 200 })
      const rows = (res.data || []).map((c: any) => ({
        id: Number(c.idCliente || c.id) || 0,
        nit: c.nit || '',
        razon_social: c.razonSocial || c.razon_social || '',
        contacto: c.contactoNombre || c.contacto || '',
        telefono: c.telefono || '',
        ciudad: c.ciudad || '',
        fecha_contrato: c.fechaContrato || c.fecha_contrato || '',
        estado: c.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      }))
      setData(rows)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al cargar clientes')
    } finally {
      setFetching(false)
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
        c.razon_social.toLowerCase().includes(s) ||
        c.nit.toLowerCase().includes(s) ||
        c.contacto.toLowerCase().includes(s) ||
        c.ciudad.toLowerCase().includes(s)
    )
  }, [data, search])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const payload = {
        nit: values.nit,
        razonSocial: values.razon_social,
        contactoNombre: values.contacto,
        telefono: values.telefono,
        ciudad: values.ciudad,
        fechaContrato: values.fecha_contrato,
        estado: 'ACTIVO',
      }
      if (editing) {
        const resp = await patch<any>(`/clientes/${editing.id}`, payload)
        const nr: Cliente = {
          id: Number(resp.idCliente || editing.id) || editing.id,
          nit: resp.nit || payload.nit,
          razon_social: resp.razonSocial || payload.razonSocial,
          contacto: resp.contactoNombre || payload.contactoNombre,
          telefono: resp.telefono || payload.telefono,
          ciudad: resp.ciudad || payload.ciudad,
          fecha_contrato: resp.fechaContrato || payload.fechaContrato,
          estado: resp.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        }
        setData(data.map((c) => (c.id === editing.id ? { ...c, ...nr } : c)))
        message.success('Cliente actualizado')
      } else {
        const resp = await post<any>('/clientes', payload)
        const nr: Cliente = {
          id: Number(resp.idCliente) || 0,
          nit: resp.nit || payload.nit,
          razon_social: resp.razonSocial || payload.razonSocial,
          contacto: resp.contactoNombre || payload.contactoNombre,
          telefono: resp.telefono || payload.telefono,
          ciudad: resp.ciudad || payload.ciudad,
          fecha_contrato: resp.fechaContrato || payload.fechaContrato,
          estado: resp.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        }
        setData([nr, ...data])
        message.success('Cliente creado')
      }
      setOpen(false)
      setEditing(null)
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al guardar cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await remove(`/clientes/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Cliente eliminado')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al eliminar cliente')
    }
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
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
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

      {fetching ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="Cargando clientes..." /></div>
      ) : (
        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t: any) => `Total ${t} clientes` }}
          scroll={{ x: 1000 }}
        />
      )}

      <ModalDrawer
        title={editing ? 'Editar Cliente' : 'Nuevo Cliente'}
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={editing ? {
          nit: editing.nit,
          razon_social: editing.razon_social,
          contacto: editing.contacto,
          telefono: editing.telefono,
          ciudad: editing.ciudad,
          fecha_contrato: editing.fecha_contrato,
        } : undefined}
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
