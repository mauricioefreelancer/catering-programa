import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Card,
  Button,
  InputNumber,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Space,
  Tag,
  Spin,
  Drawer,
  Descriptions,
} from 'antd'
import { WalletOutlined, CheckCircleOutlined, ReloadOutlined, EyeOutlined, WarningOutlined } from '@ant-design/icons'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAuth } from '../../../hooks/useAuth'
import { apiService } from '../../../api/services/api'

const { Title } = Typography

interface VisitaRecaudo {
  idGrupo: number
  idMaquina: number
  idOperador: number
  fechaVisita: string
  nrAnterior: number
  nrActual: number
  diferenciaNR: number
  estado: 'PENDIENTE' | 'CERRADO'
  idRecaudo: number | null
  maquina?: { serial?: string; ubicacionEsp?: string } | null
  operador?: { nombreCompleto?: string; zonaAsignada?: string } | null
}

const Efectivo = () => {
  const [visitas, setVisitas] = useState<VisitaRecaudo[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [soloPendientes, setSoloPendientes] = useState(true)
  const perm = usePermissions('tesoreria')
  const { usuario } = useAuth()

  // Drawer / cierre de recaudo
  const [selected, setSelected] = useState<VisitaRecaudo | null>(null)
  const [nrActual, setNrActual] = useState<number | null>(null)
  const [efectivoRecog, setEfectivoRecog] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const loadData = useCallback(async (soloPend?: boolean) => {
    setLoading(true)
    try {
      const res: any = await apiService.get<any>('/tesoreria/efectivo-nr/visitas', {
        soloPendientes: soloPend !== undefined ? soloPend : soloPendientes,
      }).catch(() => null)
      const lista: VisitaRecaudo[] =
        Array.isArray(res?.visitas) ? res.visitas : Array.isArray(res) ? res : []
      setVisitas(lista)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar visitas para recaudo')
      setVisitas([])
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [soloPendientes])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const abrirVisita = (v: VisitaRecaudo) => {
    setSelected(v)
    setNrActual(v.nrActual)
    setEfectivoRecog(null)
  }

  const cerrarRecaudo = async () => {
    if (!selected) return
    if (nrActual === null || nrActual < selected.nrAnterior) {
      message.error(`NR debe ser >= NR Anterior (${selected.nrAnterior})`)
      return
    }
    if (efectivoRecog === null || efectivoRecog < 0) {
      message.error('Ingrese el efectivo recogido por el operador')
      return
    }
    setGuardando(true)
    try {
      const body = {
        idGrupo: selected.idGrupo,
        idMaquina: selected.idMaquina,
        idOperador: selected.idOperador,
        idUsuario: usuario?.idUsuario,
        nrAnterior: selected.nrAnterior,
        nrActual,
        efectivoRecog,
      }
      const res: any = await apiService.post('/tesoreria/efectivo-nr', body)
      const idRecaudo = res?.id ?? res?.idRecaudo ?? res?.data?.idRecaudo ?? Math.floor(Math.random() * 10000)
      message.success(`✅ Recaudo #${idRecaudo} cerrado para la visita ${selected.idGrupo}`)
      setSelected(null)
      loadData(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cerrar recaudo')
    } finally {
      setGuardando(false)
    }
  }

  const diffColor = (v: number) => (v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#666')
  const diferenciaActual = selected && nrActual !== null ? nrActual - (selected.nrAnterior || 0) : 0

  const columns = [
    {
      title: 'Visita #',
      dataIndex: 'idGrupo',
      width: 100,
      fixed: 'left' as const,
      render: (v: number) => <strong style={{ fontSize: 14 }}>#{v}</strong>,
    },
    {
      title: 'Fecha',
      dataIndex: 'fechaVisita',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('es-CO'),
      sorter: (a: any, b: any) => new Date(a.fechaVisita).getTime() - new Date(b.fechaVisita).getTime(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Máquina',
      key: 'maquina',
      width: 210,
      render: (_: any, r: VisitaRecaudo) =>
        r.maquina ? (
          <Space direction="vertical" size={0}>
            <strong>{r.maquina.serial ?? `Máq #${r.idMaquina}`}</strong>
            {r.maquina.ubicacionEsp && <span style={{ color: '#888', fontSize: 12 }}>{r.maquina.ubicacionEsp}</span>}
          </Space>
        ) : (
          `Máq #${r.idMaquina}`
        ),
    },
    {
      title: 'Operador',
      key: 'operador',
      width: 190,
      render: (_: any, r: VisitaRecaudo) =>
        r.operador ? (
          <Space direction="vertical" size={0}>
            <strong>{r.operador.nombreCompleto ?? `Op #${r.idOperador}`}</strong>
            {r.operador.zonaAsignada && <Tag color="geekblue">{r.operador.zonaAsignada}</Tag>}
          </Space>
        ) : (
          `Operador #${r.idOperador}`
        ),
    },
    {
      title: 'NR Anterior',
      dataIndex: 'nrAnterior',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="default">{v.toLocaleString('es-CO')}</Tag>,
    },
    {
      title: 'NR Digitado',
      dataIndex: 'nrActual',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue" style={{ fontWeight: 600 }}>{v.toLocaleString('es-CO')}</Tag>,
    },
    {
      title: 'Diferencia NR',
      dataIndex: 'diferenciaNR',
      width: 130,
      align: 'center' as const,
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : 'default'} style={{ fontWeight: 600 }}>
          {v.toLocaleString('es-CO')}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 110,
      align: 'center' as const,
      render: (e: string) =>
        e === 'CERRADO' ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>CERRADO</Tag>
        ) : (
          <Tag color="orange" icon={<WarningOutlined />}>PENDIENTE</Tag>
        ),
    },
    {
      title: '',
      key: 'acciones',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, r: VisitaRecaudo) => (
        <Button
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={() => abrirVisita(r)}
          disabled={r.estado === 'CERRADO'}
        >
          {r.estado === 'CERRADO' ? 'Cerrado' : 'Recaudar'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center" wrap>
        <Title level={4} style={{ margin: 0 }}>
          <WalletOutlined /> Recaudo de Efectivo por Visita
        </Title>
        <Button
          type={soloPendientes ? 'primary' : undefined}
          danger={!soloPendientes}
          onClick={() => {
            const nuevo = !soloPendientes
            setSoloPendientes(nuevo)
            loadData(!soloPendientes)
          }}
        >
          {soloPendientes ? 'Mostrando solo pendientes' : 'Mostrando todas las visitas'}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
          Recargar
        </Button>
      </Space>

      <Card
        title="Visitas del operador (pedidos con lectura de contador NR)"
        extra={<Tag color="geekblue">NR = ventas totales de la máquina (efectivo + tarjetas)</Tag>}
      >
        <Spin spinning={initialLoading}>
          <Table
            rowKey={(r: any) => r.idGrupo}
            columns={columns as any}
            dataSource={visitas}
            size="middle"
            pagination={{ pageSize: 20, showTotal: (t) => `${t} visita(s)` }}
            scroll={{ x: 1300 }}
            locale={{ emptyText: 'No hay visitas con lectura NR registrada' }}
          />
        </Spin>
      </Card>

      <Drawer
        title={
          selected ? (
            <Space direction="vertical" size={0}>
              <strong>Cerrar Recaudo - Visita #{selected.idGrupo}</strong>
              <span style={{ color: '#888', fontSize: 12 }}>
                {selected.maquina?.serial ?? `Máq #${selected.idMaquina}`} ·{' '}
                {selected.operador?.nombreCompleto ?? `Op #${selected.idOperador}`} ·{' '}
                {new Date(selected.fechaVisita).toLocaleString('es-CO')}
              </span>
            </Space>
          ) : (
            'Cerrar Recaudo'
          )
        }
        width={600}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small" type="inner" title="Contador NR">
              <Statistic title="NR Anterior (previo a la visita)" value={selected?.nrAnterior ?? 0} valueStyle={{ color: '#722ed1' }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" type="inner">
              <Statistic
                title="Diferencia NR (ventas de la visita)"
                value={diferenciaActual}
                suffix="unid."
                valueStyle={{ color: diffColor(diferenciaActual), fontSize: 26 }}
                prefix={diferenciaActual >= 0 ? '+' : ''}
              />
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ marginTop: 16 }} type="inner" title="NR digitado por el operador en esta visita">
          <label style={{ fontWeight: 600 }}>NR Actual (lectura de la máquina):</label>
          <div style={{ marginTop: 8 }}>
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              min={0}
              value={nrActual}
              onChange={(v: any) => setNrActual(Number(v))}
              placeholder={`Valor digitado: ${selected?.nrActual ?? 0}`}
            />
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
            Solo se modifica el último NR (por si el operador lo digito mal). El NR anterior es fijo.
          </div>
        </Card>

        <Card size="small" style={{ marginTop: 16 }} type="inner" title="💰 Efectivo que trajo el operador (recogido)">
          <label style={{ fontWeight: 600 }}>Efectivo Recogido ($): *</label>
          <InputNumber
            size="large"
            style={{ width: '100%', marginTop: 8 }}
            min={0}
            prefix="$"
            value={efectivoRecog}
            onChange={(v: any) => setEfectivoRecog(Number(v))}
            placeholder="Digite el efectivo físico que trajo el operador"
            formatter={(v: any) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(v: any) => Number(String(v).replace(/[\$\s,]/g, ''))}
          />
        </Card>

        <Descriptions
          bordered
          size="small"
          column={1}
          style={{ marginTop: 16 }}
        >
          <Descriptions.Item label="NR Anterior">
            {(selected?.nrAnterior ?? 0).toLocaleString('es-CO')}
          </Descriptions.Item>
          <Descriptions.Item label="NR Actual (a cerrar)">
            {nrActual?.toLocaleString('es-CO') ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Diferencia NR">
            {diferenciaActual.toLocaleString('es-CO')} unidades
          </Descriptions.Item>
          <Descriptions.Item label="Efectivo Recogido">
            {efectivoRecog != null ? `$ ${efectivoRecog.toLocaleString('es-CO')}` : '—'}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              loading={guardando}
              disabled={!perm.crear}
              onClick={cerrarRecaudo}
            >
              🔒 Cerrar Recaudo
            </Button>
          </Space>
        </div>
      </Drawer>
    </div>
  )
}

export default Efectivo