import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Empty, InputNumber, Modal, Popconfirm, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd'
import { EditOutlined, ReloadOutlined, RollbackOutlined, SlidersOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { get, post, put } from '../../api/services/api'

type Linea = {
  categoria: string; nombre: string; unidad: string; cantidad: number; estandar: number | null
  diferencia: number | null; personalizada: boolean; tieneTolva: boolean; costo: number | null
}
type Boton = {
  idMapaNrq: number; boton: string; producto: string; varianteCafe: string | null; variantesDisponibles: string[]
  personalizado: boolean; lineas: Linea[]; omitidas: string[]; faltantesEnReceta: string[]; sinTolva: string[]
  costoPorTaza: number | null; precioCliente: number | null; margen: number | null; tazasPosibles: number | null
}
type Tolva = { idMapaMp: number; codigo: string; producto: string; categoria: string | null; nombreCategoria: string | null; unidad: string | null }
type Vista = {
  tipoCafe: string; categorias: string[]; tolvas: Tolva[]; botones: Boton[]; listaParaOperar: boolean; tolvasSinCategoria: string[]
}
type Control = { visitas: number; categorias: { categoria: string; nombre: string; unidad: string; teorico: number; real: number; diferencia: number; valorDiferencia: number; incompletas: number }[] }

const VARIANTE: Record<string, string> = { GRANO: 'Café en grano', SOLUBLE: 'Café soluble', SIN_CAFE: 'Sin café' }
const TIPO_CAFE: Record<string, string> = { GRANO: 'Café en grano', SOLUBLE: 'Café soluble', AMBOS: 'Grano y soluble', SIN_CAFE: 'Sin café' }
const pesos = (v: number | null | undefined) => (v == null ? '—' : `$ ${Math.round(v).toLocaleString('es-CO')}`)
const num = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 2 })
const error = (e: any, texto: string) => message.error(e?.response?.data?.message || texto)

export default function CafeteraRecetas({ idMaquina, version, puedeEditar }: { idMaquina: number; version: number; puedeEditar: boolean }) {
  const [vista, setVista] = useState<Vista | null>(null)
  const [control, setControl] = useState<Control | null>(null)
  const [cargando, setCargando] = useState(false)
  const [editando, setEditando] = useState<Boton | null>(null)
  const [borrador, setBorrador] = useState<Record<string, number | null>>({})
  const [ajuste, setAjuste] = useState<{ categoria?: string; cantidad?: number | null }>({})

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [v, c] = await Promise.all([
        get<Vista>(`/recetas-cafe/maquinas/${idMaquina}`),
        get<Control>(`/recetas-cafe/maquinas/${idMaquina}/control`).catch(() => null),
      ])
      setVista(v)
      setControl(c)
    } catch (e) {
      error(e, 'No se pudo cargar la configuración de la cafetera')
    } finally {
      setCargando(false)
    }
  }, [idMaquina])

  useEffect(() => { cargar() }, [cargar, version])

  const cambiarVariante = async (b: Boton, variante: string) => {
    try {
      await put(`/recetas-cafe/maquinas/${idMaquina}/botones/${b.idMapaNrq}`, { varianteCafe: variante })
      message.success(`Botón ${b.boton}: receta ${VARIANTE[variante].toLowerCase()} aplicada`)
      cargar()
    } catch (e) { error(e, 'No se pudo cambiar la variante') }
  }

  const restaurar = async (b: Boton) => {
    try {
      await put(`/recetas-cafe/maquinas/${idMaquina}/botones/${b.idMapaNrq}`, { varianteCafe: b.varianteCafe })
      message.success(`Botón ${b.boton} restaurado a la receta estándar`)
      cargar()
    } catch (e) { error(e, 'No se pudo restaurar') }
  }

  const abrirEdicion = (b: Boton) => {
    setEditando(b)
    setBorrador(Object.fromEntries(b.lineas.map((l) => [l.categoria, l.cantidad])))
  }

  const guardarEdicion = async () => {
    if (!editando) return
    const lineas = Object.entries(borrador)
      .filter(([, v]) => v != null && Number(v) > 0)
      .map(([categoria, cantidad]) => ({ categoria, cantidad }))
    try {
      await put(`/recetas-cafe/maquinas/${idMaquina}/botones/${editando.idMapaNrq}`, { varianteCafe: editando.varianteCafe, lineas })
      message.success(`Receta del botón ${editando.boton} guardada`)
      setEditando(null)
      cargar()
    } catch (e) { error(e, 'No se pudo guardar la receta') }
  }

  const aplicarAjuste = async () => {
    if (!ajuste.categoria || !ajuste.cantidad) return
    try {
      const r = await post<{ botonesAjustados: number }>(`/recetas-cafe/maquinas/${idMaquina}/ajustar-insumo`, ajuste)
      message.success(`Dosis ajustada en ${r.botonesAjustados} botón(es)`)
      setAjuste({})
      cargar()
    } catch (e) { error(e, 'No se pudo ajustar el insumo') }
  }

  const restaurarTodo = async () => {
    try {
      await post(`/recetas-cafe/maquinas/${idMaquina}/restaurar`, {})
      message.success('Todas las recetas se restauraron a la estándar')
      cargar()
    } catch (e) { error(e, 'No se pudo restaurar') }
  }

  if (!vista) return <Spin spinning={cargando}><Empty description="Cargando recetas…" /></Spin>

  const tolvasCafe = vista.tolvas.filter((t) => t.categoria)
  const columnasEdicion = editando
    ? Array.from(new Map([
        ...editando.lineas.map((l) => [l.categoria, { categoria: l.categoria, nombre: l.nombre, unidad: l.unidad, estandar: l.estandar }] as const),
        ...tolvasCafe.filter((t) => !editando.lineas.some((l) => l.categoria === t.categoria))
          .filter((t) => !(editando.varianteCafe === 'GRANO' && t.categoria === 'CAFE_SOLUBLE') && !(editando.varianteCafe === 'SOLUBLE' && t.categoria === 'CAFE_GRANO')
            && !(editando.varianteCafe === 'SIN_CAFE' && t.categoria!.startsWith('CAFE_')))
          .map((t) => [t.categoria!, { categoria: t.categoria!, nombre: t.nombreCategoria!, unidad: t.unidad!, estandar: null }] as const),
      ]).values())
    : []

  return (
    <Spin spinning={cargando}>
      <Card
        size="small"
        type="inner"
        style={{ marginTop: 12 }}
        title={<Space wrap>☕ Recetas por botón <Tag color="geekblue">{TIPO_CAFE[vista.tipoCafe]}</Tag>
          {vista.listaParaOperar ? <Tag color="green">Lista para operar</Tag> : <Tag color="red">Configuración incompleta</Tag>}</Space>}
        extra={<Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={cargar}>Actualizar</Button>
          {puedeEditar && vista.botones.length > 0 && (
            <Popconfirm title="¿Restaurar todos los botones a la receta estándar?" description="Se pierden los ajustes de esta máquina." onConfirm={restaurarTodo}>
              <Button size="small" icon={<RollbackOutlined />}>Restaurar todo</Button>
            </Popconfirm>
          )}
        </Space>}
      >
        {vista.tolvasSinCategoria.length > 0 && (
          <Alert type="error" showIcon style={{ marginBottom: 8 }} message={`Insumos sin categoría: ${vista.tolvasSinCategoria.join(', ')}`}
            description="Asígnales la categoría en Productos para que las recetas los reconozcan." />
        )}
        {vista.botones.length === 0 ? (
          <Alert type="info" showIcon message="Agrega primero los insumos (tolvas) y luego los botones. Cada botón toma la receta estándar de su producto." />
        ) : (
          <Table<Boton>
            size="small"
            rowKey="idMapaNrq"
            dataSource={vista.botones}
            pagination={false}
            columns={[
              { title: 'Botón', dataIndex: 'boton', width: 56, render: (v: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
              {
                title: 'Producto y variante', key: 'producto', width: 190,
                render: (_: unknown, b: Boton) => (
                  <Space direction="vertical" size={4}>
                    <b>{b.producto}</b>
                    {b.variantesDisponibles.length > 1 && puedeEditar ? (
                      <Select size="small" style={{ width: 150 }} value={b.varianteCafe ?? undefined} placeholder="Elegir variante"
                        onChange={(v: string) => cambiarVariante(b, v)}
                        options={b.variantesDisponibles.map((v) => ({ value: v, label: VARIANTE[v] }))} />
                    ) : b.varianteCafe ? <Tag>{VARIANTE[b.varianteCafe]}</Tag>
                      : <Tooltip title="Define su receta en Recetas café"><Tag color="red">Sin receta estándar</Tag></Tooltip>}
                    {b.personalizado && <Tag color="orange">Personalizado</Tag>}
                  </Space>
                ),
              },
              {
                title: 'Receta en esta máquina (por taza)', key: 'receta',
                render: (_: unknown, b: Boton) => (
                  <Space direction="vertical" size={2}>
                    <Space wrap size={4}>
                      {b.lineas.length ? b.lineas.map((l: Linea) => (
                        <Tooltip key={l.categoria} title={l.estandar == null ? 'No está en la receta estándar' : `Estándar: ${num(l.estandar)} ${l.unidad}`}>
                          <Tag color={!l.tieneTolva ? 'red' : l.personalizada ? 'orange' : 'blue'} style={{ marginInlineEnd: 0 }}>
                            {l.nombre} {num(l.cantidad)} {l.unidad}
                            {l.diferencia ? ` (${l.diferencia > 0 ? '+' : ''}${num(l.diferencia)})` : ''}
                          </Tag>
                        </Tooltip>
                      )) : <Tag color="red">Sin receta</Tag>}
                    </Space>
                    {b.omitidas.length > 0 && <Typography.Text type="secondary" style={{ fontSize: 12 }}>No lleva (la máquina no lo tiene): {b.omitidas.join(', ')}</Typography.Text>}
                    {b.faltantesEnReceta.length > 0 && <Typography.Text type="warning" style={{ fontSize: 12 }}>La máquina ya tiene {b.faltantesEnReceta.join(', ')} y la receta no lo usa: usa «Estándar» si debe llevarlo.</Typography.Text>}
                    {b.sinTolva.length > 0 && <Typography.Text type="danger" style={{ fontSize: 12 }}>Sin tolva: {b.sinTolva.join(', ')}</Typography.Text>}
                  </Space>
                ),
              },
              {
                title: 'Costo · precio', key: 'costo', width: 120, align: 'right' as const,
                render: (_: unknown, b: Boton) => (
                  <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
                    <span title="Costo por taza con los insumos de esta máquina">{pesos(b.costoPorTaza)}</span>
                    {b.precioCliente == null ? <Tag color="gold" style={{ marginInlineEnd: 0 }}>Sin precio</Tag> : <Typography.Text type="secondary">{pesos(b.precioCliente)}</Typography.Text>}
                    {b.margen != null && <Tag color={b.margen < 20 ? 'red' : b.margen < 35 ? 'gold' : 'green'} style={{ marginInlineEnd: 0 }}>{b.margen.toFixed(1)}%</Tag>}
                  </Space>
                ),
              },
              ...(puedeEditar ? [{
                title: '', key: 'acc', width: 104,
                render: (_: unknown, b: Boton) => (
                  <Space direction="vertical" size={0}>
                    <Button size="small" type="link" icon={<EditOutlined />} disabled={!b.varianteCafe} onClick={() => abrirEdicion(b)}>Ajustar</Button>
                    {(b.personalizado || b.faltantesEnReceta.length > 0) && (
                      <Popconfirm title={`¿Restaurar el botón ${b.boton} a la receta estándar?`} onConfirm={() => restaurar(b)}>
                        <Button size="small" type="link" icon={<RollbackOutlined />}>Estándar</Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              }] : []),
            ]}
          />
        )}

        {puedeEditar && tolvasCafe.length > 0 && vista.botones.length > 0 && (
          <Space wrap style={{ marginTop: 12 }}>
            <SlidersOutlined />
            <span>Ajustar un insumo en todos los botones:</span>
            <Select size="small" style={{ width: 190 }} placeholder="Insumo" value={ajuste.categoria}
              onChange={(categoria) => setAjuste({ ...ajuste, categoria })}
              options={Array.from(new Map(tolvasCafe.map((t) => [t.categoria!, { value: t.categoria!, label: `${t.nombreCategoria} (${t.unidad})` }])).values())} />
            <InputNumber size="small" min={0.01} step={0.5} placeholder="Dosis" value={ajuste.cantidad ?? null}
              onChange={(cantidad) => setAjuste({ ...ajuste, cantidad: cantidad == null ? null : Number(cantidad) })} />
            <Popconfirm title="¿Cambiar esta dosis en todos los botones que usan el insumo?" onConfirm={aplicarAjuste}
              disabled={!ajuste.categoria || !ajuste.cantidad}>
              <Button size="small" disabled={!ajuste.categoria || !ajuste.cantidad}>Aplicar</Button>
            </Popconfirm>
          </Space>
        )}
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Azul: igual a la estándar · Naranja: ajustada en esta máquina · Rojo: insumo sin tolva. Las recetas estándar se editan en <Link to="/productos/recetas-cafe">Recetas café</Link>.
          </Typography.Text>
        </div>
      </Card>

      <Card size="small" type="inner" style={{ marginTop: 12 }} title={`📊 Control de insumos (todas las visitas: ${control?.visitas ?? 0})`}>
        {control && control.categorias.length ? (
          <Table
            size="small"
            rowKey="categoria"
            pagination={false}
            dataSource={control.categorias}
            columns={[
              { title: 'Insumo', dataIndex: 'nombre' },
              { title: 'Teórico (NRQ × dosis)', key: 't', align: 'right' as const, render: (_: unknown, c: Control['categorias'][number]) => `${num(c.teorico)} ${c.unidad}` },
              { title: 'Real (tolvas)', key: 'r', align: 'right' as const, render: (_: unknown, c: Control['categorias'][number]) => `${num(c.real)} ${c.unidad}` },
              { title: 'Diferencia', key: 'd', align: 'right' as const, render: (_: unknown, c: Control['categorias'][number]) =>
                <Tag color={c.diferencia === 0 ? 'green' : 'orange'}>{c.diferencia > 0 ? '+' : ''}{num(c.diferencia)} {c.unidad}</Tag> },
              { title: 'Valor', dataIndex: 'valorDiferencia', align: 'right' as const, render: (v: number) => pesos(v) },
              { title: 'Visitas sin calcular', dataIndex: 'incompletas', align: 'right' as const },
            ]}
          />
        ) : <Typography.Text type="secondary">Aún no hay visitas con lecturas para comparar.</Typography.Text>}
        {control && control.categorias.length > 0 && (
          <Statistic style={{ marginTop: 8 }} title="Diferencia valorada del período" value={control.categorias.reduce((a, c) => a + c.valorDiferencia, 0)}
            prefix="$" formatter={(v) => Math.round(Number(v)).toLocaleString('es-CO')} />
        )}
      </Card>

      <Modal
        open={!!editando}
        title={editando ? `Receta del botón ${editando.boton} · ${editando.producto} (${VARIANTE[editando.varianteCafe ?? ''] ?? ''})` : ''}
        onCancel={() => setEditando(null)}
        onOk={guardarEdicion}
        okText="Guardar receta"
        width={560}
      >
        <Typography.Paragraph type="secondary">
          Ajusta la dosis por taza solo para esta máquina. La receta estándar no cambia. Deja vacío un insumo para quitarlo.
        </Typography.Paragraph>
        <Table
          size="small"
          pagination={false}
          rowKey="categoria"
          dataSource={columnasEdicion}
          columns={[
            { title: 'Insumo', dataIndex: 'nombre' },
            { title: 'Estándar', key: 'e', align: 'right' as const, render: (_: unknown, c: typeof columnasEdicion[number]) => c.estandar == null ? '—' : `${num(c.estandar)} ${c.unidad}` },
            {
              title: 'En esta máquina', key: 'm', render: (_: unknown, c: typeof columnasEdicion[number]) => {
                const v = borrador[c.categoria] ?? null
                const cambio = c.estandar != null && v != null && v !== c.estandar
                return (
                  <Space>
                    <InputNumber size="small" min={0} step={c.unidad === 'und' ? 1 : 0.5} value={v} addonAfter={c.unidad}
                      onChange={(n) => setBorrador({ ...borrador, [c.categoria]: n == null || Number(n) === 0 ? null : Number(n) })} />
                    {cambio && <Tag color="orange">{v! > c.estandar! ? '+' : ''}{num(v! - c.estandar!)}</Tag>}
                  </Space>
                )
              },
            },
          ]}
        />
      </Modal>
    </Spin>
  )
}
