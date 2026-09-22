import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
  Tag,
  Divider,
  Result,
  message,
  Spin,
  Alert,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { apiService } from '../../api/services/api'
import { offlineStore } from './offline.store'

const { Text } = Typography

interface NRQRow {
  key: string
  boton: string
  productoNombre: string
  valor: number
}

interface EspiralPayload {
  espiral: string
  fisico: number
  sugerida: number
  idMapaMp?: number
  idProducto?: number
  productoNombre?: string
  capacidad_max?: number
}

interface MaquinaCfg {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  totalEspirales: number
  totalSugeridas: number
  ultimoNR: number
  nrActual: number
  totalNRQ: number
  espirales: EspiralPayload[]
}

interface DatosContadores {
  nrActual: number | null
  botones: NRQRow[]
  savedAt?: number
}

const normalizarTipo = (t: string): MaquinaCfg['tipo'] => {
  const up = String(t || '').toUpperCase()
  if (up.includes('CAFE') || up.includes('CAFÉ')) return 'CAFE'
  if (up.includes('BEBID')) return 'BEBIDA'
  if (up.includes('SNACK') || up.includes('SNACKS')) return 'SNACK'
  if (up.includes('COMBIN') || up.includes('MIXTO')) return 'COMBINADA'
  return 'SNACK'
}

const ResumenMobile = () => {
  const { idMaquina } = useParams()
  const navigate = useNavigate()
  const id = Number(idMaquina) || 1

  const [loading, setLoading] = useState(true)
  const [maquina, setMaquina] = useState<MaquinaCfg | null>(null)
  const [datosContadores, setDatosContadores] = useState<DatosContadores | null>(null)

  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)

      let datos: DatosContadores | null = null
      try {
        const raw = sessionStorage.getItem(`contadores_${id}`)
        if (raw) {
          datos = JSON.parse(raw)
        }
      } catch (e) {
        console.warn('Error leyendo sessionStorage contadores', e)
      }
      if (!datos) {
        datos = { nrActual: null, botones: [] }
      }
      setDatosContadores(datos)

      let espiralesInventario: any[] = []
      try {
        const rawInv = sessionStorage.getItem(`inventario_${id}`)
        if (rawInv) {
          const inv = JSON.parse(rawInv)
          espiralesInventario = inv.espirales || []
        }
      } catch (e) {
        console.warn('Error leyendo sessionStorage inventario', e)
      }

      const [maquinaRes, mapaMpRes] = await Promise.all([
        apiService.get<any>(`/maquinas/${id}?include=mapa_cafe_nrq`).catch(() => null),
        apiService.get<any[]>(`/maquinas/${id}/mapa-mp`).catch(() => []),
      ])

      const rawMaq = maquinaRes?.data ?? maquinaRes
      if (!rawMaq) {
        setMaquina(null)
        return
      }

      const mapaNrq = rawMaq.mapa_cafe_nrq || rawMaq.mapaCafeNrq || rawMaq.mapa_nrq || rawMaq.mapaNrq || null
      const ultimoNR = Number(
        mapaNrq?.ultimoNR ??
        mapaNrq?.ultimo_nr ??
        rawMaq.ultimo_nr ??
        rawMaq.ultimoContadorNR ??
        rawMaq.ultimoNr ??
        rawMaq.contadorNR ??
        0
      )

      const mapaMp = Array.isArray(mapaMpRes) ? mapaMpRes : (mapaMpRes?.data ?? [])
      const espiralesProcesadas: EspiralPayload[] = mapaMp.map((m: any) => {
        const prod = m.producto ?? m.productoMP ?? m.Producto ?? {}
        const capacidad = Number(m.capacidadMax ?? m.capacidad_max ?? 15)
        const matchInv = espiralesInventario.find((e: any) =>
          String(e.idMapaMp ?? e.id ?? e.espiral) === String(m.idMapaMP ?? m.id ?? m.espiralCodigo)
        )
        const fisico = matchInv ? Number(matchInv.fisico ?? matchInv.fisico_digitado ?? 0) : 0
        const sugerida = matchInv ? Number(matchInv.sugerida ?? matchInv.cant_sugerida ?? Math.max(0, capacidad - fisico)) : Math.max(0, capacidad - fisico)
        return {
          espiral: m.espiralCodigo ?? m.codigo ?? m.espiral ?? '?',
          fisico,
          sugerida,
          idMapaMp: Number(m.idMapaMP ?? m.id) || undefined,
          idProducto: Number(prod.idProducto ?? prod.id) || undefined,
          productoNombre: prod.nombreProducto ?? prod.nombre ?? 'Producto',
          capacidad_max: capacidad,
        }
      })

      const totalEspirales = espiralesProcesadas.length
      const totalSugeridas = espiralesProcesadas.reduce((s, e) => s + (e.sugerida || 0), 0)

      const nrDesdeContadores = datos?.nrActual ?? null
      const nrFinal = nrDesdeContadores !== null ? Number(nrDesdeContadores) : (ultimoNR || 0)
      const totalNRQ = (datos?.botones || []).reduce((s, b) => s + (b.valor || 0), 0) || 0

      const maquinaMapeada: MaquinaCfg = {
        id: Number(rawMaq.idMaquina ?? rawMaq.id ?? id),
        serial: rawMaq.serial ?? `MAQ-${id}`,
        zona: rawMaq.ubicacionEsp ?? rawMaq.zona ?? rawMaq.ubicacion ?? 'Sin zona',
        clienteNombre: rawMaq.cliente?.razonSocial ?? rawMaq.clienteNombre ?? rawMaq.cliente?.nombre ?? 'Sin cliente',
        tipo: normalizarTipo(rawMaq.Tipo_Maquina ?? rawMaq.tipo ?? rawMaq.tipoMaquina ?? 'SNACK'),
        totalEspirales,
        totalSugeridas,
        ultimoNR,
        nrActual: nrFinal,
        totalNRQ,
        espirales: espiralesProcesadas,
      }

      setMaquina(maquinaMapeada)
    } catch (e) {
      console.error('Error cargando resumen', e)
      setMaquina(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const diffNR = (maquina?.nrActual || 0) - (maquina?.ultimoNR || 0)

  const save = async (forceOffline = false) => {
    setSaving(true)
    setOfflineSaved(false)
    try {
      const payload = {
        maquinaId: id,
        maquinaSerial: maquina?.serial,
        espirales: (maquina?.espirales || []).map((e) => ({
          espiral: e.espiral,
          fisico: e.fisico,
          sugerida: e.sugerida,
          idMapaMp: e.idMapaMp,
          idProducto: e.idProducto,
        })),
        nr_actual: datosContadores?.nrActual ?? maquina?.nrActual ?? 0,
        nrq: (datosContadores?.botones || []).map((b) => ({
          boton: b.boton,
          productoNombre: b.productoNombre,
          valor: b.valor,
        })),
        savedAt: Date.now(),
      }

      if (!forceOffline) {
        await apiService.post('/inventarios/operario', payload as any)
      } else {
        throw new Error('FORCE_OFFLINE')
      }
      setSavedOk(true)
      message.success('✅ Inventario enviado correctamente')
    } catch (e: any) {
      try {
        await offlineStore.addPending({
          maquinaId: id,
          maquinaSerial: maquina?.serial ?? `MAQ-${id}`,
          espirales: (maquina?.espirales || []).map((e) => ({
            espiral: e.espiral,
            fisico: e.fisico,
            sugerida: e.sugerida,
            idMapaMp: e.idMapaMp,
            idProducto: e.idProducto,
          })),
          nr_actual: datosContadores?.nrActual ?? maquina?.nrActual ?? 0,
          nrq: (datosContadores?.botones || []).map((b) => ({
            boton: b.boton,
            productoNombre: b.productoNombre,
            valor: b.valor,
          })),
          savedAt: Date.now(),
        } as any)
      } catch (err) {
        console.error('Error guardando offline', err)
      }
      setOfflineSaved(true)
      setSavedOk(true)
      message.warning('📴 Sin conexión: Guardado OFFLINE. Sincronizará luego.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" tip="Cargando resumen..." />
      </div>
    )
  }

  if (!maquina) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="warning"
          showIcon
          message="No hay datos de máquina, regrese a Contadores"
          description="No se pudo cargar la información de resumen. Por favor regrese y complete los pasos anteriores."
          action={
            <Button size="small" onClick={() => navigate(`/mobile/contadores/${id}`)}>
              Ir a Contadores
            </Button>
          }
        />
      </div>
    )
  }

  if (savedOk) {
    return (
      <Result
        status="success"
        icon={<CheckCircleOutlined />}
        title={offlineSaved ? 'Guardado Offline ✓' : '¡Inventario Enviado! ✓'}
        subTitle={
          offlineSaved
            ? 'El dispositivo no tenía conexión. Datos almacenados localmente. Presiona "Sincronizar" en el Topbar cuando haya red.'
            : `Inventario para ${maquina?.serial} procesado. ${maquina?.totalSugeridas} unidades sugeridas para despacho.`
        }
        extra={[
          <Button type="primary" size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile/home')}>
            Volver a Lista Máquinas
          </Button>,
        ]}
      />
    )
  }

  return (
    <div>
      <Button type="link" onClick={() => navigate(`/mobile/contadores/${id}`)} icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 4 }}>
        Volver a Contadores
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
          </Col>
        </Row>
      </Card>

      <Card title="📋 Resumen General del Inventario">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Row gutter={8}>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Espirales Revisadas" value={maquina?.totalEspirales} suffix="unid." />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Unid. Sugeridas" value={maquina?.totalSugeridas} valueStyle={{ color: '#1677ff' }} suffix="pzs" />
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '6px 0' }} />

          <Row gutter={8}>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="NR Anterior" value={maquina?.ultimoNR} />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="NR Actual" value={maquina?.nrActual} />
              </Card>
            </Col>
          </Row>
          <Row>
            <Col xs={24}>
              <Card size="small" style={{ background: diffNR >= 0 ? '#f6ffed' : '#fff2f0' }}>
                <Statistic
                  title="Consumo NR Período"
                  value={diffNR}
                  valueStyle={{ color: diffNR >= 0 ? '#52c41a' : '#ff4d4f' }}
                  prefix={diffNR >= 0 ? '+' : ''}
                  suffix="dispensas"
                />
              </Card>
            </Col>
          </Row>

          {maquina?.tipo === 'CAFE' && (
            <>
              <Divider />
              <Row>
                <Col xs={24}>
                  <Card size="small" style={{ background: '#f9f0ff' }}>
                    <Statistic
                      title="☕ Total Dosificaciones NRQ"
                      value={maquina?.totalNRQ}
                      valueStyle={{ color: '#722ed1' }}
                      suffix="vasos"
                    />
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <Button type="primary" size="large" loading={saving} icon={<SaveOutlined />} onClick={() => save()}>
          💾 Guardar y Sincronizar (Online)
        </Button>
        <Button size="large" loading={saving} icon={<SyncOutlined />} onClick={() => save(true)}>
          📴 Guardar local (Offline)
        </Button>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/mobile/contadores/${id}`)}>
          Corregir Datos
        </Button>
      </div>
    </div>
  )
}

export default ResumenMobile
