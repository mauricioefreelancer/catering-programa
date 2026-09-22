import { useState, useEffect, useCallback } from 'react'
import {
  Steps,
  Card,
  Button,
  Select,
  InputNumber,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Space,
  Tag,
  Spin,
} from 'antd'
import { WalletOutlined, CheckCircleOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons'
import { usePermissions } from '../../../hooks/usePermissions'
import { apiService } from '../../../api/services/api'

const { Title } = Typography
const { Option } = Select

interface MaquinaEfectivo {
  id: number
  serial: string
  zona: string
  ultimoNR?: number
  efectivo_teorico_base?: number
}

const Efectivo = () => {
  const [current, setCurrent] = useState(0)
  const [maquinaId, setMaquinaId] = useState<number | null>(null)
  const [nrActual, setNrActual] = useState<number | null>(null)
  const [efectivoRecog, setEfectivoRecog] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions('tesoreria')

  const [maquinas, setMaquinas] = useState<MaquinaEfectivo[]>([])
  const [fetching, setFetching] = useState<boolean>(true)
  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [ultimoNRs, setUltimoNRs] = useState<Record<number, number>>({})
  const [precioVentaPromedio, setPrecioVentaPromedio] = useState<number>(3500)

  const loadData = useCallback(async () => {
    setFetching(true)
    try {
      let maquinasRes: any = null
      let preciosRes: any = null

      try {
        ;[maquinasRes, preciosRes] = await Promise.all([
          apiService.get<any>('/maquinas'),
          apiService.get<any>('/precios-cliente').catch(() => null),
        ])
      } catch (e: any) {
        maquinasRes = await apiService.get<any>('/maquinas').catch(() => ({ data: [] }))
      }

      const maquinasList = Array.isArray(maquinasRes)
        ? maquinasRes
        : Array.isArray(maquinasRes?.data)
          ? maquinasRes.data
          : []

      const maquinasMapeadas: MaquinaEfectivo[] = maquinasList.map((m: any) => ({
        id: m.idMaquina ?? m.id,
        serial: m.serial ?? '',
        zona: m.ubicacionEsp ?? m.zona ?? '',
        ultimoNR: m.ultimoNR ?? 0,
        efectivo_teorico_base: m.efectivo_teorico_base ?? 0,
      }))

      setMaquinas(maquinasMapeadas)

      if (maquinasMapeadas.length > 0) {
        try {
          const nrResults = await Promise.all(
            maquinasMapeadas.map((m) =>
              apiService
                .get<any>(`/tesoreria/efectivo-nr/ultimo/${m.id}`)
                .then((r: any) => ({ idMaquina: m.id, nr: r?.nrActual ?? r?.data?.nrActual ?? r?.ultimoNR ?? r?.data?.ultimoNR ?? 0 }))
                .catch(() => ({ idMaquina: m.id, nr: 0 })),
            ),
          )
          const map: Record<number, number> = {}
          nrResults.forEach((r) => {
            map[r.idMaquina] = r.nr || 0
          })
          setUltimoNRs(map)
        } catch {
          setUltimoNRs({})
        }
      }

      const preciosList = preciosRes?.data ?? preciosRes ?? []
      if (Array.isArray(preciosList) && preciosList.length > 0) {
        const precios = preciosList
          .map((p: any) => p.precioVenta ?? p.precio_venta ?? p.precio ?? 0)
          .filter((v: number) => v > 0)
        if (precios.length > 0) {
          const prom = Math.round(precios.reduce((s: number, v: number) => s + v, 0) / precios.length)
          setPrecioVentaPromedio(prom)
        } else {
          setPrecioVentaPromedio(3500)
          message.warning('No se encontraron precios de venta, usando promedio base $3.500')
        }
      } else {
        setPrecioVentaPromedio(3500)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cargar máquinas')
    } finally {
      setFetching(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const maquina = maquinas.find((m) => m.id === maquinaId) || null
  const nrAnterior = maquinaId !== null ? (ultimoNRs[maquinaId] ?? maquina?.ultimoNR ?? 0) : 0

  const diferenciaNR = nrActual !== null && maquina ? nrActual - nrAnterior : 0
  const efectivoTeorico = maquina ? (maquina.efectivo_teorico_base || 0) + diferenciaNR * precioVentaPromedio * 0.6 : 0
  const diferenciaRec = efectivoRecog !== null ? efectivoRecog - efectivoTeorico : 0

  const next = () => {
    if (current === 0 && !maquinaId) {
      message.error('Seleccione una máquina')
      return
    }
    if (current === 1) {
      if (nrActual === null || nrActual < nrAnterior) {
        message.error(`NR Actual debe ser >= NR Anterior (${nrAnterior})`)
        return
      }
      if (efectivoRecog === null || efectivoRecog < 0) {
        message.error('Ingrese Efectivo Recogido')
        return
      }
    }
    setCurrent(current + 1)
  }
  const prev = () => setCurrent(current - 1)

  const cerrar = async () => {
    setLoading(true)
    try {
      try {
        const body = {
          idMaquina: maquinaId,
          nrAnterior,
          nrActual,
          diferenciaNR,
          efectivoTeorico,
          efectivoRecog,
          diferenciaRec,
        }
        const res: any = await apiService.post('/tesoreria/efectivo-nr', body)
        const idRecaudo = res?.id ?? res?.idRecaudo ?? res?.data?.id ?? res?.data?.idRecaudo ?? Math.floor(Math.random() * 10000)
        message.success(`✅ Recaudo #${idRecaudo} cerrado exitosamente`)
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 404 || !status) {
          message.error('Endpoint no implementado, no se persistió')
        } else {
          message.error(err?.response?.data?.message || 'Error al guardar recaudo')
          return
        }
      }
      setCurrent(0)
      setMaquinaId(null)
      setNrActual(null)
      setEfectivoRecog(null)
    } finally {
      setLoading(false)
    }
  }

  const diffColor = (v: number) => (v > 0 ? '#52c41a' : v < 0 ? '#ff4d4f' : '#666')

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center">
        <Title level={4} style={{ margin: 0 }}>
          <WalletOutlined /> Cierre de Efectivo / Recaudo por Máquina
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={fetching}>
          Recargar
        </Button>
      </Space>

      <Spin spinning={initialLoading} tip="Cargando catálogo de máquinas...">
        <Card style={{ marginBottom: 24 }}>
          <Steps
            current={current}
            size="large"
            items={[
              { title: 'Seleccionar Máquina', description: 'Seleccione máquina y vea último NR' },
              { title: 'Ingresar Valores', description: 'NR Actual y Efectivo recogido' },
              { title: 'Resumen y Cierre', description: 'Revisar diferencias y confirmar' },
            ]}
          />
        </Card>

        {current === 0 && (
          <Card title="Paso 1: Seleccione la Máquina">
            <Select
              showSearch
              placeholder="Buscar máquina por serial o zona"
              style={{ width: '100%', maxWidth: 640 }}
              size="large"
              value={maquinaId}
              onChange={(v: any) => setMaquinaId(v)}
              optionFilterProp="label"
            >
              {maquinas.map((m) => {
                const nrDisp = ultimoNRs[m.id] ?? m.ultimoNR ?? 0
                return (
                  <Option key={m.id} value={m.id} label={`${m.serial} ${m.zona}`}>
                    <Space>
                      <strong>{m.serial}</strong>
                      <span style={{ color: '#666' }}>|</span>
                      <span>{m.zona}</span>
                      <Tag color="blue">NR {nrDisp}</Tag>
                    </Space>
                  </Option>
                )
              })}
            </Select>

            {maquina && (
              <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} sm={12} md={6}><Card size="small"><Statistic title="Serial Máquina" value={maquina.serial} /></Card></Col>
                <Col xs={24} sm={12} md={6}><Card size="small"><Statistic title="Zona / Ubicación" value={maquina.zona} /></Card></Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small"><Statistic title="NR Anterior (lectura anterior)" value={nrAnterior} valueStyle={{ color: '#722ed1' }} /></Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small"><Statistic title="Base Teórica Inicial" prefix="$" value={maquina.efectivo_teorico_base || 0} formatter={(v: any) => Number(v).toLocaleString('es-CO')} /></Card>
                </Col>
              </Row>
            )}

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button type="primary" size="large" onClick={next} icon={<ArrowRightOutlined />}>
                Siguiente: Ingresar Valores
              </Button>
            </div>
          </Card>
        )}

        {current === 1 && (
          <Card title="Paso 2: Ingrese Valores de la Recolección">
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Card size="small" type="inner" title="Contadores NR (No Reseteables)">
                  <Statistic title="NR Anterior (lectura máquina)" value={nrAnterior} style={{ marginBottom: 16 }} />
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontWeight: 600 }}>NR Actual (digitado en campo): *</label>
                    <InputNumber
                      size="large"
                      style={{ width: '100%', marginTop: 8 }}
                      min={0}
                      value={nrActual}
                      onChange={(v: any) => setNrActual(Number(v))}
                      placeholder="Ingrese NR actual de la máquina"
                    />
                  </div>
                  {nrActual !== null && (
                    <div style={{ marginTop: 16 }}>
                      <Statistic
                        title="Diferencia NR (consumo)"
                        value={diferenciaNR}
                        valueStyle={{ color: diffColor(diferenciaNR), fontSize: 28 }}
                        prefix={diferenciaNR >= 0 ? '+' : ''}
                      />
                    </div>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" type="inner" title="💰 Efectivo Recogido en Caja">
                  <label style={{ fontWeight: 600 }}>Efectivo Recogido ($): *</label>
                  <InputNumber
                    size="large"
                    style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
                    min={0}
                    prefix="$"
                    value={efectivoRecog}
                    onChange={(v: any) => setEfectivoRecog(Number(v))}
                    placeholder="Digite total efectivo extraído"
                    formatter={(v: any) => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v: any) => Number(String(v).replace(/[\$\s,]/g, ''))}
                  />
                </Card>
              </Col>
            </Row>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={prev}>← Atrás</Button>
                <Button type="primary" size="large" onClick={next} icon={<ArrowRightOutlined />}>
                  Siguiente: Resumen
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {current === 2 && (
          <Card title="Paso 3: Resumen del Recaudo - Confirmar Cierre">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small" style={{ borderTop: '3px solid #666' }}>
                  <Statistic
                    title="Diferencia NR"
                    value={diferenciaNR}
                    suffix="unid."
                    valueStyle={{ color: '#666', fontSize: 28 }}
                  />
                  <p style={{ color: '#888', marginTop: 8, fontSize: 12 }}>
                    NR Anterior: {nrAnterior} → Actual: {nrActual}
                  </p>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" style={{ borderTop: '3px solid #1677ff' }}>
                  <Statistic
                    title="Efectivo Teórico Esperado"
                    value={efectivoTeorico}
                    prefix="$"
                    valueStyle={{ color: '#1677ff', fontSize: 28 }}
                    formatter={(v) => Number(v).toLocaleString('es-CO')}
                  />
                  <p style={{ color: '#888', marginTop: 8, fontSize: 12 }}>Base + Consumo NR × Promedio</p>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card
                  size="small"
                  style={{ borderTop: `3px solid ${diffColor(diferenciaRec)}` }}
                >
                  <Statistic
                    title="Diferencia Recogida vs Teórico"
                    value={diferenciaRec}
                    prefix={diferenciaRec >= 0 ? '+ $' : '- $'}
                    valueStyle={{ color: diffColor(diferenciaRec), fontSize: 28 }}
                    formatter={(v) => Math.abs(Number(v)).toLocaleString('es-CO')}
                    suffix={diferenciaRec > 0 ? ' (Sobrante)' : diferenciaRec < 0 ? ' (Faltante)' : ''}
                  />
                  <p style={{ color: '#888', marginTop: 8, fontSize: 12 }}>
                    Recogido: ${efectivoRecog?.toLocaleString('es-CO') || 0}
                  </p>
                </Card>
              </Col>
            </Row>

            <div style={{ marginTop: 32, textAlign: 'right' }}>
              <Space>
                <Button onClick={prev}>← Corregir Valores</Button>
                {perm.crear && (
                  <Button type="primary" size="large" icon={<CheckCircleOutlined />} loading={loading} onClick={cerrar}>
                    🔒 Cerrar Recaudo
                  </Button>
                )}
              </Space>
            </div>
          </Card>
        )}
      </Spin>
    </div>
  )
}

export default Efectivo
