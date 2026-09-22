import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Popconfirm,
  message,
  Tag,
  Typography,
  Form,
  Select,
  InputNumber,
  DatePicker,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ModalDrawer from '../../../components/common/ModalDrawer'
import { usePermissions } from '../../../hooks/usePermissions'

const { Title } = Typography
const { Option } = Select

const MAQUINAS = [
  { id: 1, serial: 'SNK-00123' },
  { id: 2, serial: 'CAF-00456' },
  { id: 3, serial: 'BEB-00789' },
]

const PLATAFORMAS = ['Veos', 'Datáfono', 'Nequi', 'Tarjeta', 'Bancolombia Transferencia']
const PLAT_COLORS: Record<string, string> = {
  Veos: 'blue',
  Datáfono: 'green',
  Nequi: 'magenta',
  Tarjeta: 'purple',
  'Bancolombia Transferencia': 'gold',
}

interface Saldo {
  id: number
  maquinaId: number
  maquinaSerial: string
  plataforma: string
  monto: number
  fecha: string
}

const initialData: Saldo[] = [
  { id: 1, maquinaId: 1, maquinaSerial: 'SNK-00123', plataforma: 'Veos', monto: 482500, fecha: '2024-08-15' },
  { id: 2, maquinaId: 1, maquinaSerial: 'SNK-00123', plataforma: 'Datáfono', monto: 125800, fecha: '2024-08-15' },
  { id: 3, maquinaId: 2, maquinaSerial: 'CAF-00456', plataforma: 'Nequi', monto: 289000, fecha: '2024-08-15' },
  { id: 4, maquinaId: 3, maquinaSerial: 'BEB-00789', plataforma: 'Tarjeta', monto: 96400, fecha: '2024-08-14' },
]

const Saldos = () => {
  const [data, setData] = useState<Saldo[]>(initialData)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Saldo | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('tesoreria')

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const maq = MAQUINAS.find((m) => m.id === values.maquinaId)
      const payload = {
        ...values,
        maquinaSerial: maq?.serial || '',
        fecha: values.fecha ? dayjs(values.fecha).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      }
      if (editing) {
        setData(data.map((c) => (c.id === editing.id ? { ...c, ...payload } : c)))
        message.success('Saldo actualizado')
      } else {
        const newId = Math.max(0, ...data.map((d) => d.id)) + 1
        setData([...data, { id: newId, ...payload }])
        message.success('Saldo plataforma creado')
      }
      setOpen(false)
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }
  const handleDelete = (id: number) => {
    setData(data.filter((c) => c.id !== id))
    message.success('Saldo eliminado')
  }

  const totalSaldo = data.reduce((s, i) => s + i.monto, 0)

  const columns = [
    { title: 'Máquina', dataIndex: 'maquinaSerial', key: 'm', render: (v: string) => <code>{v}</code> },
    {
      title: 'Plataforma',
      dataIndex: 'plataforma',
      key: 'p',
      render: (v: string) => <Tag color={PLAT_COLORS[v] || 'default'} icon={<DollarOutlined />}>{v}</Tag>,
    },
    {
      title: 'Monto',
      dataIndex: 'monto',
      key: 'mn',
      align: 'right' as const,
      render: (v: number) => <strong style={{ fontSize: 16 }}>$ {v.toLocaleString('es-CO')}</strong>,
      sorter: (a, b) => a.monto - b.monto,
    },
    { title: 'Fecha', dataIndex: 'fecha', key: 'f', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Acciones',
      key: 'acc',
      render: (_: any, r: Saldo) => (
        <Space>
          {perm.editar && (
            <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(r); setOpen(true) }}>
              Editar
            </Button>
          )}
          {perm.eliminar && (
            <Popconfirm title="¿Eliminar saldo?" onConfirm={() => handleDelete(r.id)}>
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
          <DollarOutlined /> Saldos por Plataforma / Máquina
          <Tag color="green" style={{ marginLeft: 8 }}>Total $ {totalSaldo.toLocaleString('es-CO')}</Tag>
        </Title>
        <Space>
          {perm.crear && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditing(null); setOpen(true) }}
            >
              Registrar Saldo
            </Button>
          )}
        </Space>
      </div>
      <Table rowKey="id" dataSource={data} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} registros` }} />
      <ModalDrawer
        title={editing ? 'Editar Saldo' : 'Nuevo Saldo Plataforma'}
        open={open}
        onClose={() => { setOpen(false); setEditing(null) }}
        onSubmit={handleSubmit}
        initialValues={editing ? { ...editing, fecha: dayjs(editing.fecha) } : { fecha: dayjs() }}
        loading={loading}
      >
        <Form.Item name="maquinaId" label="Máquina" rules={[{ required: true }]}>
          <Select>
            {MAQUINAS.map((m) => <Option key={m.id} value={m.id}>{m.serial}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="plataforma" label="Plataforma" rules={[{ required: true }]}>
          <Select>
            {PLATAFORMAS.map((p) => <Option key={p} value={p}>{p}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="monto" label="Monto" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} min={0} prefix="$" step={1000} />
        </Form.Item>
        <Form.Item name="fecha" label="Fecha Registro" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </ModalDrawer>
    </div>
  )
}

export default Saldos
