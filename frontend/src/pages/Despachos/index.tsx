import { useState, useEffect, useMemo } from 'react'
import {
  Collapse,
  Card,
  Button,
  Input,
  Space,
  message,
  Table,
  InputNumber,
  Tag,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Modal,
  Badge,
  Typography,
  Spin,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  SendOutlined,
  InboxOutlined,
  FileTextOutlined,
  SearchOutlined,
  SettingOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { apiService } from '../../api/services/api'

const { Title } = Typography
const { Panel } = Collapse as any
const { Option } = Select

type EstadoPedido = 'PENDIENTE' | 'PARCIAL' | 'APROBADO' | 'RECHAZADO'

interface FilaPedido {
  idPedido: number
  idMaquina: number
  idOperador: number
  idProducto: number
  idMapaMp?: number | null
  fechaHora: string
  fisicoDigitado: number
  cantSugerida: number
  nrActualMedido?: string | null
  estado: EstadoPedido
  observaciones?: string | null
  serial?: string | null
  ubicacionEsp?: string | null
  nombreCompletoOperador?: string | null
  nombreProducto?: string | null
  totalDespachado?: number
}

interface ItemDespachoEdit {
  idPedido: number
  idProducto: number
  nombreProducto: string
  fisicoDigitado: number
  cantSugerida: number
  cantDespachada: number
  totalDespachadoPrevio: number
  stockActualProducto?: number
  espiralCodigo?: string | null
}

interface PedidoAgrupado {
  idMaquina: number
  serial: string
  ubicacionEsp: string
  clienteNombre?: string
  operadorNombre: string
  idOperador: number
  fechaPrimerPedido: string
  items: ItemDespachoEdit[]
  estado: 'PENDIENTE' | 'PARCIAL'
  collapsed?: boolean
}

const estadoColor: Record<EstadoPedido, string> = {
  PENDIENTE: 'orange',
  PARCIAL: 'blue',
  APROBADO: 'green',
  RECHAZADO: 'red',
}

const parseToIsoSafe = (v: any): string => {
  if (!v) return new Date(0).toISOString()
  const d = new Date(v)
  if (!isNaN(d.getTime())) return d.toISOString()
  if (typeof v === 'string') {
    const d2 = new Date(v.replace(' ', 'T'))
    if (!isNaN(d2.getTime())) return d2.toISOString()
  }
  return new Date(0).toISOString()
}

const fmtFechaSafe = (v: any, opts?: Intl.DateTimeFormatOptions): string => {
  if (!v) return 'Sin fecha'
  const d = new Date(v)
  if (isNaN(d.getTime())) {
    if (typeof v === 'string') {
      const d2 = new Date(v.replace(' ', 'T'))
      if (!isNaN(d2.getTime())) return d2.toLocaleString('es-CO', opts ?? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    }
    return typeof v === 'string' ? v : 'Fecha inválida'
  }
  return d.toLocaleString('es-CO', opts ?? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const normalizarFila = (raw: any): FilaPedido => {
  return {
    idPedido: raw.idPedido ?? raw.id_pedido ?? raw.ID_Pedido ?? raw['ID_Pedido'] ?? -1,
    idMaquina: raw.idMaquina ?? raw.id_maquina ?? raw.ID_Maquina ?? raw['ID_Maquina'] ?? -1,
    idOperador: raw.idOperador ?? raw.id_operador ?? raw.ID_Operador ?? raw['ID_Operador'] ?? -1,
    idProducto: raw.idProducto ?? raw.id_producto ?? raw.ID_Producto ?? raw['ID_Producto'] ?? -1,
    idMapaMp: raw.idMapaMp ?? raw.id_mapa_mp ?? raw.ID_Mapa_MP ?? raw['ID_Mapa_MP'] ?? null,
    fechaHora: parseToIsoSafe(
      raw.fechaHora ?? raw.fecha_hora ?? raw.Fecha_Hora ?? raw['Fecha_Hora'] ?? null,
    ),
    fisicoDigitado: Number(
      raw.fisicoDigitado ?? raw.fisico_digitado ?? raw.Fisico_Digitado ?? raw['Fisico_Digitado'] ?? 0,
    ),
    cantSugerida: Number(
      raw.cantSugerida ?? raw.cant_sugerida ?? raw.Cant_Sugerida ?? raw['Cant_Sugerida'] ?? 0,
    ),
    nrActualMedido:
      raw.nrActualMedido ??
      raw.nr_actual_medido ??
      raw.NR_Actual_Medido ??
      raw['NR_Actual_Medido'] ??
      null,
    estado: (raw.estado ?? raw.Estado ?? 'PENDIENTE') as EstadoPedido,
    observaciones:
      raw.observaciones ?? raw.Observaciones ?? raw['Observaciones'] ?? null,
    serial:
      raw.serial ?? raw.Serial ?? raw['Serial'] ?? raw['Ubicacion_Fisica'] ?? `Máq #${raw.idMaquina ?? raw['ID_Maquina'] ?? '?'}`,
    ubicacionEsp:
      raw.ubicacionEsp ?? raw.ubicacion_esp ?? raw.Ubicacion_Esp ?? raw['Ubicacion_Esp'] ?? 'Sin ubicación',
    nombreCompletoOperador:
      raw.nombreCompletoOperador ?? raw.operadorNombre ?? raw.Nombre_Completo ?? raw['Nombre_Completo'] ?? 'Operador sin asignar',
    nombreProducto:
      raw.nombreProducto ?? raw.Nombre_Producto ?? raw['Nombre_Producto'] ?? `Producto #${raw.idProducto ?? raw['ID_Producto']}`,
    totalDespachado: Number(
      raw.totalDespachado ?? raw.total_despachado ?? raw.totalDespachada ?? raw.total_despachada ?? 0,
    ),
  }
}

const agruparPorMaquina = (filas: FilaPedido[], productosStockMap: Record<number, number>): PedidoAgrupado[] => {
  const map = new Map<number, PedidoAgrupado>()
  for (const f of filas) {
    const stock = productosStockMap[f.idProducto] ?? 0
    const item: ItemDespachoEdit = {
      idPedido: f.idPedido,
      idProducto: f.idProducto,
      nombreProducto: f.nombreProducto ?? `Producto ${f.idProducto}`,
      fisicoDigitado: f.fisicoDigitado,
      cantSugerida: f.cantSugerida,
      totalDespachadoPrevio: f.totalDespachado ?? 0,
      cantDespachada: Math.max(0, f.cantSugerida - (f.totalDespachado ?? 0)),
      stockActualProducto: stock,
    }
    if (item.cantDespachada > stock) item.cantDespachada = stock
    if (item.cantDespachada < 0) item.cantDespachada = 0

    if (!map.has(f.idMaquina)) {
      map.set(f.idMaquina, {
        idMaquina: f.idMaquina,
        serial: f.serial ?? `Máq #${f.idMaquina}`,
        ubicacionEsp: f.ubicacionEsp ?? '',
        operadorNombre: f.nombreCompletoOperador ?? '',
        idOperador: f.idOperador,
        fechaPrimerPedido: f.fechaHora,
        items: [],
        estado: 'PENDIENTE',
      })
    }
    const grupo = map.get(f.idMaquina)!
    grupo.items.push(item)
    if (item.totalDespachadoPrevio > 0) grupo.estado = 'PARCIAL'
    if (f.fechaHora < grupo.fechaPrimerPedido) grupo.fechaPrimerPedido = f.fechaHora
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.fechaPrimerPedido).getTime() - new Date(b.fechaPrimerPedido).getTime(),
  )
}

const Despachos = () => {
  const { usuario } = useAuth()
  const perm = usePermissions('despachos')
  const [cargando, setCargando] = useState(true)
  const [filasRaw, setFilasRaw] = useState<FilaPedido[]>([])
  const [grupos, setGrupos] = useState<PedidoAgrupado[]>([])
  const [procesandoMaq, setProcesandoMaq] = useState<Record<number, boolean>>({})
  const [openReport, setOpenReport] = useState(false)
  const [filtroBuscar, setFiltroBuscar] = useState('')
  const [filtroOperador, setFiltroOperador] = useState<number | undefined>()

  const cargar = async (silent = false) => {
    try {
      if (!silent) setCargando(true)
      const [pendientesRes, productosRes] = await Promise.all([
        apiService.get<any[]>('/despachos/pendientes'),
        apiService.get<any[]>('/productos?limit=1000').catch(() => [] as any[]),
      ])
      const normalizadas = Array.isArray(pendientesRes)
        ? pendientesRes.map(normalizarFila).filter((p) => p.idPedido > 0)
        : []
      const stockMap: Record<number, number> = {}
      const productosList = Array.isArray(productosRes)
        ? productosRes
        : Array.isArray(productosRes?.data)
          ? productosRes.data
          : []
      productosList.forEach((p: any) => {
        const id = p.idProducto ?? p.id_producto ?? p.ID_Producto ?? p['ID_Producto']
        const stock = Number(
          p.stockActual ?? p.stock_actual ?? p.Stock_Actual ?? p['Stock_Actual'] ?? 0,
        )
        if (id) stockMap[id] = stock
      })
      setFilasRaw(normalizadas)
      setGrupos(agruparPorMaquina(normalizadas, stockMap))
    } catch (e: any) {
      console.error('[Despachos] error cargar:', e)
      message.error(
        `Error al cargar despachos pendientes: ${e?.response?.data?.message ?? e?.message ?? 'desconocido'}`,
      )
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gruposFiltrados = useMemo(() => {
    let arr = grupos
    if (filtroBuscar.trim()) {
      const q = filtroBuscar.trim().toLowerCase()
      arr = arr.filter(
        (g) =>
          g.serial.toLowerCase().includes(q) ||
          g.ubicacionEsp.toLowerCase().includes(q) ||
          g.operadorNombre.toLowerCase().includes(q) ||
          g.items.some((i) => i.nombreProducto.toLowerCase().includes(q)),
      )
    }
    if (filtroOperador != null) {
      arr = arr.filter((g) => g.idOperador === filtroOperador)
    }
    return arr
  }, [grupos, filtroBuscar, filtroOperador])

  const totalMaquinasPendientes = gruposFiltrados.length
  const totalUnidSugeridas = gruposFiltrados.reduce(
    (s, g) => s + g.items.reduce((a, it) => a + it.cantSugerida, 0),
    0,
  )
  const totalUnidPendientes = gruposFiltrados.reduce(
    (s, g) => s + g.items.reduce((a, it) => a + Math.max(0, it.cantSugerida - it.totalDespachadoPrevio), 0),
    0,
  )

  const actualizarCant = (idMaquina: number, idPedido: number, qty: number) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g.idMaquina === idMaquina
          ? {
              ...g,
              items: g.items.map((it) =>
                it.idPedido === idPedido ? { ...it, cantDespachada: Math.max(0, Number(qty) || 0) } : it,
              ),
            }
          : g,
      ),
    )
  }

  const ajustarASugerido = (idMaquina: number) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g.idMaquina === idMaquina
          ? {
              ...g,
              items: g.items.map((it) => {
                const faltante = Math.max(0, it.cantSugerida - it.totalDespachadoPrevio)
                const desp = Math.min(faltante, it.stockActualProducto ?? Number.MAX_SAFE_INTEGER)
                return { ...it, cantDespachada: desp }
              }),
            }
          : g,
      ),
    )
  }

  const marcarACero = (idMaquina: number) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g.idMaquina === idMaquina
          ? { ...g, items: g.items.map((it) => ({ ...it, cantDespachada: 0 })) }
          : g,
      ),
    )
  }

  const confirmar = async (grupo: PedidoAgrupado) => {
    if (!usuario?.idUsuario) {
      message.error('No hay sesión de usuario (idUsuario). Re-inicia sesión.')
      return
    }
    const items = grupo.items.filter((i) => i.cantDespachada > 0)
    if (items.length === 0) {
      message.warning('No hay cantidades seleccionadas para despachar en esta máquina.')
      return
    }
    for (const it of items) {
      if (it.cantDespachada > (it.stockActualProducto ?? Number.MAX_SAFE_INTEGER)) {
        message.error(
          `${it.nombreProducto}: Cantidad despachada ${it.cantDespachada} supera el stock actual (${it.stockActualProducto}).`,
        )
        return
      }
    }
    try {
      setProcesandoMaq((p) => ({ ...p, [grupo.idMaquina]: true }))
      const body = {
        idUsuario: Number(usuario.idUsuario),
        items: items.map((i) => ({
          idPedido: i.idPedido,
          cantDespachada: i.cantDespachada,
          observaciones: `Despacho ${grupo.serial} - ${i.nombreProducto}`,
        })),
      }
      const res = await apiService.post('/despachos', body)
      const creados = res?.total ?? Array.isArray(res?.despachos) ? res.despachos.length : 0
      message.success(
        `✅ Despacho confirmado: ${creados} línea(s) procesada(s). Stock descontado automáticamente.`,
      )
      await cargar(true)
    } catch (e: any) {
      console.error('[Despachos] confirmar error:', e)
      message.error(
        `Error al confirmar despacho: ${e?.response?.data?.message ?? e?.message ?? 'desconocido'}`,
      )
    } finally {
      setProcesandoMaq((p) => ({ ...p, [grupo.idMaquina]: false }))
    }
  }

  const operadoresUnicos = useMemo(() => {
    const set = new Map<number, string>()
    grupos.forEach((g) => set.set(g.idOperador, g.operadorNombre))
    return Array.from(set.entries()).map(([id, n]) => ({ id, nombre: n }))
  }, [grupos])

  const reportData = gruposFiltrados.flatMap((g) =>
    g.items.map((it, idx) => ({
      key: `${g.idMaquina}-${it.idPedido}-${idx}`,
      pedidoId: it.idPedido,
      idMaquina: g.idMaquina,
      maquina: g.serial,
      zona: g.ubicacionEsp,
      operador: g.operadorNombre,
      producto: it.nombreProducto,
      fisico: it.fisicoDigitado,
      sugerida: it.cantSugerida,
      prevDesp: it.totalDespachadoPrevio,
      despachar: it.cantDespachada,
      stockActual: it.stockActualProducto ?? 0,
      estadoGrupo: g.estado,
      fecha: g.fechaPrimerPedido,
    })),
  )

  const genColumns = (grupo: PedidoAgrupado) => [
    {
      title: 'Producto',
      dataIndex: 'nombreProducto',
      key: 'p',
      render: (v: string, r: ItemDespachoEdit) => (
        <Space direction="vertical" size={0}>
          <strong>{v}</strong>
          <span style={{ color: '#888', fontSize: 12 }}>Pedido #{r.idPedido}</span>
        </Space>
      ),
    },
    {
      title: 'Físico Digitado',
      dataIndex: 'fisicoDigitado',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Cant Sugerida',
      dataIndex: 'cantSugerida',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Previ. Despachado',
      dataIndex: 'totalDespachadoPrevio',
      width: 140,
      align: 'center' as const,
      render: (v: number) =>
        v > 0 ? (
          <Tag color="geekblue">
            <CheckCircleOutlined /> {v}
          </Tag>
        ) : (
          <Tag color="default">— 0 —</Tag>
        ),
    },
    {
      title: 'Stock Actual (Bodega)',
      dataIndex: 'stockActualProducto',
      width: 160,
      align: 'center' as const,
      render: (v: number | undefined, r: ItemDespachoEdit) => {
        const stock = v ?? 0
        const porDespachar = Math.max(0, r.cantSugerida - r.totalDespachadoPrevio)
        const ok = stock >= porDespachar
        return (
          <Tooltip
            title={
              ok
                ? `Stock suficiente: faltan ${porDespachar}, hay ${stock}`
                : `⚠️ Stock INSUFICIENTE: faltan ${porDespachar}, solo hay ${stock}`
            }
          >
            <Tag color={ok ? 'green' : 'red'}>
              {ok ? <CheckCircleOutlined /> : <WarningOutlined />} {stock}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Cant Despachada Ahora',
      dataIndex: 'cantDespachada',
      width: 200,
      render: (_: any, r: ItemDespachoEdit) =>
        perm.editar ? (
          <InputNumber
            size="large"
            min={0}
            max={r.stockActualProducto ?? 99999}
            value={r.cantDespachada}
            style={{ width: '100%' }}
            onChange={(v: any) => actualizarCant(grupo.idMaquina, r.idPedido, Number(v))}
          />
        ) : (
          <strong style={{ fontSize: 15 }}>{r.cantDespachada}</strong>
        ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          <InboxOutlined /> Despachos a Operadores
          <Tag color="orange" style={{ marginLeft: 8 }}>
            {totalMaquinasPendientes} máq · {totalUnidPendientes} unid pendientes
          </Tag>
        </Title>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar máquina, ubicación, operador, producto..."
            style={{ width: 340 }}
            value={filtroBuscar}
            onChange={(e) => setFiltroBuscar(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Filtrar por Operador"
            style={{ width: 240 }}
            suffixIcon={<SettingOutlined />}
            value={filtroOperador}
            onChange={(v) => setFiltroOperador(v)}
          >
            {operadoresUnicos.map((op) => (
              <Option key={op.id} value={op.id}>
                {op.nombre}
              </Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => cargar()}>
            Recargar
          </Button>
          <Button type="default" icon={<FileTextOutlined />} onClick={() => setOpenReport(true)}>
            📄 Reporte Pendientes
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Máquinas pendientes de despacho" value={totalMaquinasPendientes} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Unidades sugeridas totales"
              value={totalUnidSugeridas}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Unidades FALTANTES (sugeridas - ya despachadas)"
              value={totalUnidPendientes}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total líneas producto"
              value={gruposFiltrados.reduce((s, g) => s + g.items.length, 0)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {cargando ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Cargando despachos pendientes desde la base de datos..." />
        </Card>
      ) : gruposFiltrados.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Badge
            status="success"
            text={
              <Title level={4} style={{ margin: 0 }}>
                🎉 Todos los despachos están cerrados.
              </Title>
            }
          />
          <div style={{ marginTop: 12, color: '#888' }}>
            {filasRaw.length === 0
              ? 'No hay pedidos creados por operadores. Pide a un operador que cree un pedido desde el 📱 Móvil Operador.'
              : 'No hay resultados con los filtros seleccionados.'}
          </div>
        </Card>
      ) : (
        <Collapse
          defaultActiveKey={[String(gruposFiltrados[0].idMaquina)]}
          accordion={false}
          size="large"
        >
          {gruposFiltrados.map((g) => {
            const totalSugerido = g.items.reduce((s, i) => s + i.cantSugerida, 0)
            const totalPrevio = g.items.reduce((s, i) => s + i.totalDespachadoPrevio, 0)
            const totalAhora = g.items.reduce((s, i) => s + i.cantDespachada, 0)
            const sinStock = g.items.filter((i) => {
              const pend = Math.max(0, i.cantSugerida - i.totalDespachadoPrevio)
              return pend > 0 && (i.stockActualProducto ?? 0) < pend
            })
            const fechaFmt = fmtFechaSafe(g.fechaPrimerPedido)
            return (
              <Panel
                key={g.idMaquina}
                header={
                  <Space wrap size={[8, 4]} style={{ padding: '4px 0' }}>
                    <Tag
                      color={
                        g.estado === 'PENDIENTE'
                          ? 'orange'
                          : g.estado === 'PARCIAL'
                            ? 'blue'
                            : g.estado === 'APROBADO'
                              ? 'green'
                              : 'red'
                      }
                      style={{ fontSize: 14 }}
                    >
                      {g.estado}
                    </Tag>
                    <strong style={{ fontSize: 16 }}>
                      {g.serial} — {g.ubicacionEsp || 'Ubicación no registrada'}
                    </strong>
                    <span style={{ color: '#888' }}>|</span>
                    <span>
                      👤 <strong>{g.operadorNombre}</strong>
                    </span>
                    <span style={{ color: '#888' }}>|</span>
                    <span>🕓 {fechaFmt}</span>
                    <Tag color="blue">{totalSugerido} unid. sugeridas</Tag>
                    {totalPrevio > 0 && (
                      <Tag color="geekblue">
                        <CheckCircleOutlined /> {totalPrevio} ya entregadas
                      </Tag>
                    )}
                    {totalAhora > 0 && (
                      <Tag color="green">{totalAhora} a despachar AHORA</Tag>
                    )}
                    {sinStock.length > 0 && (
                      <Tooltip
                        title={`⚠️ ${sinStock.length} producto(s) NO tienen stock suficiente para cubrir lo sugerido.`}
                      >
                        <Tag color="red" icon={<WarningOutlined />}>
                          {sinStock.length} SIN STOCK
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                }
                extra={
                  <Space onClick={(e) => e.stopPropagation()}>
                    {perm.editar && (
                      <>
                        <Tooltip title="Rellenar con lo que falta para completar la sugerencia (respeta stock)">
                          <Button
                            size="small"
                            onClick={() => ajustarASugerido(g.idMaquina)}
                            icon={<CheckCircleOutlined />}
                          >
                            Auto-sugerido
                          </Button>
                        </Tooltip>
                        <Tooltip title="Poner todas las cantidades a 0 (enviar nada a esta máquina)">
                          <Button
                            size="small"
                            onClick={() => marcarACero(g.idMaquina)}
                            icon={<MinusCircleOutlined />}
                            danger
                          >
                            Todo a 0
                          </Button>
                        </Tooltip>
                        <Popconfirm
                          title={`Confirmar despacho a máquina ${g.serial}?`}
                          description={
                            totalAhora === 0
                              ? '❌ No hay líneas con cantidad > 0 para despachar.'
                              : `Se descontarán ${totalAhora} unidades del stock de bodega en ${g.items.filter((i) => i.cantDespachada > 0).length} producto(s).`
                          }
                          okText="Sí, despachar"
                          cancelText="Cancelar"
                          okButtonProps={{ disabled: totalAhora === 0 }}
                          onConfirm={() => confirmar(g)}
                        >
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            loading={!!procesandoMaq[g.idMaquina]}
                            disabled={totalAhora === 0}
                          >
                            ✅ Confirmar Despacho
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                }
              >
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={12} md={6}>
                    <Card size="small">
                      <Statistic title="Unid. Sugeridas (pedido original)" value={totalSugerido} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="Unid. Ya Entregadas en Despachos Anteriores"
                        value={totalPrevio}
                        valueStyle={{ color: '#2f54eb' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card size="small">
                      <Statistic
                        title="Unid. A Despachar Ahora"
                        value={totalAhora}
                        valueStyle={{ color: totalAhora > 0 ? '#52c41a' : '#8c8c8c' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card size="small">
                      <Statistic title="Total Items Producto en esta Máquina" value={g.items.length} prefix="#" />
                    </Card>
                  </Col>
                </Row>
                <Spin spinning={!!procesandoMaq[g.idMaquina]} tip="Confirmando despacho...">
                  <Table
                    rowKey="idPedido"
                    dataSource={g.items}
                    columns={genColumns(g)}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    rowClassName={(r) => {
                      const pend = Math.max(0, r.cantSugerida - r.totalDespachadoPrevio)
                      if (pend === 0) return 'ant-table-row-ok'
                      if ((r.stockActualProducto ?? 0) < pend) return 'ant-table-row-danger'
                      return ''
                    }}
                  />
                </Spin>
              </Panel>
            )
          })}
        </Collapse>
      )}

      <Modal
        title="📄 Reporte Consolidado de Despachos Pendientes"
        open={openReport}
        onCancel={() => setOpenReport(false)}
        footer={null}
        width={1200}
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar producto, máquina..."
            style={{ width: 280 }}
            value={filtroBuscar}
            onChange={(e) => setFiltroBuscar(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Filtrar Operador"
            style={{ width: 240 }}
            suffixIcon={<SettingOutlined />}
            value={filtroOperador}
            onChange={(v) => setFiltroOperador(v)}
          >
            {operadoresUnicos.map((op) => (
              <Option key={op.id} value={op.id}>
                {op.nombre}
              </Option>
            ))}
          </Select>
          <DatePicker.RangePicker />
        </Space>
        <Table
          rowKey="key"
          dataSource={reportData}
          size="small"
          columns={[
            { title: 'Pedido', dataIndex: 'pedidoId', render: (v: any) => `#${v}`, width: 80 },
            { title: 'Máquina', dataIndex: 'maquina' },
            { title: 'Zona / Ubicación', dataIndex: 'zona' },
            { title: 'Operador', dataIndex: 'operador' },
            { title: 'Producto', dataIndex: 'producto' },
            { title: 'Físico', dataIndex: 'fisico', align: 'center' as const, width: 80 },
            {
              title: 'Sugerida',
              dataIndex: 'sugerida',
              align: 'center' as const,
              width: 90,
              render: (v: any) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: 'Prev. Desp.',
              dataIndex: 'prevDesp',
              align: 'center' as const,
              width: 90,
              render: (v: any) => (v > 0 ? <Tag color="geekblue">{v}</Tag> : '—'),
            },
            {
              title: 'Stock Bodega',
              dataIndex: 'stockActual',
              align: 'center' as const,
              width: 110,
              render: (v: any, r: any) => {
                const falt = Math.max(0, r.sugerida - r.prevDesp)
                return (
                  <Tag color={v >= falt ? 'green' : 'red'}>
                    {v >= falt ? '✅' : '⚠️'} {v}
                  </Tag>
                )
              },
            },
            {
              title: 'A Despachar',
              dataIndex: 'despachar',
              align: 'center' as const,
              width: 110,
              render: (v: any) => (
                <strong style={{ color: v > 0 ? '#389e0d' : '#8c8c8c', fontSize: 14 }}>
                  {v}
                </strong>
              ),
            },
            {
              title: 'Estado Grupo',
              dataIndex: 'estadoGrupo',
              render: (v: any) => <Tag color={estadoColor[v as EstadoPedido] || 'default'}>{v}</Tag>,
            },
            {
              title: 'Fecha Pedido',
              dataIndex: 'fecha',
              render: (v: any) => fmtFechaSafe(v),
            },
          ]}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          scroll={{ x: 1100 }}
        />
      </Modal>
    </div>
  )
}

export default Despachos
