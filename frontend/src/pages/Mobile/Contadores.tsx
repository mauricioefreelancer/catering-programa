import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  InputNumber,
  Typography,
  Space,
  Table,
  Tag,
  Divider,
  Row,
  Col,
  message,
  Spin,
  Alert,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { apiService } from '../../../api/services/api'

const { Text } = Typography

interface NRQRow {
  key: string
  boton: string
  productoNombre: string
  valor: number
}

interface MaquinaCfg {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  botonesNRQ: NRQRow[]
  ultimoNR: number
}

const normalizarTipo = (t: string): MaquinaCfg['tipo'] => {
  const up = String(t || '').toUpperCase()
  if (up.includes('CAFE') || up.includes('CAFÉ')) return 'CAFE'
  if (up.includes('BEBID')) return 'BEBIDA'
  if (up.includes('SNACK') || up.includes('SNACKS')) return 'SNACK'
  if (up.includes('COMBIN') || up.includes('MIXTO')) return 'COMBINADA'
  return 'SNACK'
}

const ContadoresMobile = () => {
  const { idMaquina } = useParams()
  const navigate = useNavigate()
  const id = Number(idMaquina) || 1

  const [loading, setLoading] = useState(true)
  const [maquina, setMaquina] = useState<MaquinaCfg | null>(null)
  const [botones, setBotones] = useState<NRQRow[]>([])
  const [nrActual, setNrActual] = useState<number | null>(null)

  const cargarMaquina = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiService.get<any>(`/maquinas/${id}?include=mapa_cafe_nrq`).catch(() => null)
      const raw = res?.data ?? res

      if (!raw) {
        setMaquina(null)
        return
      }

      const mapaNrq = raw.mapa_cafe_nrq || raw.mapaCafeNrq || raw.mapa_nrq || raw.mapaNrq || null
      const botonesRaw = mapaNrq?.botonesNRQ || mapaNrq?.botones_nrq || mapaNrq?.botones || []
      const ultimoNR = Number(
        mapaNrq?.ultimoNR ??
        mapaNrq?.ultimo_nr ??
        raw.ultimo_nr ??
        raw.ultimoContadorNR ??
        raw.ultimoNr ??
        raw.contadorNR ??
        0
      )

      const rowsBotones: NRQRow[] = Array.isArray(botonesRaw)
        ? botonesRaw.map((b: any) => {
            const prod = b.producto ?? b.Producto ?? {}
            return {
              key: String(b.idMapaNRQ ?? b.id ?? b.boton ?? Math.random()),
              boton: b.boton ?? b.codigo ?? b.opcionBoton ?? 'B?',
              productoNombre: prod.nombreProducto ?? prod.nombre ?? b.productoNombre ?? 'Producto',
              valor: 0,
            }
          })
        : []

      const maquinaMapeada: MaquinaCfg = {
        id: Number(raw.idMaquina ?? raw.id ?? id),
        serial: raw.serial ?? `MAQ-${id}`,
        zona: raw.ubicacionEsp ?? raw.zona ?? raw.ubicacion ?? 'Sin zona',
        clienteNombre: raw.cliente?.razonSocial ?? raw.clienteNombre ?? raw.cliente?.nombre ?? 'Sin cliente',
        tipo: normalizarTipo(raw.Tipo_Maquina ?? raw.tipo ?? raw.tipoMaquina ?? 'SNACK'),
        botonesNRQ: rowsBotones,
        ultimoNR,
      }

      setMaquina(maquinaMapeada)
      setBotones(maquinaMapeada.botonesNRQ.map((b) => ({ ...b })))
      setNrActual(maquinaMapeada.ultimoNR || null)
    } catch (e) {
      console.error('Error cargando máquina', e)
      setMaquina(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    cargarMaquina()
  }, [cargarMaquina])

  const diffNR = nrActual !== null && maquina ? nrActual - maquina.ultimoNR : 0

  const colsNRQ = [
    { title: 'Botón', dataIndex: 'boton', width: 90, render: (v: string) => <Tag color="purple" style={{ fontSize: 16, fontWeight: 'bold' }}>{v}</Tag> },
    { title: 'Producto Dosificado', dataIndex: 'productoNombre', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'NRQ (Contador)',
      dataIndex: 'valor',
      width: 220,
      render: (_: any, r: NRQRow, i: number) => (
        <InputNumber
          size="large"
          min={0}
          value={r.valor}
          style={{ width: '100%', fontWeight: 'bold', fontSize: 18 }}
          onChange={(v: any) => {
            const n = [...botones]
            n[i] = { ...n[i], valor: Number(v) || 0 }
            setBotones(n)
          }}
        />
      ),
    },
  ]

  const canContinue = () => {
    if (!maquina) return false
    if (nrActual === null || nrActual < maquina.ultimoNR) return false
    if (maquina.tipo === 'CAFE') {
      const total = botones.reduce((s, b) => s + (b.valor || 0), 0)
      if (total === 0) return false
    }
    return true
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" tip="Cargando máquina..." />
      </div>
    )
  }

  if (!maquina) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="warning"
          showIcon
          message="Máquina no encontrada"
          description="No se pudo cargar la información de la máquina. Intente nuevamente."
        />
      </div>
    )
  }

  return (
    <div>
      <Button type="link" onClick={() => navigate(`/mobile/inventario/${id}`)} icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 4 }}>
        Volver a Inventario
      </Button>

      <Card size="small" style={{ marginBottom: 10, background: '#f0f5ff' }}>
        <Row gutter={12}>
          <Col xs={12}>
            <Text strong style={{ fontSize: 17 }}>{maquina?.serial}</Text>
            <div style={{ fontSize: 12, color: '#555' }}>📍 {maquina?.zona}</div>
            <div style={{ fontSize: 12, color: '#555' }}>🏢 {maquina?.clienteNombre}</div>
          </Col>
          <Col xs={12} style={{ textAlign: 'right' }}>
            <Tag color="geekblue" style={{ fontSize: 13 }}>{maquina?.tipo}</Tag>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              NR Anterior: <strong>{maquina?.ultimoNR}</strong>
            </div>
          </Col>
        </Row>
      </Card>

      <Card size="small" style={{ marginBottom: 10 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text strong style={{ fontSize: 16, color: '#722ed1' }}>
              ⚙️ Contador NR (No Reseteable) - * REQUERIDO
            </Text>
            <Divider style={{ margin: '6px 0' }} />
            <Row gutter={12} align="middle">
              <Col xs={12}>
                <Text type="secondary">Anterior:</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{maquina?.ultimoNR}</div>
              </Col>
              <Col xs={12}>
                <Text type="secondary">Actual (digita):</Text>
                <InputNumber
                  size="large"
                  style={{ width: '100%', fontWeight: 'bold', fontSize: 22 }}
                  min={0}
                  value={nrActual}
                  onChange={(v: any) => setNrActual(Number(v))}
                  placeholder="NR Actual"
                />
              </Col>
            </Row>
            {nrActual !== null && (
              <Row>
                <Col xs={24} style={{ textAlign: 'center', paddingTop: 6 }}>
                  <Tag color={diffNR >= 0 ? 'green' : 'red'} style={{ fontSize: 18, padding: '4px 14px' }}>
                    Diferencia: {diffNR >= 0 ? '+' : ''}{diffNR}
                  </Tag>
                </Col>
              </Row>
            )}
          </div>

          {maquina?.tipo === 'CAFE' && botones.length > 0 && (
            <>
              <Divider />
              <div>
                <Text strong style={{ fontSize: 16, color: '#722ed1' }}>
                  ☕ Contadores NRQ por Botón (Dosificadora)
                </Text>
                <Divider style={{ margin: '6px 0' }} />
                <Table
                  size="middle"
                  rowKey="key"
                  dataSource={botones}
                  columns={colsNRQ}
                  pagination={false}
                  scroll={{ y: 400 }}
                />
              </div>
            </>
          )}
        </Space>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/mobile/inventario/${id}`)}>
          Atrás
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          disabled={!canContinue()}
          onClick={() => {
            try {
              sessionStorage.setItem(
                `contadores_${id}`,
                JSON.stringify({ nrActual, botones, savedAt: Date.now() })
              )
            } catch (e) {
              console.warn('No se pudo guardar en sessionStorage', e)
            }
            message.info('Datos de contadores guardados temporalmente')
            navigate(`/mobile/resumen/${id}`)
          }}
        >
          Continuar a Resumen
        </Button>
      </div>
    </div>
  )
}

export default ContadoresMobile
