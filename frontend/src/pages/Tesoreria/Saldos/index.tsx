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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ModalDrawer from '../../../components/common/ModalDrawer'
import { usePermissions } from '../../../hooks/usePermissions'
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
}

const Saldos = () => {
  const [data, setData] = useState<Saldo[]>([])
  const [maquinas, setMaquinas] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [endpointNoImplementado, setEndpointNoImplementado] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Saldo | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('tesoreria')

  const loadData = useCallback(async () => {
    setFetching(true)
    setEndpointNoImplementado(false)
    try {
      const [saldosRes, maquinasRes] = await Promise.all([
        apiService.get('/tesoreria/saldos').catch((err) => ({ error: err, data: null })),
        apiService.get('/maquinas'),
      ])

      let saldosList: any[] = []
      if ((saldosRes as any).error) {
        const status = (saldosRes as any).error?.response?.status
        if (status === 404 || status === undefined) {
          setEndpointNoImplementado(true)
          saldosList = []
        }
      } else {
        const resData = saldosRes as any
        saldosList = Array.isArray(resData) ? resData : (resData?.data || [])
      }

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
        monto: s.monto ?? 0,
        fecha: s.fecha ?? '',
      }))

      setMaquinas(maquinasMapeadas)
      setData(saldosMapeados)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === undefined) {
        setEndpointNoImplementado(true)
        setData([])
      } else {
        message.error(err?.response?.data?.message || 'Error al cargar datos')
      }
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
      const maq = maquinas.find((m) => m.id === values.maquinaId)
      const fechaFormateada = values.fecha ? dayjs(values.fecha).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
      const payload = {
        ...values,
        maquinaSerial: maq?.serial || '',
        fecha: fechaFormateada,
      }
      const bodyApi = {
        idMaquina: values.maquinaId,
        plataforma: values.plataforma,
        monto: values.monto,
        fecha: fechaFormateada,
      }
      let endpointError = false
      try {
        if (editing) {
          await apiService.patch(`/tesoreria/saldos/${editing.id}`, bodyApi)
          setData(data.map((c) => (c.id === editing.id ? { ...c, ...payload } : c)))
          message.success('Saldo actualizado')
        } else {
          const res: any = await apiService.post('/tesoreria/saldos', bodyApi)
          const newId = res?.idSaldo ?? res?.id ?? Math.max(0, ...data.map((d) => d.id)) + 1
          setData([...data, { id: newId, ...payload }])
          message.success('Saldo plataforma creado')
        }
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 404 || status === undefined) {
          endpointError = true
          if (editing) {
            setData(data.map((c) => (c.id === editing.id ? { ...c, ...payload } : c)))
          } else {
            const newId = Math.max(0, ...data.map((d) => d.id)) + 1
            setData([...data, { id: newId, ...payload }])
          }
          message.warning('Endpoint no existe, cambios solo locales')
        } else {
          throw err
        }
      }
      if (!endpointError || !editing) {
        setOpen(false)
        setEditing(null)
      } else {
        setOpen(false)
        setEditing(null)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar saldo')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiService.remove(`/tesoreria/saldos/${id}`)
      setData(data.filter((c) => c.id !== id))
      message.success('Saldo eliminado')
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 || status === undefined) {
        setData(data.filter((c) => c.id !== id))
        message.success('Saldo eliminado (local)')
      } else {
        message.error(err?.response?.data?.message || 'Error al eliminar saldo')
      }
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
    { title: 'Fecha', dataIndex: 'fecha', key: 'f', render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '' },
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
      {endpointNoImplementado && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="🛑 Endpoint /tesoreria/saldos NO implementado. Lista se cargará vacía y cambios Drawer solo se guardan localmente hasta crear endpoint en backend."
        />
      )}
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
        <Form.Item name="fecha" label="Fecha Registro" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </ModalDrawer>
    </div>
  )
}

export default Saldos
