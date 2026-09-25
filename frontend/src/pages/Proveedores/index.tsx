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
  Select,
  InputNumber,
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import ModalDrawer from '../../components/common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'
import { get, post, patch, remove } from '../../api/services/api'

const { Title } = Typography
const { Option } = Select

interface Proveedor {
  id: number
  nit: string
  razon_social: string
  asesor: string
  telefono_asesor: string
  correo_asesor: string
  condiciones_pago: 'CONTADO' | 'CREDITO'
  dias_credito?: number
  banco?: string
  tipo_cuenta?: string
  cuenta_bancaria?: string
  titular_cuenta?: string
  estado: 'ACTIVO' | 'INACTIVO'
}

const Proveedores = () => {
  const [data, setData] = useState<Proveedor[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [condPago, setCondPago] = useState<string>('CONTADO')
  const perm = usePermissions('proveedores')

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      const res = await get<any>('/proveedores', { skip: 0, take: 200 })
      const rows = (res.data || []).map((p: any) => ({
        id: Number(p.idProveedor || p.id) || 0,
        nit: p.nit || '',
        razon_social: p.razonSocial || p.razon_social || '',
        asesor: p.asesorNombre || p.asesor || '',
        telefono_asesor: p.asesorTelefono || p.telefono_asesor || p.telefono || '',
        correo_asesor: p.asesorCorreo || p.correo_asesor || p.email || '',
        condiciones_pago: (p.condicionPagoTipo || p.condicionesPago || p.condiciones_pago || 'CONTADO').toString().toUpperCase().includes('CRED') ? 'CREDITO' : 'CONTADO',
        dias_credito: Number(p.condicionPagoDias ?? p.diasCredito ?? p.dias_credito) || 0,
        banco: p.bancoNombre || p.banco || '',
        tipo_cuenta: p.bancoTipoCuenta || p.tipo_cuenta || '',
        cuenta_bancaria: p.bancoNumeroCuenta || p.cuentaBancaria || p.cuenta_bancaria || '',
        titular_cuenta: p.bancoTitular || p.titular_cuenta || p.titular || '',
        estado: p.estado === false || p.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      }))
      setData(rows)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Error al cargar proveedores')
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
    return data.filter((c) => {
      return (
        c.razon_social.toLowerCase().includes(s) ||
        c.nit.toLowerCase().includes(s) ||
        c.asesor.toLowerCase().includes(s) ||
        String(c.telefono_asesor || '').toLowerCase().includes(s) ||
        String(c.correo_asesor || '').toLowerCase().includes(s) ||
        String(c.banco || '').toLowerCase().includes(s) ||
        String(c.cuenta_bancaria || '').toLowerCase().includes(s)
      )
    })
  }, [data, search])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const payload: any = {
        nit: values.nit,
        razonSocial: values.razon_social,
        asesorNombre: values.asesor,
        asesorTelefono: values.telefono_asesor,
        asesorCorreo: values.correo_asesor,
        condicionPagoTipo: values.condiciones_pago,
        condicionPagoDias: Number(values.dias_credito || 0),
        bancoNombre: values.banco,
        bancoTipoCuenta: values.tipo_cuenta,
        bancoNumeroCuenta: values.cuenta_bancaria,
        bancoTitular: values.titular_cuenta,
      }
      // Estado: solo se forcea ACTIVO en la creacion. En edicion se respeta el
      // valor actual para no volver ACTIVO un proveedor que estaba INACTIVO.
      if (!editing) payload.estado = true
      if (editing) {
        await patch<any>(`/proveedores/${editing.id}`, payload)
        message.success('Proveedor actualizado')
      } else {
        await post<any>('/proveedores', payload)
        message.success('Proveedor creado')
      }
      setOpen(false)
      setEditing(null)
      await loadData()
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al guardar proveedor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await remove(`/proveedores/${id}`)
      await loadData()
      message.success('Proveedor eliminado')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Error al eliminar proveedor')
    }
  }

  const columns = [
    { title: 'NIT', dataIndex: 'nit', key: 'nit' },
    { title: 'Razon Social', dataIndex: 'razon_social', key: 'razon_social', render: (v: string) => <strong>{v}</strong> },
    { title: 'Asesor', dataIndex: 'asesor', key: 'asesor' },
    { title: 'Tel Asesor', dataIndex: 'telefono_asesor', key: 'tel_asesor' },
    { title: 'Correo Asesor', dataIndex: 'correo_asesor', key: 'correo_asesor', width: 220 },
    {
      title: 'Cond. Pago',
      dataIndex: 'condiciones_pago',
      key: 'condiciones_pago',
      render: (v: string, r: Proveedor) => {
        return (
          <Space>
            <Tag color={v === 'CONTADO' ? 'blue' : 'orange'}>{v}</Tag>
            {r.dias_credito && Number(r.dias_credito) > 0 && (
              <span style={{ fontSize: 12, color: '#666' }}>{r.dias_credito} dias</span>
            )}
          </Space>
        )
      },
    },
    { title: 'Banco', dataIndex: 'banco', key: 'banco' },
    { title: 'T. Cuenta', dataIndex: 'tipo_cuenta', key: 'tipo_cuenta', render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '-' },
    { title: 'N° Cuenta', dataIndex: 'cuenta_bancaria', key: 'cuenta_bancaria' },
    { title: 'Titular', dataIndex: 'titular_cuenta', key: 'titular_cuenta' },
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
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
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

      {fetching ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="Cargando proveedores..." /></div>
      ) : (
        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} proveedores` }}
          scroll={{ x: 1000 }}
        />
      )}

      <ModalDrawer
        title={editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={editing ? {
          nit: editing.nit,
          razon_social: editing.razon_social,
          asesor: editing.asesor,
          telefono_asesor: editing.telefono_asesor,
          correo_asesor: editing.correo_asesor,
          condiciones_pago: editing.condiciones_pago,
          dias_credito: editing.dias_credito,
          banco: editing.banco,
          tipo_cuenta: editing.tipo_cuenta,
          cuenta_bancaria: editing.cuenta_bancaria,
          titular_cuenta: editing.titular_cuenta,
        } : {
          condiciones_pago: 'CONTADO',
        }}
        loading={loading}
      >
        <Form.Item name="nit" label="NIT" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="razon_social" label="Razon Social" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="asesor" label="Asesor Comercial (Nombre)" rules={[{ required: true }]}>
            <Input placeholder="Nombre asesor" />
          </Form.Item>
          <Form.Item name="telefono_asesor" label="Teléfono Asesor">
            <Input placeholder="3101234567" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <Form.Item name="correo_asesor" label="Correo Asesor">
            <Input placeholder="asesor@proveedor.com" />
          </Form.Item>
        </div>
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
              <Input placeholder="Banco (Bancolombia, Davivienda, Nequi...)" />
            </Form.Item>
            <Form.Item name="tipo_cuenta" noStyle>
              <Select placeholder="Tipo Cta.">
                <Option value="AHORROS">AHORROS</Option>
                <Option value="CORRIENTE">CORRIENTE</Option>
                <Option value="NEQUI">NEQUI</Option>
                <Option value="DAVIPLATA">DAVIPLATA</Option>
                <Option value="OTRO">OTRO</Option>
              </Select>
            </Form.Item>
            <Form.Item name="cuenta_bancaria" noStyle>
              <Input placeholder="N° Cuenta (ej: 1234567890)" />
            </Form.Item>
            <Form.Item name="titular_cuenta" noStyle>
              <Input placeholder="Titular Cuenta (nombre como aparece en banco)" />
            </Form.Item>
          </div>
        </Form.Item>
      </ModalDrawer>
    </div>
  )
}

export default Proveedores
