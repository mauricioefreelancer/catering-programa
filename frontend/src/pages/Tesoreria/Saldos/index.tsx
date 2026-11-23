import { useState, useEffect, useCallback } from 'react'
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
  Spin,
  Alert,
  Input,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ModalDrawer from '../../../components/common/ModalDrawer'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAuth } from '../../../hooks/useAuth'
import { apiService } from '../../../api/services/api'

const { Title } = Typography
const { Option } = Select

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
  idVisita: number | null
  referencia: string | null
}

const Saldos = () => {
  const [data, setData] = useState<Saldo[]>([])
  const [maquinas, setMaquinas] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Saldo | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('tesoreria')
  const { usuario } = useAuth()

  const loadData = useCallback(async () => {
    setFetching(true)
    setError('')
    try {
      const [saldosRes, maquinasRes] = await Promise.all([
        apiService.get('/tesoreria/saldos-digitales'),
        apiService.get('/maquinas'),
      ])

      const saldosList: any[] = Array.isArray(saldosRes) ? saldosRes : []

      const maquinasList = Array.isArray(maquinasRes) ? maquinasRes : (maquinasRes?.data || [])

      const maquinasMapeadas = maquinasList.map((m: any) => ({
        id: m.idMaquina ?? m.id,
        serial: m.serial ?? '',
      }))

      const saldosMapeados: Saldo[] = saldosList.map((s: any) => ({
        id: s.idSaldo ?? s.id,
        maquinaId: s.idMaquina ?? s.maquinaId,
        maquinaSerial: s.maquina?.serial ?? s.maquinaSerial ?? (maquinasMapeadas.find((m) => m.id === (s.idMaquina ?? s.maquinaId))?.serial || ''),
        plataforma: s.plataforma ?? '',
        monto: Number(s.montoTransaccion ?? 0),
        fecha: s.fechaTransaccion ?? '',
        idVisita: s.idVisita ?? null,
        referencia: s.referencia ?? null,
      }))

      setMaquinas(maquinasMapeadas)
      setData(saldosMapeados)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No fue posible cargar los saldos digitales')
    } finally {
      setFetching(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const bodyApi = {
        idMaquina: values.maquinaId,
        plataforma: values.plataforma,
        montoTransaccion: values.monto,
        idVisita: values.idVisita ?? null,
        referencia: values.referencia?.trim() || null,
      }
      if (editing) {
        await apiService.patch(`/tesoreria/saldos-digitales/${editing.id}`, bodyApi)
      } else {
        await apiService.post('/tesoreria/saldos-digitales', {
          ...bodyApi,
          fechaTransaccion: `${dayjs(values.fecha).format('YYYY-MM-DD')}T00:00:00-05:00`,
          idUsuario: usuario?.idUsuario ?? usuario?.id,
        })
      }
      message.success('Saldo guardado')
      setOpen(false)
      setEditing(null)
      await loadData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar saldo')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiService.remove(`/tesoreria/saldos-digitales/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Saldo eliminado')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al eliminar saldo')
    }
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
      sorter: (a: Saldo, b: Saldo) => a.monto - b.monto,
    },
    { title: 'Fecha', dataIndex: 'fecha', key: 'f', render: (v: string) => v ? new Date(v).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '' },
    { title: 'Referencia', dataIndex: 'referencia' },
    { title: 'Visita', dataIndex: 'idVisita', render: (id: number | null) => id == null ? 'Sin vincular' : `#${id}` },
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
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>Recargar</Button>
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
      {error && <Alert type="error" showIcon message={error} />}
      <Spin spinning={initialLoading}>
        <Table rowKey="id" dataSource={data} columns={columns} pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} registros` }} />
      </Spin>
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
            {maquinas.map((m) => <Option key={m.id} value={m.id}>{m.serial}</Option>)}
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
        <Form.Item name="referencia" label="Referencia de la transacción">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="idVisita" label="Número de visita" extra="Opcional. Debe pertenecer a la máquina seleccionada.">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        {!editing && <Form.Item name="fecha" label="Fecha de la transacción" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>}
      </ModalDrawer>
    </div>
  )
}

export default Saldos
