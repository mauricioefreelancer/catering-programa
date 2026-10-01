import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Button,
  Input,
  Space,
  message,
  Table,
  Tag,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Typography,
  Spin,
  Badge,
  Tooltip,
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  FileTextOutlined,
  OrderedListOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { Drawer, Descriptions, Divider } from 'antd'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { apiService } from '../../api/services/api'

const { Title } = Typography
const { Option } = Select

type EstadoPedido = 'PENDIENTE' | 'PARCIAL' | 'APROBADO' | 'RECHAZADO'

const estadoColor: Record<EstadoPedido, string> = {
  PENDIENTE: 'orange',
  PARCIAL: 'blue',
  APROBADO: 'green',
  RECHAZADO: 'red',
}

const estadoIcon: Record<EstadoPedido, any> = {
  PENDIENTE: ClockCircleOutlined,
  PARCIAL: MinusCircleOutlined,
  APROBADO: CheckCircleOutlined,
  RECHAZADO: CloseCircleOutlined,
}

const normalizar = (raw: any) => ({
  key: raw.idPedido ?? raw.id_pedido ?? raw.ID_Pedido ?? raw['ID_Pedido'] ?? Math.random(),
  idPedido: raw.idPedido ?? raw.id_pedido ?? raw.ID_Pedido ?? raw['ID_Pedido'] ?? -1,
  idGrupo:
    raw.idGrupo ?? raw.id_grupo ?? raw.ID_Grupo ?? raw['ID_Grupo'] ?? null,
  idMaquina: raw.idMaquina ?? raw.id_maquina ?? raw.ID_Maquina ?? raw['ID_Maquina'] ?? -1,
  idOperador: raw.idOperador ?? raw.id_operador ?? raw.ID_Operador ?? raw['ID_Operador'] ?? -1,
  idProducto: raw.idProducto ?? raw.id_producto ?? raw.ID_Producto ?? raw['ID_Producto'] ?? -1,
  idMapaMp:
    raw.idMapaMp ?? raw.id_mapa_mp ?? raw.ID_Mapa_MP ?? raw['ID_Mapa_MP'] ?? null,
  fechaHora:
    raw.fechaHora ??
    raw.fecha_hora ??
    raw.Fecha_Hora ??
    raw['Fecha_Hora'] ??
    new Date(0).toISOString(),
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
  observaciones: raw.observaciones ?? raw.Observaciones ?? raw['Observaciones'] ?? null,
  _maquina: raw.maquina ?? raw._maquina ?? null,
  _operador: raw.operador ?? raw._operador ?? null,
  _producto: raw.producto ?? raw._producto ?? null,
  _mapaMp: raw.mapaMp ?? raw._mapaMp ?? null,
  _despachos: raw.despachosBodega ?? raw._despachos ?? [],
})

const PedidosOperador = () => {
  const { usuario } = useAuth()
  const perm = usePermissions('pedidosOperador')
  const [cargando, setCargando] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [filtroBuscar, setFiltroBuscar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | undefined>()
  const [filtroOperador, setFiltroOperador] = useState<number | undefined>()
  const [filtroMaquina, setFiltroMaquina] = useState<number | undefined>()
  const [filtroFecha, setFiltroFecha] = useState<any>(null)
  const [detalle, setDetalle] = useState<any[] | null>(null)

  const cargar = async (silent = false) => {
    try {
      if (!silent) setCargando(true)
      const params: any = {}
      if (filtroOperador != null) params.idOperador = filtroOperador
      if (filtroMaquina != null) params.idMaquina = filtroMaquina
      if (filtroEstado) params.estado = filtroEstado
      const res = await apiService.get<any[]>('/pedidos-operador', params)
      setData(Array.isArray(res) ? res.map(normalizar).filter((p) => p.idPedido > 0) : [])
    } catch (e: any) {
      console.error('[PedidosOperador] error:', e)
      message.error(
        `Error al cargar pedidos: ${e?.response?.data?.message ?? e?.message ?? 'desconocido'}`,
      )
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dataFiltrada = useMemo(() => {
    let arr = data
    if (filtroFecha && Array.isArray(filtroFecha) && filtroFecha.length === 2) {
      const [start, end] = filtroFecha
      const t0 = start ? start.startOf('day').toDate().getTime() : -Infinity
      const t1 = end ? end.endOf('day').toDate().getTime() : Infinity
      arr = arr.filter((r) => {
        const t = new Date(r.fechaHora).getTime()
        return t >= t0 && t <= t1
      })
    }
    if (filtroBuscar.trim()) {
      const q = filtroBuscar.trim().toLowerCase()
      arr = arr.filter((r) => {
        const maq = r._maquina
          ? `${r._maquina.serial ?? ''} ${r._maquina.ubicacionEsp ?? ''} ${r._maquina.ubicacion ?? ''}`.toLowerCase()
          : ''
        const op = r._operador
          ? `${r._operador.nombreCompleto ?? ''} ${r._operador.zonaAsignada ?? ''}`.toLowerCase()
          : ''
        const pr = r._producto ? `${r._producto.nombreProducto ?? ''} ${r._producto.codigoBarras ?? ''}`.toLowerCase() : ''
        return (
          maq.includes(q) ||
          op.includes(q) ||
          pr.includes(q) ||
          String(r.idPedido).includes(q) ||
          String(r.fisicoDigitado).includes(q) ||
          String(r.cantSugerida).includes(q)
        )
      })
    }
    return arr
  }, [data, filtroBuscar, filtroFecha])

  // Agrupar los items en "pedidos" (una visita/digitación del operador = un pedido)
  const grupos = useMemo(() => {
    const itemsOrdenados = [...dataFiltrada].sort(
      (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
    )
    const mapa = new Map<number, any[]>()
    const sinClave = new Map<string, any[]>() // para items sin idGrupo: clave operador|maquina|ventana
    const FALLO_VENTANA = 3000 // ms para considerar misma digitación (fallback)

    for (const item of itemsOrdenados) {
      const gid = item.idGrupo
      if (gid != null) {
        if (!mapa.has(gid)) mapa.set(gid, [])
        mapa.get(gid)!.push(item)
        continue
      }
      // fallback: agrupar por operador+maquina, abriendo nueva ventana si pasaron > FALLO_VENTANA ms
      const claveBase = `${item.idOperador}|${item.idMaquina}`
      let clave = claveBase
      const ts = new Date(item.fechaHora).getTime()
      for (const [c, itemsArr] of sinClave) {
        if (c.startsWith(claveBase + '|')) {
          const ultima = new Date(itemsArr[itemsArr.length - 1].fechaHora).getTime()
          if (ts - ultima <= FALLO_VENTANA) { clave = c; break }
        }
      }
      if (!sinClave.has(clave)) {
        const idx = sinClave.size
        clave = `${claveBase}|${idx}`
        sinClave.set(clave, [])
      }
      sinClave.get(clave)!.push(item)
    }

    // Convertir mapas a grupos ordenados descendente por fecha
    const gruposArr: any[] = []
    for (const [gid, items] of mapa) {
      gruposArr.push({ idGrupo: gid, items: items.sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime()) })
    }
    for (const [, items] of sinClave) {
      const first = items[0]
      const gidFallback = first.idPedido
      gruposArr.push({ idGrupo: gidFallback, items: items.sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime()), fallback: true })
    }
    return gruposArr.sort((a, b) => {
      const ta = new Date(a.items[0]?.fechaHora).getTime()
      const tb = new Date(b.items[0]?.fechaHora).getTime()
      return tb - ta
    })
  }, [dataFiltrada])

  const totalDespachadoGrupo = (grupo: any) =>
    grupo.items.reduce((a: number, it: any) => a + totalDespachado(it), 0)

  const estadoGrupo = (grupo: any): EstadoPedido => {
    const set = new Set(grupo.items.map((it: any) => it.estado))
    if (set.size === 1) return grupo.items[0].estado
    if (set.has('RECHAZADO')) return 'RECHAZADO'
    if (set.has('PENDIENTE') && set.has('APROBADO')) return 'PARCIAL'
    return 'PARCIAL'
  }

  const totales = useMemo(() => {
    return grupos.reduce(
      (acc, g) => {
        acc[estadoGrupo(g)] = (acc[estadoGrupo(g)] ?? 0) + 1
        acc.total += 1
        acc.fisicos += g.items.reduce((a: number, it: any) => a + it.fisicoDigitado, 0)
        acc.sugeridas += g.items.reduce((a: number, it: any) => a + it.cantSugerida, 0)
        return acc
      },
      { total: 0, PENDIENTE: 0, PARCIAL: 0, APROBADO: 0, RECHAZADO: 0, fisicos: 0, sugeridas: 0 } as Record<string, number>,
    )
  }, [grupos])

  const operadoresOpts = useMemo(() => {
    const set = new Map<number, string>()
    data.forEach((r) => {
      if (r._operador) set.set(r.idOperador, r._operador.nombreCompleto ?? `Op ${r.idOperador}`)
    })
    return Array.from(set.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [data])

  const maquinasOpts = useMemo(() => {
    const set = new Map<number, string>()
    data.forEach((r) => {
      if (r._maquina)
        set.set(r.idMaquina, `${r._maquina.serial ?? `Máq #${r.idMaquina}`} · ${r._maquina.ubicacionEsp ?? r._maquina.ubicacion ?? ''}`)
    })
    return Array.from(set.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [data])

  const totalDespachado = (r: any) =>
    Array.isArray(r._despachos)
      ? r._despachos.reduce((a: number, d: any) => a + Number(d.cantDespachada ?? d['Cant_Despachada'] ?? 0), 0)
      : 0

  const columns = [
    {
      title: 'Pedido #',
      dataIndex: 'idGrupo',
      width: 110,
      fixed: 'left' as const,
      render: (_: any, g: any) => (
        <strong style={{ fontSize: 14 }}>
          #{g.fallback ? `${g.idGrupo}-F` : g.idGrupo}
        </strong>
      ),
    },
    {
      title: 'Fecha / Hora',
      key: 'fecha',
      width: 180,
      render: (_: any, g: any) => new Date(g.items[0]?.fechaHora).toLocaleString('es-CO'),
      sorter: (a: any, b: any) =>
        new Date(a.items[0]?.fechaHora).getTime() - new Date(b.items[0]?.fechaHora).getTime(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Máquina',
      key: 'maquina',
      width: 260,
      render: (_: any, g: any) => {
        const r = g.items[0]
        const m = r?._maquina
        return m ? (
          <Space direction="vertical" size={0}>
            <strong>{m.serial ?? `Máq #${r.idMaquina}`}</strong>
            <span style={{ color: '#888', fontSize: 12 }}>
              {m.ubicacionEsp ?? m.ubicacion ?? 'Ubicación no registrada'}
            </span>
            {m.cliente && (
              <span style={{ color: '#888', fontSize: 12 }}>
                🏢 {m.cliente.razonSocial ?? m.cliente.Razon_Social ?? ''}
              </span>
            )}
          </Space>
        ) : (
          <Tag color="default">Sin máquina</Tag>
        )
      },
    },
    {
      title: 'Operador',
      key: 'operador',
      width: 240,
      render: (_: any, g: any) => {
        const r = g.items[0]
        const o = r?._operador
        return o ? (
          <Space direction="vertical" size={0}>
            <strong>{o.nombreCompleto ?? `Operador ${r.idOperador}`}</strong>
            {o.zonaAsignada && <Tag color="geekblue">{o.zonaAsignada}</Tag>}
          </Space>
        ) : (
          <Tag>Operador #{r?.idOperador}</Tag>
        )
      },
    },
    {
      title: 'Productos',
      key: 'nproductos',
      width: 120,
      align: 'center' as const,
      render: (_: any, g: any) => {
        const totalUnidades = g.items.reduce((a: number, it: any) => a + (it.cantSugerida || 0), 0)
        return (
          <Tooltip title="Haz clic en Ver más para el desglose producto por producto">
            <Space direction="vertical" size={0} align="center">
              <Tag color="default"> {g.items.length} productos</Tag>
              <span style={{ color: '#888', fontSize: 12 }}>{totalUnidades} u. sugeridas</span>
            </Space>
          </Tooltip>
        )
      },
    },
    {
      title: 'Ya Despachado',
      key: 'despachado',
      width: 150,
      align: 'center' as const,
      render: (_: any, g: any) => {
        const v = totalDespachadoGrupo(g)
        return (
          <Tag color={v > 0 ? 'geekblue' : 'default'}>
            {v > 0 ? <CheckCircleOutlined /> : '—'} {v} u
          </Tag>
        )
      },
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 130,
      align: 'center' as const,
      filters: (['PENDIENTE', 'PARCIAL', 'APROBADO', 'RECHAZADO'] as EstadoPedido[]).map((e) => ({
        text: e,
        value: e,
      })),
      onFilter: (val: any, g: any) => estadoGrupo(g) === val,
      render: (_: any, g: any) => {
        const e = estadoGrupo(g)
        const Icon = estadoIcon[e]
        return (
          <Tag color={estadoColor[e]} icon={<Icon />} style={{ fontSize: 13, padding: '2px 10px' }}>
            {e}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'acciones',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, g: any) => (
        <Button type="primary" ghost icon={<EyeOutlined />} onClick={() => setDetalle(g.items)}>
          Ver más
        </Button>
      ),
    },
  ]

  const detalleColumns = [
    {
      title: 'Producto',
      dataIndex: '_producto',
      key: 'producto',
      render: (p: any, r: any) =>
        p ? (
          <Space direction="vertical" size={0}>
            <strong>{p.nombreProducto ?? `Producto ${r.idProducto}`}</strong>
            <Space>
              {p.codigoBarras && (
                <Tag color="purple" style={{ fontSize: 11 }}>
                  📦 {p.codigoBarras}
                </Tag>
              )}
              <Tag color="cyan">{p.tipoProducto ?? ''}</Tag>
            </Space>
          </Space>
        ) : (
          `Producto #${r.idProducto}`
        ),
    },
    {
      title: 'Espiral',
      dataIndex: '_mapaMp',
      key: 'mapaMp',
      width: 120,
      align: 'center' as const,
      render: (m: any) =>
        m ? (
          <Tooltip title={`Capacidad máx: ${m.capacidadMax}`}>
            <Tag color="magenta" style={{ fontSize: 13 }}>
              🔀 {m.espiralCodigo ?? m.codigoEspiral ?? '—'}
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="default">NRQ/General</Tag>
        ),
    },
    {
      title: 'Físico Digitado',
      dataIndex: 'fisicoDigitado',
      key: 'fisicoDigitado',
      width: 130,
      align: 'center' as const,
      render: (v: number) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Cant. Sugerida',
      dataIndex: 'cantSugerida',
      key: 'cantSugerida',
      width: 130,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Ya Despachado',
      key: 'despachado',
      width: 140,
      align: 'center' as const,
      render: (_: any, r: any) => {
        const v = totalDespachado(r)
        return (
          <Tag color={v > 0 ? 'geekblue' : 'default'}>
            {v > 0 ? <CheckCircleOutlined /> : '—'} {v}
          </Tag>
        )
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 120,
      align: 'center' as const,
      render: (e: EstadoPedido) => {
        const Icon = estadoIcon[e]
        return (
          <Tag color={estadoColor[e]} icon={<Icon />} style={{ padding: '2px 10px' }}>
            {e}
          </Tag>
        )
      },
    },
    {
      title: 'Observaciones',
      dataIndex: 'observaciones',
      key: 'observaciones',
      width: 200,
      ellipsis: true,
      render: (v: any) => (v ? <span style={{ color: '#555' }}>{v}</span> : <Tag color="default">Sin obs.</Tag>),
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
          <OrderedListOutlined /> Pedidos Creados por Operadores
          <Tag color="geekblue" style={{ marginLeft: 8 }}>
            {totales.total} total
          </Tag>
        </Title>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar pedido, máquina, operador, producto..."
            style={{ width: 360 }}
            value={filtroBuscar}
            onChange={(e) => setFiltroBuscar(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Estado"
            style={{ width: 160 }}
            value={filtroEstado}
            onChange={(v) => {
              setFiltroEstado(v)
            }}
          >
            <Option value="PENDIENTE">🟠 Pendiente</Option>
            <Option value="PARCIAL">🔵 Parcial</Option>
            <Option value="APROBADO">🟢 Aprobado</Option>
            <Option value="RECHAZADO">🔴 Rechazado</Option>
          </Select>
          <Select
            allowClear
            placeholder="Filtrar Operador"
            style={{ width: 260 }}
            suffixIcon={<SettingOutlined />}
            value={filtroOperador}
            onChange={(v) => setFiltroOperador(v)}
          >
            {operadoresOpts.map((op) => (
              <Option key={op.id} value={op.id}>
                {op.nombre}
              </Option>
            ))}
          </Select>
          <Select
            allowClear
            placeholder="Filtrar Máquina"
            style={{ width: 300 }}
            suffixIcon={<SettingOutlined />}
            value={filtroMaquina}
            onChange={(v) => setFiltroMaquina(v)}
          >
            {maquinasOpts.map((m) => (
              <Option key={m.id} value={m.id}>
                {m.nombre}
              </Option>
            ))}
          </Select>
          <DatePicker.RangePicker
            value={filtroFecha}
            onChange={(v: any) => setFiltroFecha(v)}
          />
          <Button icon={<FileTextOutlined />} onClick={() => message.info('Exportar Excel: función lista para habilitar')}>
            📄 Excel
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => cargar()}>
            Aplicar Filtros / Recargar
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Total Pedidos (filtrados)" value={totales.total} prefix="#" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Pendientes por Despachar"
              value={totales.PENDIENTE}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Parcialmente Despachados"
              value={totales.PARCIAL}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Unidades Totales Sugeridas"
              value={totales.sugeridas}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {cargando ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Cargando pedidos desde PostgreSQL..." />
        </Card>
      ) : grupos.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Badge
            status="info"
            text={
              <Title level={4} style={{ margin: 0 }}>
                Aún no hay pedidos creados.
              </Title>
            }
          />
          <div style={{ marginTop: 12, color: '#888' }}>
            Los pedidos se crean desde el 📱 Móvil Operador (Inventario → seleccionar máquina →
            ingresar conteos físicos → guardar).
          </div>
          {usuario?.perfil === 'OPERADOR' && (
            <Button
              type="primary"
              style={{ marginTop: 20 }}
              onClick={() => {
                window.location.href = '/mobile/home'
              }}
            >
              Ir a Móvil Operador →
            </Button>
          )}
        </Card>
      ) : (
        <Table
          rowKey={(_: any, idx?: number) => `g_${idx}`}
          columns={columns as any}
          dataSource={grupos}
          size="middle"
          pagination={{
            current: 1,
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100, 500],
            showTotal: (t) => `${t} pedido(s) encontrado(s)`,
          }}
          scroll={{ x: 1300 }}
          rowClassName={(g) =>
            estadoGrupo(g) === 'APROBADO'
              ? 'ant-table-row-ok'
              : estadoGrupo(g) === 'RECHAZADO'
                ? 'ant-table-row-danger'
                : ''
          }
        />
      )}

      <Drawer
        title={
          detalle ? (
            <Space direction="vertical" size={0}>
              <strong>Desglose del pedido #{detalle[0]?.idGrupo}</strong>
              <span style={{ color: '#888', fontSize: 12 }}>
                {detalle[0]?._operador?.nombreCompleto ?? `Operador #${detalle[0]?.idOperador}`} ·{' '}
                {new Date(detalle[0]?.fechaHora).toLocaleString('es-CO')} ·{' '}
                {detalle.length} producto(s)
              </span>
            </Space>
          ) : (
            'Detalle del pedido'
          )
        }
        width={860}
        open={!!detalle}
        onClose={() => setDetalle(null)}
      >
        <Descriptions
          size="small"
          column={2}
          bordered
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label="Total despachado">
            {detalle ? totalDespachadoGrupo({ items: detalle }) : 0} u
          </Descriptions.Item>
          <Descriptions.Item label="Total sugerido">
            {detalle ? detalle.reduce((a, it) => a + (it.cantSugerida || 0), 0) : 0} u
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '8px 0 16px' }}>Productos del pedido</Divider>
        <Table
          columns={detalleColumns as any}
          dataSource={detalle ?? []}
          rowKey={(r: any) => r.idPedido}
          size="middle"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Drawer>
    </div>
  )
}

export default PedidosOperador
