import { useState, useMemo, useEffect } from 'react'
import {
  Steps,
  Card,
  Button,
  InputNumber,
  message,
  Typography,
  Space,
  Table,
  Tag,
  Result,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  Spin,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircleOutlined, ArrowLeftOutlined, SaveOutlined, ArrowRightOutlined, SyncOutlined } from '@ant-design/icons'
import { apiService } from '../../../api/services/api'
import { offlineStore } from '../offline.store'
import { useAuth } from '../../../hooks/useAuth'

const { Text } = Typography

interface EspiralRow {
  key: string
  espiral: string
  productoNombre: string
  capacidad_max: number
  fisico_digitado: number
  cant_sugerida: number
  idMapaMp?: number
  idProducto?: number
}

interface NRQRow {
  key: string
  boton: string
  productoNombre: string
  valor: number
  idMapaNrq?: number
}

interface MaquinaCfg {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA' | string
  ultimoNR: number
  idOperador?: number
}

const InventarioMobile = () => {
  const { idMaquina } = useParams()
  const navigate = useNavigate()
  const id = Number(idMaquina) || 1
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [maquinaInfo, setMaquinaInfo] = useState<MaquinaCfg | null>(null)
  const [idOperadorActual, setIdOperadorActual] = useState<number | null>(null)

  const [step, setStep] = useState(0)
  const [espirales, setEspirales] = useState<EspiralRow[]>([])
  const [botones, setBotones] = useState<NRQRow[]>([])
  const [nrActual, setNrActual] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true)
        const [maquinaRes, mapaMpRes, mapaNrqRes, operadoresRes] = await Promise.all([
          apiService.get<any>(`/maquinas/${id}`).catch(() => null),
          apiService.get<any[]>(`/maquinas/${id}/mapa-mp`).catch(() => []),
          apiService.get<any>(`/maquinas/${id}/mapa-nrq`).catch(() => null),
          apiService.get<any[]>('/operadores').catch(() => []),
        ])

        const maq = maquinaRes?.data ?? maquinaRes
        if (maq) {
          setMaquinaInfo({
            id: Number(maq.idMaquina ?? id),
            serial: maq.serial ?? `MAQ-${id}`,
            zona: maq.ubicacionEsp ?? maq.ubicacion ?? 'Sin zona',
            clienteNombre: maq.cliente?.razonSocial ?? maq.clienteNombre ?? 'Sin cliente',
            tipo: maq.tipo ?? 'SNACK',
            ultimoNR: Number(maq.ultimoContadorNR ?? maq.ultimoNr ?? maq.contadorNR ?? 0),
            idOperador: Number(maq.idOperador ?? maq.id_operador ?? 0) || undefined,
          })
        } else {
          setMaquinaInfo({
            id, serial: `MAQ-${id}`, zona: 'Sin zona', clienteNombre: 'Sin cliente', tipo: 'SNACK', ultimoNR: 0,
          })
        }

        const opList = Array.isArray(operadoresRes) ? operadoresRes : (operadoresRes?.data ?? [])
        let idOp: number | null = null
        const matchOp = opList.find((o: any) =>
          o.idUsuario === usuario?.id ||
          o.usuario?.idUsuario === usuario?.id ||
          o.idUsuario === (usuario as any)?.idUsuario ||
          Number(o.idUsuario) === Number(usuario?.id)
        )
        if (matchOp?.idOperador) {
          idOp = Number(matchOp.idOperador)
        }
        if (!idOp && maq && maq.idOperador) {
          idOp = Number(maq.idOperador)
        }
        if (!idOp && maquinaRes && (maquinaRes.idOperador || (maquinaRes as any).data?.idOperador)) {
          idOp = Number(maquinaRes.idOperador ?? (maquinaRes as any).data?.idOperador)
        }
        setIdOperadorActual(idOp)

        const mapaMp = Array.isArray(mapaMpRes) ? mapaMpRes : (mapaMpRes?.data ?? [])
        const rowsEsp: EspiralRow[] = mapaMp.map((m: any) => {
          const prod = m.producto ?? m.productoMP ?? m.Producto ?? {}
          const capacidad = Number(m.capacidadMax ?? m.capacidad_max ?? 15)
          return {
            key: String(m.idMapaMP ?? m.id ?? m.espiralCodigo),
            espiral: m.espiralCodigo ?? m.codigo ?? m.espiral ?? '?',
            productoNombre: prod.nombreProducto ?? prod.nombre ?? 'Producto',
            capacidad_max: capacidad,
            fisico_digitado: 0,
            cant_sugerida: capacidad,
            idMapaMp: Number(m.idMapaMP ?? m.id),
            idProducto: Number(prod.idProducto ?? prod.id),
          }
        })
        setEspirales(rowsEsp)

        const nrqArray = Array.isArray(mapaNrqRes) ? mapaNrqRes : (mapaNrqRes ? [mapaNrqRes] : [])
        const rowsNrq: NRQRow[] = nrqArray.map((b: any) => {
          const prod = b.productoTerminado ?? b.producto ?? b.ProductoTerminado ?? {}
          return {
            key: String(b.idMapaNRQ ?? b.id ?? b.opcionBoton),
            boton: b.opcionBoton ?? b.boton ?? b.codigo ?? 'B?',
            productoNombre: prod.nombreProducto ?? prod.nombre ?? 'Producto Dosificado',
            valor: 0,
            idMapaNrq: Number(b.idMapaNRQ ?? b.id),
          }
        })
        setBotones(rowsNrq)
      } catch (e: any) {
        message.error('Error cargando datos de la máquina')
      } finally {
        setLoading(false)
      }
    }
    cargarDatos()
  }, [id, usuario?.id])

  const maq = maquinaInfo ?? {
    id, serial: `MAQ-${id}`, zona: 'Cargando...', clienteNombre: 'Cargando...', tipo: 'SNACK' as const, ultimoNR: 0,
  }

  const diffNR = nrActual !== null ? nrActual - maq.ultimoNR : 0

  const totalSugeridas = useMemo(() => espirales.reduce((s, e) => s + (e.cant_sugerida || 0), 0), [espirales])
  const totalDigitado = useMemo(() => espirales.reduce((s, e) => s + (e.fisico_digitado || 0), 0), [espirales])

  const RECETA_HARDCODE: Record<string, Array<{ mp: string; gr: number; unit: string }>> = {
    'café negro': [{ mp: 'Café Molido', gr: 7, unit: 'g' }, { mp: 'Vaso Desechable', gr: 1, unit: 'und' }],
    'cafe negro': [{ mp: 'Café Molido', gr: 7, unit: 'g' }, { mp: 'Vaso Desechable', gr: 1, unit: 'und' }],
    'café con leche': [
      { mp: 'Café Molido', gr: 6, unit: 'g' }, { mp: 'Leche', gr: 100, unit: 'ml' },
      { mp: 'Vaso Desechable', gr: 1, unit: 'und' }, { mp: 'Azúcar', gr: 5, unit: 'g' },
    ],
    'cafe con leche': [
      { mp: 'Café Molido', gr: 6, unit: 'g' }, { mp: 'Leche', gr: 100, unit: 'ml' },
      { mp: 'Vaso Desechable', gr: 1, unit: 'und' }, { mp: 'Azúcar', gr: 5, unit: 'g' },
    ],
    'chocolate caliente': [
      { mp: 'Chocolate', gr: 15, unit: 'g' }, { mp: 'Leche', gr: 80, unit: 'ml' }, { mp: 'Vaso Desechable', gr: 1, unit: 'und' },
    ],
  }

  const consumoEstimado = useMemo(() => {
    const mapa: Record<string, { mp: string; total: number; unit: string }> = {}
    for (const b of botones) {
      const vendidas = b.valor || 0
      if (vendidas <= 0) continue
      const key = b.productoNombre.toLowerCase().trim()
      const match = Object.keys(RECETA_HARDCODE).find((k) => key.includes(k))
      if (!match) continue
      for (const r of RECETA_HARDCODE[match]) {
        const ant = mapa[r.mp] || { mp: r.mp, total: 0, unit: r.unit }
        ant.total += r.gr * vendidas
        mapa[r.mp] = ant
      }
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }, [botones])

  const totalNRQVendidas = useMemo(() => botones.reduce((s, b) => s + (b.valor || 0), 0), [botones])

  const colsEsp = [
    { title: 'Esp.', dataIndex: 'espiral', width: 70, render: (v: string) => <Tag color="blue" style={{ fontSize: 16, fontWeight: 'bold' }}>{v}</Tag> },
    {
      title: 'Producto',
      dataIndex: 'productoNombre',
      render: (v: string, r: EspiralRow) => (
        <div>
          <Text strong>{v}</Text>
          <div style={{ fontSize: 11, color: '#888' }}>Cap. Máx: {r.capacidad_max}</div>
        </div>
      ),
    },
    {
      title: (
        <span style={{ color: '#722ed1', fontWeight: 'bold' }}>
          Físico Digitado
        </span>
      ),
      dataIndex: 'fisico_digitado',
      width: 160,
      render: (_: any, r: EspiralRow, i: number) => (
        <InputNumber
          size="large"
          min={0}
          max={r.capacidad_max}
          value={r.fisico_digitado}
          style={{ width: '100%', fontWeight: 'bold', fontSize: 18 }}
          onChange={(v: any) => {
            const n = [...espirales]
            n[i] = { ...n[i], fisico_digitado: Number(v) || 0 }
            const sug = Math.max(0, r.capacidad_max - (Number(v) || 0))
            n[i].cant_sugerida = sug
            setEspirales(n)
          }}
        />
      ),
    },
    {
      title: 'Cant Sugerida',
      dataIndex: 'cant_sugerida',
      width: 110,
      align: 'center' as const,
      render: (v: number) => {
        if (v <= 0) return <Tag type="circle">0</Tag>
        return <Tag color="blue" style={{ fontSize: 15, fontWeight: 'bold' }}>+{v}</Tag>
      },
    },
  ]

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

  const canAdvanceStep1 = () => {
    if (maq.tipo === 'CAFE') return true
    if (totalDigitado === 0 && espirales.length > 0) {
      return false
    }
    return true
  }

  const canAdvanceStep2 = () => {
    if (nrActual === null || nrActual < maq.ultimoNR) return false
    if (maq.tipo === 'CAFE') {
      const total = botones.reduce((s, b) => s + (b.valor || 0), 0)
      if (total === 0 && botones.length > 0) return false
    }
    return true
  }

  const save = async (forceOffline = false) => {
    setSaving(true)
    setOfflineSaved(false)
    try {
      if (!idOperadorActual) {
        throw new Error('No se pudo identificar el operador asociado a este usuario.')
      }
      const dto = {
        idMaquina: Number(id),
        idOperador: Number(idOperadorActual),
        nrActual: nrActual ?? undefined,
        items: espirales
          .map((e) => ({
            idProducto: Number(e.idProducto!),
            idMapaMP: e.idMapaMp ? Number(e.idMapaMp) : undefined,
            fisicoDigitado: Number(e.fisico_digitado) || 0,
          }))
          .filter((x: any) => x.idProducto && !isNaN(x.idProducto)),
        nrqItems: botones
          .map((b) => ({
            idMapaNRQ: Number(b.idMapaNrq!),
            valor: Number(b.valor) || 0,
          }))
          .filter((x: any) => x.idMapaNRQ && !isNaN(x.idMapaNRQ) && x.valor > 0),
      }

      if (!forceOffline) {
        await apiService.post('/pedidos-operador', dto)
      } else {
        throw new Error('FORCE_OFFLINE')
      }
      setSavedOk(true)
      message.success('✅ Inventario enviado correctamente')
    } catch (e: any) {
      if (e?.message === 'No se pudo identificar el operador asociado a este usuario.') {
        message.error(e.message)
        setSaving(false)
        return
      }
      try {
        await offlineStore.addPending({
          maquinaId: id,
          maquinaSerial: maq.serial,
          espirales: espirales.map((e) => ({
            espiral: e.espiral,
            fisico: e.fisico_digitado,
            sugerida: e.cant_sugerida,
            idMapaMp: e.idMapaMp,
            idProducto: e.idProducto,
          })),
          nr_actual: nrActual || 0,
          nrq: botones.map((b) => ({ boton: b.boton, valor: b.valor, idMapaNrq: b.idMapaNrq })),
          idOperador: idOperadorActual ?? undefined,
          savedAt: Date.now(),
        } as any)
      } catch { /* ignore */ }
      setOfflineSaved(true)
      setSavedOk(true)
      message.warning('📴 Sin conexión: Guardado OFFLINE. Sincronizará luego.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" tip="Cargando máquina..." />
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
            : `Inventario para ${maq.serial} procesado. ${totalSugeridas} unidades sugeridas para despacho.`
        }
        extra={[
          <Button type="primary" size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile/maquinas')}>
            Volver a Lista Máquinas
          </Button>,
          offlineSaved ? (
            <Button size="large" icon={<SyncOutlined />} onClick={() => navigate('/mobile/maquinas')}>
              Sincronizar luego
            </Button>
          ) : null,
        ]}
      />
    )
  }

  return (
    <div style={{
      padding: '8px 10px 24px',
      maxWidth: 620,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <Button type="link" onClick={() => navigate('/mobile/maquinas')} icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 4, fontSize: 12 }}>
        Volver a máquinas
      </Button>

      <Card size="small" style={{ marginBottom: 10, background: '#f0f5ff' }}>
        <Row gutter={12}>
          <Col xs={12}>
            <Text strong style={{ fontSize: 17 }}>{maq.serial}</Text>
            <div style={{ fontSize: 12, color: '#555' }}>📍 {maq.zona}</div>
            <div style={{ fontSize: 12, color: '#555' }}>🏢 {maq.clienteNombre}</div>
          </Col>
          <Col xs={12} style={{ textAlign: 'right' }}>
            <Tag color="geekblue" style={{ fontSize: 13 }}>{maq.tipo}</Tag>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              NR Anterior: <strong>{maq.ultimoNR}</strong>
            </div>
          </Col>
        </Row>
      </Card>

      <Steps
        size="small"
        current={step}
        items={[
          { title: espirales.length > 0 ? 'Espirales' : botones.length > 0 ? 'Productos' : 'Inventario' },
          { title: 'Contadores NR/NRQ' },
          { title: 'Guardar' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {step === 0 && (
        <div>
          {espirales.length > 0 ? (
            <>
              <Card size="small" style={{ marginBottom: 10 }}>
                <Row gutter={8}>
                  <Col xs={12}>
                    <Statistic title="Sugeridas" value={totalSugeridas} valueStyle={{ color: '#1677ff', fontSize: 22 }} />
                  </Col>
                  <Col xs={12}>
                    <Statistic title="Físico Digitado" value={totalDigitado} valueStyle={{ color: '#722ed1', fontSize: 22 }} />
                  </Col>
                </Row>
              </Card>
              <Alert
                type="info"
                showIcon
                message="💡 Digita la cantidad que hay ACTUALMENTE en cada espiral. El sistema calcula automáticamente la Cantidad Sugerida para llenar a Capacidad Máxima."
                style={{ marginBottom: 8 }}
              />
              <Table
                size="small"
                rowKey="key"
                dataSource={espirales}
                columns={colsEsp}
                pagination={false}
                scroll={{ y: 500, x: 'max-content' }}
              />
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              message={`Máquina tipo ${maq.tipo} sin espirales de productos. Continúa al siguiente paso para registrar Contadores NRQ.`}
            />
          )}

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              disabled={!canAdvanceStep1()}
              onClick={() => setStep(1)}
            >
              Siguiente: Contadores
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
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
                    <div style={{ fontSize: 20, fontWeight: 'bold' }}>{maq.ultimoNR}</div>
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

              {maq.tipo === 'CAFE' && botones.length > 0 && (
                <>
                  <Divider />
                  <div>
                    <Text strong style={{ fontSize: 16, color: '#722ed1' }}>
                      ☕ Contadores NRQ por Botón (Dosificadora)
                    </Text>
                    <Divider style={{ margin: '6px 0' }} />
                    <Table
                      size="small"
                      rowKey="key"
                      dataSource={botones}
                      columns={colsNRQ}
                      pagination={false}
                      scroll={{ y: 400, x: 'max-content' }}
                    />
                    {consumoEstimado.length > 0 && (
                      <Card size="small" title="🧪 Vista previa: Materia Prima consumida" style={{ marginTop: 10, background: '#fffbe6', borderColor: '#ffe58f' }}>
                        {consumoEstimado.map((c, i) => (
                          <Row key={i} gutter={6} align="middle" style={{ padding: '3px 0', borderBottom: i < consumoEstimado.length - 1 ? '1px dashed #ffd591' : undefined }}>
                            <Col xs={10}><Text strong style={{ fontSize: 12 }}>{c.mp}</Text></Col>
                            <Col xs={7} style={{ textAlign: 'right' }}>
                              <Tag color="orange" style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>
                                {c.total.toLocaleString('es-CO')} {c.unit}
                              </Tag>
                            </Col>
                            <Col xs={7} style={{ textAlign: 'right', fontSize: 11, color: '#ad4e00', fontWeight: 600 }}>
                              ={c.unit === 'und' ? Math.ceil(c.total/30) : c.unit === 'ml' ? Math.ceil(c.total/1000) : Math.ceil(c.total/500)} {c.unit === 'und' ? 'paq' : c.unit === 'ml' ? 'caja' : 'bolsa'}
                            </Col>
                          </Row>
                        ))}
                      </Card>
                    )}
                  </div>
                </>
              )}
            </Space>
          </Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>
              Atrás
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              disabled={!canAdvanceStep2()}
              onClick={() => setStep(2)}
            >
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <Card title="Revisar y Guardar Inventario" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              <Row gutter={6}>
                <Col xs={12}><Card size="small" style={{ padding: 8 }}><Statistic title="Espirales" value={espirales.length} valueStyle={{ fontSize: 20 }} /></Card></Col>
                <Col xs={12}><Card size="small" style={{ padding: 8 }}><Statistic title="Unid. Sugeridas" value={totalSugeridas} valueStyle={{ color: '#1677ff', fontSize: 20 }} /></Card></Col>
                <Col xs={12}><Card size="small" style={{ padding: 8 }}><Statistic title="NR Ant→Act" value={`${maq.ultimoNR}→${nrActual ?? '-'}`} valueStyle={{ fontSize: 16 }} /></Card></Col>
                <Col xs={12}><Card size="small" style={{ padding: 8 }}><Statistic title="Venta NR (total)" value={diffNR} valueStyle={{ color: diffNR >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 20 }} prefix={diffNR >= 0 ? '+' : ''} /></Card></Col>
              </Row>
              {maq.tipo === 'CAFE' && totalNRQVendidas > 0 && (
                <Alert
                  type="info"
                  showIcon
                  message={`☕ ${totalNRQVendidas} bebidas NRQ vendidas en ${botones.filter((b) => b.valor > 0).length} botón(es)`}
                />
              )}
              {maq.tipo === 'CAFE' && consumoEstimado.length > 0 && (
                <Card size="small" title="🧪 Desgloce Materia Prima (consumo estimado x bebidas)" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={6}>
                    {consumoEstimado.map((c, i) => {
                      const sugeridoCompra = c.unit === 'und'
                        ? Math.ceil(c.total / 30) + ' paq. 30und'
                        : c.unit === 'ml'
                        ? Math.ceil(c.total / 1000) + ' caja(s) 1L'
                        : c.mp.toLowerCase().includes('azucar') || c.mp.toLowerCase().includes('chocolate')
                        ? (Math.ceil(c.total / 500)) + ' bolsa(s) 500g'
                        : (Math.ceil(c.total / 500)) + ' bolsa(s) 500g'
                      return (
                        <Row key={i} gutter={8} align="middle" style={{ padding: '3px 0', borderBottom: i < consumoEstimado.length - 1 ? '1px dashed #d9d9d9' : undefined }}>
                          <Col xs={10}><Text strong>{c.mp}</Text></Col>
                          <Col xs={7} style={{ textAlign: 'right' }}>
                            <Tag color="orange" style={{ fontSize: 13, fontWeight: 'bold' }}>
                              {c.total.toLocaleString('es-CO')} {c.unit}
                            </Tag>
                          </Col>
                          <Col xs={7} style={{ textAlign: 'right', fontSize: 12, color: '#135200', fontWeight: 600 }}>
                            ≈ {sugeridoCompra}
                          </Col>
                        </Row>
                      )
                    })}
                  </Space>
                </Card>
              )}
              {!idOperadorActual && (
                <Alert type="warning" showIcon message="⚠️ No se pudo resolver el operador para este usuario. Verifica que el usuario esté asociado a un Operador en la BD." />
              )}
            </Space>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Button type="primary" size="large" loading={saving} icon={<SaveOutlined />} onClick={() => save()} disabled={!idOperadorActual}>
              💾 Guardar Inventario (Online)
            </Button>
            <Button size="large" loading={saving} icon={<SyncOutlined />} onClick={() => save(true)} disabled={!idOperadorActual}>
              📴 Guardar Offline (Simular)
            </Button>
            <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep(1)}>
              Corregir Paso 2
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventarioMobile
