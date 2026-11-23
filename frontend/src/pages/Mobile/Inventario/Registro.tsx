import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, InputNumber, Modal, Result, Space, Spin, Steps, Typography, message } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { apiService } from '../../../api/services/api'
import { useAuth } from '../../../hooks/useAuth'

type Espiral = { idMapaMp: number; idProducto: number; espiralCodigo: string; capacidadMax: number; porcentajeCliente: number; producto: { nombreProducto: string; tipoProducto: string; unidadCompra: string } }
type Boton = { idMapaNrq: number; idProdTerm: number; opcionBoton: string; porcentajeCliente: number; productoTerminado: { nombreProducto: string } }
type Lecturas = {
  ultimaVisitaId: number; nrEfectivo: number | string
  botones: { idMapaNrq: number; lectura: number | string }[]
  nrqEspirales: { idMapaMp: number; lectura: number | string }[]
  espirales: { idMapaMp: number; idProducto: number; fisicoDigitado: number; despachado: number }[]
  precios: { idProducto: number; precio: number }[]
  umbralDiferenciaVenta: number
}
type Maquina = { serial: string; idOperador: number | null; ubicacionEsp?: string; mapaMateriaPrima: Espiral[]; mapaCafeNrq: Boton[]; tipoNegociacion: string; lecturaNrqEspiral: string }
type Datos = { maquina: Maquina; lecturas: Lecturas; idOperador: number | null }
type Registro = Record<string, number | null>
const entero = (n: number | null | undefined) => n != null && Number.isSafeInteger(n) && n >= 0
const formato = (n: number) => n.toLocaleString('es-CO')

export default function InventarioMobile() {
  const { idMaquina } = useParams()
  const id = Number(idMaquina)
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState<Datos>()
  const [paso, setPaso] = useState(0)
  const [fisicos, setFisicos] = useState<Registro>({})
  const [contadores, setContadores] = useState<Registro>({})
  const [reinicio, setReinicio] = useState(false)
  const [esCorteMes, setEsCorteMes] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [idRegistro, setIdRegistro] = useState(() => crypto.randomUUID())
  const [guardado, setGuardado] = useState(false)
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [error, setError] = useState('')

  const cargar = async () => {
    setCargando(true)
    setError('')
    try {
      const [maquina, lecturas, operadores] = await Promise.all([
        apiService.get<Maquina>(`/maquinas/${id}`),
        apiService.get<Lecturas>(`/maquinas/${id}/ultimas-lecturas`),
        apiService.get<{ idUsuario: number; idOperador: number }[]>('/operadores').catch(() => []),
      ])
      const idOperador = (Array.isArray(operadores) ? operadores : []).find(o => o.idUsuario === Number(usuario?.idUsuario ?? usuario?.id))?.idOperador
        ?? maquina.idOperador
      setDatos({ maquina, lecturas, idOperador })
    } catch {
      setError('No se pudieron cargar los datos de la máquina. Comprueba tu conexión e inténtalo de nuevo.')
    } finally { setCargando(false) }
  }

  useEffect(() => {
    setDatos(undefined)
    setPaso(0)
    setFisicos({})
    setContadores({})
    setReinicio(false)
    setEsCorteMes(false)
    setGuardado(false)
    setIdRegistro(crypto.randomUUID())
    void cargar()
  }, [id, usuario?.id])

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  if (cargando) return <Spin />
  if (!datos) return <Alert type="error" showIcon message={error} action={<Button onClick={cargar}>Recargar</Button>} />
  const { maquina, lecturas, idOperador } = datos
  if (guardado) return <Result status="success" title="Visita registrada" subTitle={maquina.serial} extra={<Button onClick={() => navigate('/mobile/home')}>Volver a máquinas</Button>} />

  const espirales = maquina.mapaMateriaPrima ?? []
  const nrqEspirales = maquina.tipoNegociacion === 'ESPECIAL' && (esCorteMes || maquina.lecturaNrqEspiral === 'CADA_VISITA')
    ? espirales.filter(e => e.producto.tipoProducto === 'ESTANDAR') : []
  const lista = [
    { key: 'nr', nombre: 'NR efectivo (COP)', anterior: Number(lecturas.nrEfectivo) },
    ...(maquina.mapaCafeNrq ?? []).map(b => ({
      key: `nrq-${b.idMapaNrq}`, nombre: `NRQ ${b.opcionBoton} · ${b.productoTerminado.nombreProducto}`,
      anterior: Number(lecturas.botones.find(l => l.idMapaNrq === b.idMapaNrq)?.lectura ?? 0),
    })),
  ].map(l => {
    const actual = contadores[l.key] ?? null
    return { ...l, actual, diferencia: actual == null ? null : reinicio ? actual : actual - l.anterior }
  })
  const fisicoValido = espirales.every(e => entero(fisicos[e.idMapaMp]) && fisicos[e.idMapaMp]! <= e.capacidadMax)
  const contadoresValidos = lista.every(l => entero(l.actual) && l.diferencia! >= 0 && Number.isSafeInteger(l.anterior))
  const controles = espirales.filter(e => e.producto.tipoProducto === 'ESTANDAR').map(e => {
    const anterior = lecturas.espirales.find(p => p.idMapaMp === e.idMapaMp && p.idProducto === e.idProducto)
    const actual = fisicos[e.idMapaMp]
    const unidades = anterior && actual != null ? anterior.fisicoDigitado + anterior.despachado - actual : null
    const precio = lecturas.precios.find(p => p.idProducto === e.idProducto)?.precio
    return { ...e, unidades, precio }
  })
  const lineasVenta = [
    ...controles,
    ...(maquina.mapaCafeNrq ?? []).map(b => ({
      unidades: lista.find(l => l.key === `nrq-${b.idMapaNrq}`)?.diferencia,
      precio: lecturas.precios.find(p => p.idProducto === b.idProdTerm)?.precio,
      porcentajeCliente: b.porcentajeCliente,
    })),
    ...nrqEspirales.map(e => ({
      key: `nrq-espiral-${e.idMapaMp}`, nombre: `NRQ espiral ${e.espiralCodigo} · ${e.producto.nombreProducto}`,
      anterior: Number(lecturas.nrqEspirales?.find(l => l.idMapaMp === e.idMapaMp)?.lectura ?? 0),
    })),
  ]
  const comparable = lineasVenta.length > 0 && lineasVenta.every(c => c.unidades != null && c.unidades >= 0 && c.precio != null)
  const diferenciaVenta = comparable && lista[0].diferencia != null
    ? lista[0].diferencia - lineasVenta.reduce((total, c) => total + (c.unidades ?? 0) * (c.precio ?? 0) * (1 - Number(c.porcentajeCliente ?? 0) / 100), 0) : null
  const guardar = async () => {
    if (!idOperador || !navigator.onLine || !fisicoValido || !contadoresValidos || guardando) return
    setGuardando(true)
    setError('')
    try {
      await apiService.post('/pedidos-operador', {
        idMaquina: id, idOperador, idOffline: idRegistro, ultimaVisitaId: lecturas.ultimaVisitaId,
        nrEfectivoActual: contadores.nr, reinicioContador: reinicio, esCorteMes,
        items: espirales.map(e => ({ idProducto: e.idProducto, idMapaMP: e.idMapaMp, fisicoDigitado: fisicos[e.idMapaMp] })),
        nrqLecturas: [
          ...(maquina.mapaCafeNrq ?? []).map(b => ({ idMapaNRQ: b.idMapaNrq, lecturaActual: contadores[`nrq-${b.idMapaNrq}`] })),
          ...nrqEspirales.map(e => ({ idMapaMP: e.idMapaMp, lecturaActual: contadores[`nrq-espiral-${e.idMapaMp}`] })),
        ],
      })
      setGuardado(true)
      message.success('Visita registrada')
    } catch (e: any) {
      const msg = e?.response?.data?.message
      setError(Array.isArray(msg) ? msg.join('. ') : msg ?? 'No se pudo confirmar. Los datos siguen en pantalla; comprueba la conexión y reintenta.')
    } finally { setGuardando(false) }
  }

  return <Space direction="vertical" style={{ width: '100%' }} size="middle">
    <Button onClick={() => navigate('/mobile/home')}>Volver a máquinas</Button>
    <Typography.Title level={4}>{maquina.serial} {maquina.ubicacionEsp}</Typography.Title>
    <Steps current={paso} size="small" items={[{ title: 'Físico' }, { title: 'Contadores' }, { title: 'Resumen' }]} />
    {!enLinea && <Alert type="warning" showIcon message="Sin conexión. Para registrar una visita debes estar en línea." />}
    {error && <Alert type="error" showIcon message={error} action={<Button onClick={cargar}>Actualizar lecturas</Button>} />}
    {paso === 0 && <>
      {!espirales.length && <Alert type="info" message="No hay espirales configurados. Puedes continuar a los contadores." />}
      {espirales.map(e => <Card key={e.idMapaMp} size="small" title={`${e.espiralCodigo} · ${e.producto.nombreProducto}`}>
        <Space wrap>{e.producto.tipoProducto === 'MATERIA_PRIMA' ? `Físico (${e.producto.unidadCompra})` : 'Físico'} <InputNumber min={0} max={e.capacidadMax} precision={0} value={fisicos[e.idMapaMp] ?? null}
          onChange={(v: number | null) => setFisicos(r => ({ ...r, [e.idMapaMp]: v }))} />
          Capacidad: {e.capacidadMax} · Pedido: {entero(fisicos[e.idMapaMp]) ? Math.max(0, e.capacidadMax - fisicos[e.idMapaMp]!) : '—'}</Space>
      </Card>)}
    </>}
    {paso === 1 && <>
      {(maquina.tipoNegociacion === 'ESPECIAL' || (maquina.mapaCafeNrq ?? []).length > 0) &&
        <Checkbox checked={esCorteMes} onChange={(e: { target: { checked: boolean } }) => setEsCorteMes(e.target.checked)}>Corte de mes</Checkbox>}
      <Checkbox checked={reinicio} onChange={() => {
        if (reinicio) setReinicio(false)
        else Modal.confirm({ title: '¿Se reiniciaron los contadores?', content: 'Las lecturas nuevas se registrarán como el consumo desde el reinicio.', onOk: () => setReinicio(true) })
      }}>Confirmar reinicio de contadores</Checkbox>
      {lista.map(l => <Card key={l.key} size="small" title={l.nombre}>
        <Space direction="vertical">Anterior: {formato(l.anterior)}
          <InputNumber min={0} precision={0} max={Number.MAX_SAFE_INTEGER} placeholder="Lectura actual"
            value={l.actual} onChange={(v: number | null) => setContadores(r => ({ ...r, [l.key]: v }))} />
          Diferencia: {l.diferencia == null ? '—' : formato(l.diferencia)}
          {l.diferencia != null && l.diferencia < 0 && <Alert type="error" message="La lectura es menor que la anterior. Revisa el valor o confirma el reinicio." />}
        </Space>
      </Card>)}
    </>}
    {paso === 2 && <>
      {esCorteMes && <Alert type="info" showIcon message="Esta visita quedará marcada como corte de mes." />}
      {reinicio && <Alert type="warning" showIcon message="Esta visita se registrará con reinicio confirmado." />}
      {!idOperador && <Alert type="error" showIcon message="No existe operador asociado a esta visita." />}
      {controles.filter(c => c.unidades != null && c.unidades < 0).map(c =>
        <Alert key={c.idMapaMp} type="warning" showIcon message={`Espiral ${c.espiralCodigo}: el cruce de inventario da ${c.unidades} unidades vendidas. Revisa el físico digitado.`} />)}
      {diferenciaVenta != null && Math.abs(diferenciaVenta) >= Math.max(0.01, lecturas.umbralDiferenciaVenta) &&
        <Alert type="warning" showIcon message={`El NR efectivo difiere en $${formato(diferenciaVenta)} COP de la venta teórica de la máquina.`} />}
      <Card title="Físicos y pedido" size="small">{espirales.map(e =>
        <div key={e.idMapaMp}>{e.espiralCodigo} · {e.producto.nombreProducto}: físico {fisicos[e.idMapaMp]}, pedido {e.capacidadMax - (fisicos[e.idMapaMp] ?? 0)}{e.producto.tipoProducto === 'MATERIA_PRIMA' && ` (${e.producto.unidadCompra})`}</div>)}</Card>
      <Card title="Lecturas y diferencias" size="small">{lista.map(l =>
        <div key={l.key}><strong>{l.nombre}</strong>: anterior {formato(l.anterior)}, actual {l.actual == null ? '—' : formato(l.actual)}, diferencia {l.diferencia == null ? '—' : formato(l.diferencia)}</div>)}</Card>
    </>}
    <Space wrap>
      {paso > 0 && <Button disabled={guardando} onClick={() => setPaso(paso - 1)}>Atrás</Button>}
      {paso < 2 ? <Button type="primary" disabled={paso === 0 ? !fisicoValido : !contadoresValidos} onClick={() => setPaso(paso + 1)}>
        {paso === 0 ? 'Siguiente: contadores' : 'Revisar resumen'}
      </Button> : <Button type="primary" loading={guardando} disabled={!enLinea || !idOperador} onClick={guardar}>Confirmar y enviar</Button>}
    </Space>
  </Space>
}
