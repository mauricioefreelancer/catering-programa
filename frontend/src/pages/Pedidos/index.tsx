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
} from '@ant-design/icons'
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

  const totales = useMemo(() => {
    return dataFiltrada.reduce(
      (acc, r) => {
        acc[r.estado] = (acc[r.estado] ?? 0) + 1
        acc.total += 1
        acc.fisicos += r.fisicoDigitado
        acc.sugeridas += r.cantSugerida
        return acc
      },
      { total: 0, PENDIENTE: 0, PARCIAL: 0, APROBADO: 0, RECHAZADO: 0, fisicos: 0, sugeridas: 0 } as Record<string, number>,
    )
  }, [dataFiltrada])

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
      dataIndex: 'idPedido',
      width: 90,
      fixed: 'left' as const,
      render: (v: any) => <strong style={{ fontSize: 14 }}>#{v}</strong>,
    },
    {
      title: 'Fecha / Hora',
      dataIndex: 'fechaHora',
      width: 180,
      render: (v: any) => new Date(v).toLocaleString('es-CO'),
      sorter: (a: any, b: any) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Máquina',
      dataIndex: '_maquina',
      width: 260,
      render: (m: any, r: any) =>
        m ? (
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
        ),
    },
    {
      title: 'Operador',
      dataIndex: '_operador',
      width: 220,
      render: (o: any, r: any) =>
        o ? (
          <Space direction="vertical" size={0}>
            <strong>{o.nombreCompleto ?? `Operador ${r.idOperador}`}</strong>
            {o.zonaAsignada && <Tag color="geekblue">{o.zonaAsignada}</Tag>}
          </Space>
        ) : (
          <Tag>Operador #${r.idOperador}</Tag>
        ),
    },
    {
      title: 'Producto',
      dataIndex: '_producto',
      width: 260,
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
      width: 130,
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
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Cant. Sugerida',
      dataIndex: 'cantSugerida',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Ya Despachado',
      width: 130,
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
      width: 130,
      align: 'center' as const,
      filters: (['PENDIENTE', 'PARCIAL', 'APROBADO', 'RECHAZADO'] as EstadoPedido[]).map((e) => ({
        text: e,
        value: e,
      })),
      onFilter: (val: any, rec: any) => rec.estado === val,
      render: (e: EstadoPedido) => {
        const Icon = estadoIcon[e]
        return (
          <Tag color={estadoColor[e]} icon={<Icon />} style={{ fontSize: 13, padding: '2px 10px' }}>
            {e}
          </Tag>
        )
      },
    },
    {
      title: 'Observaciones',
      dataIndex: 'observaciones',
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
      ) : dataFiltrada.length === 0 ? (
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
          columns={columns as any}
          dataSource={dataFiltrada}
          size="middle"
          pagination={{
            current: 1,
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100, 500],
            showTotal: (t) => `${t} pedidos encontrados`,
          }}
          scroll={{ x: 1600 }}
          rowClassName={(r) =>
            r.estado === 'APROBADO'
              ? 'ant-table-row-ok'
              : r.estado === 'RECHAZADO'
                ? 'ant-table-row-danger'
                : ''
          }
        />
      )}
    </div>
  )
}

export default PedidosOperador
