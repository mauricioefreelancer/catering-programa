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
import { WalletOutlined, CheckCircleOutlined, ReloadOutlined, EyeOutlined, WarningOutlined, SaveOutlined } from '@ant-design/icons'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAuth } from '../../../hooks/useAuth'
import { apiService } from '../../../api/services/api'

const { Title } = Typography

// Medios de pago que maneja una máquina (Efectivo siempre está presente).
const MEDIOS_DIGITALES = ['veos', 'datafono', 'cupos'] as const
type MedioDigital = typeof MEDIOS_DIGITALES[number]
const MEDIO_LABEL: Record<string, string> = {
  veos: 'Veos',
  datafono: 'Datafono',
  cupos: 'Cupos',
}

interface MediosPago {
  efectivo?: boolean
  veos?: boolean
  datafono?: boolean
  cupos?: boolean
}

interface RecaudoGuardado {
  idRecaudo: number
  estado: string
  efectivoEsperado: number
  veosRecog: number
  datafonoRecog: number
  cuposRecog: number
}

interface VisitaRecaudo {
  idGrupo: number
  idMaquina: number
  idOperador: number
  fechaVisita: string
  nrAnterior: number
  nrActual: number
  diferenciaNR: number
  totalVendido: number
  estado: 'PENDIENTE' | 'CERRADO'
  idRecaudo: number | null
  maquina?: { serial?: string; ubicacionEsp?: string; mediosPago?: MediosPago | null } | null
  operador?: { nombreCompleto?: string; zonaAsignada?: string } | null
  recaudoGuardado?: RecaudoGuardado | null
}

// Devuelve qué medios digitales acepta la máquina (leyendo el JSON mediosPago).
const mediosActivos = (m: VisitaRecaudo['maquina']): MedioDigital[] => {
  const mp = m?.mediosPago ?? {}
  return MEDIOS_DIGITALES.filter((k) => !!mp[k])
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : `$ ${Number(n).toLocaleString('es-CO')}`)

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
  const [digitales, setDigitales] = useState<Record<string, number | null>>({})
  const [efectivoRecog, setEfectivoRecog] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardandoParcial, setGuardandoParcial] = useState(false)

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
    const activos = mediosActivos(v.maquina)
    const precarga: Record<string, number | null> = {}
    for (const k of MEDIOS_DIGITALES) {
      if (activos.includes(k)) {
        precarga[k] = v.recaudoGuardado ? v.recaudoGuardado[`${k}Recog`] ?? null : null
      }
    }
    setDigitales(precarga)
    setEfectivoRecog(v.recaudoGuardado?.efectivoEsperado !== undefined && v.recaudoGuardado?.estado === 'PENDIENTE'
      ? v.recaudoGuardado.efectivoEsperado
      : null)
  }

  const buildBody = (efectivo: number | null) => {
    const medios = mediosActivos(selected?.maquina)
    const body: any = {
      idGrupo: selected?.idGrupo,
      idMaquina: selected?.idMaquina,
      idOperador: selected?.idOperador,
      idUsuario: usuario?.idUsuario,
      nrAnterior: selected?.nrAnterior,
      nrActual: nrActual ?? selected?.nrActual,
    }
    for (const k of MEDIOS_DIGITALES) {
      if (medios.includes(k)) body[`${k}Recog`] = digitales[k] ?? 0
    }
    if (efectivo !== null) body.efectivoRecog = efectivo
    return body
  }

  // Guardado parcial: se digita lo no-efectivo y queda PENDIENTE (falta el efectivo).
  const guardarParcial = async () => {
    if (!selected) return
    if (nrActual === null || nrActual < selected.nrAnterior) {
      message.error(`NR debe ser >= NR Anterior (${selected.nrAnterior})`)
      return
    }
    setGuardandoParcial(true)
    try {
      await apiService.post('/tesoreria/efectivo-nr', buildBody(null))
      message.success(`✅ Medios digitales guardados para la visita ${selected.idGrupo}. Recaudo PENDIENTE hasta digitar el efectivo.`)
      setSelected(null)
      loadData(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar los medios de pago')
    } finally {
      setGuardandoParcial(false)
    }
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
    const existePendiente = selected.idRecaudo != null && selected.estado === 'PENDIENTE' && selected.recaudoGuardado?.estado === 'PENDIENTE'
    try {
      let res: any
      let accion: string
      if (existePendiente) {
        // Ya se guardaron los medios digitales; solo completamos el efectivo (PATCH).
        res = await apiService.patch(`/tesoreria/efectivo-nr/${selected.idRecaudo}`, { efectivoRecog })
        accion = 'cerrado'
      } else {
        res = await apiService.post('/tesoreria/efectivo-nr', buildBody(efectivoRecog))
        accion = 'cerrado'
      }
      const idRecaudo = res?.id ?? res?.idRecaudo ?? res?.data?.idRecaudo ?? Math.floor(Math.random() * 10000)
      message.success(`✅ Recaudo #${idRecaudo} ${accion} para la visita ${selected.idGrupo}`)
      setSelected(null)
      loadData(true)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cerrar recaudo')
    } finally {
      setGuardando(false)
    }
  }

  const diffColor = (v: number) => (v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#666')
  // El NR es un contador acumulativo de valor en $: la diferencia ya es la venta en dinero del periodo.
  const diferenciaActual = selected && nrActual !== null ? nrActual - (selected.nrAnterior || 0) : 0
  const totalVendidoActual = Math.max(0, diferenciaActual)
  const mediosActivosSel = selected ? mediosActivos(selected.maquina) : []
  const sumaDigitales = mediosActivosSel.reduce((acc, k) => acc + (digitales[k] ?? 0), 0)
  const efectivoEsperado = Math.max(0, totalVendidoActual - sumaDigitales)
  const esPendienteCerrable = !!selected && selected.idRecaudo != null && selected.estado === 'PENDIENTE' && selected.recaudoGuardado?.estado === 'PENDIENTE'

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
      title: 'NR Anterior ($)',
      dataIndex: 'nrAnterior',
      width: 130,
      align: 'center' as const,
      render: (v: number) => <Tag color="default">{v.toLocaleString('es-CO')}</Tag>,
    },
    {
      title: 'NR Actual ($)',
      dataIndex: 'nrActual',
      width: 130,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue" style={{ fontWeight: 600 }}>{v.toLocaleString('es-CO')}</Tag>,
    },
    {
      title: 'Total Vendido ($)',
      dataIndex: 'totalVendido',
      width: 150,
      align: 'center' as const,
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : 'default'} style={{ fontWeight: 600 }}>
          {fmt(v)}
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

        <Card size="small" style={{ marginTop: 16 }} type="inner" title="💳 Medios de pago de la máquina (no efectivo)">
          {mediosActivosSel.length === 0 ? (
            <Tag color="default">Esta máquina solo acepta efectivo</Tag>
          ) : (
            <>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                Digite lo recaudado por cada medio digital asignado. El NR es el total vendido de la máquina (efectivo + digitales).
              </div>
              {mediosActivosSel.map((k) => (
                <div key={k} style={{ marginBottom: 12 }}>
                  <label style={{ fontWeight: 600 }}>{MEDIO_LABEL[k]} ($):</label>
                  <InputNumber
                    size="large"
                    style={{ width: '100%', marginTop: 4 }}
                    min={0}
                    prefix="$"
                    value={digitales[k]}
                    onChange={(v: any) => setDigitales((d) => ({ ...d, [k]: v == null ? null : Number(v) }))}
                    placeholder={`Digite el valor de ${MEDIO_LABEL[k]}`}
                    formatter={(val: any) => `$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(val: any) => Number(String(val).replace(/[\$\s,]/g, ''))}
                  />
                </div>
              ))}
            </>
          )}
        </Card>

        <Card size="small" style={{ marginTop: 16 }} type="inner" title="💰 Efectivo que trae el operador">
          <Statistic
            title="Efectivo ESPERADO (total vendido − medios digitales)"
            value={efectivoEsperado}
            precision={0}
            prefix="$"
            valueStyle={{ color: '#cf1322' }}
          />
          <div style={{ height: 12 }} />
          <label style={{ fontWeight: 600 }}>Efectivo Recogido ($): {mediosActivosSel.length > 0 ? '* (obligatorio para cerrar)' : ''}</label>
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
          <Descriptions.Item label="Diferencia NR — Total Vendido ($)">
            {fmt(totalVendidoActual)}
          </Descriptions.Item>
          {mediosActivosSel.map((k) => (
            <Descriptions.Item key={k} label={MEDIO_LABEL[k]}>
              {fmt(digitales[k])}
            </Descriptions.Item>
          ))}
          <Descriptions.Item label="Efectivo Esperado">
            {fmt(efectivoEsperado)}
          </Descriptions.Item>
          <Descriptions.Item label="Efectivo Recogido">
            {fmt(efectivoRecog)}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setSelected(null)}>Cancelar</Button>
            {!esPendienteCerrable && mediosActivosSel.length > 0 && (
              <Button
                size="large"
                icon={<SaveOutlined />}
                loading={guardandoParcial}
                disabled={!perm.crear}
                onClick={guardarParcial}
              >
                Guardar Parcial (queda pendiente)
              </Button>
            )}
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              loading={guardando}
              disabled={!perm.crear}
              onClick={cerrarRecaudo}
            >
              {esPendienteCerrable ? '🔒 Cerrar Recaudo (efectivo)' : '🔒 Cerrar Recaudo'}
            </Button>
          </Space>
        </div>
      </Drawer>
    </div>
  )
}

export default Efectivo