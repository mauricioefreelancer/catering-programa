import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, InputNumber, List, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { ExperimentOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { get, post, put } from '../../api/services/api'
import { usePermissions } from '../../hooks/usePermissions'

type Categoria = { clave: string; nombre: string; unidad: string; cafe: boolean }
type Variante = 'GRANO' | 'SOLUBLE' | 'SIN_CAFE'
type ProductoReceta = {
  idProducto: number
  nombreProducto: string
  costoBase: number
  estado: boolean
  recetas: Record<Variante, Record<string, number>>
}
type BotonAfectado = { idMapaNrq: number; serial: string; boton: string; personalizado: boolean }

const VARIANTES: { clave: Variante; titulo: string; excluye: string[] }[] = [
  { clave: 'GRANO', titulo: '☕ Café en grano', excluye: ['CAFE_SOLUBLE'] },
  { clave: 'SOLUBLE', titulo: '☕ Café soluble', excluye: ['CAFE_GRANO'] },
  { clave: 'SIN_CAFE', titulo: '🍫 Sin café', excluye: ['CAFE_GRANO', 'CAFE_SOLUBLE'] },
]

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString('es-CO')}`

const RecetasEstandar = () => {
  const perm = usePermissions('productos')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<ProductoReceta[]>([])
  const [borradores, setBorradores] = useState<Record<string, Record<string, number | null>>>({})
  const [variante, setVariante] = useState<Variante>('GRANO')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [cat, est] = await Promise.all([
        get<{ categorias: Categoria[] }>('/recetas-cafe/categorias'),
        get<ProductoReceta[]>('/recetas-cafe/estandar'),
      ])
      setCategorias(cat.categorias)
      setProductos(est)
      setBorradores({})
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudieron cargar las recetas')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const llave = (idProducto: number, v: Variante) => `${idProducto}:${v}`
  const valor = (p: ProductoReceta, v: Variante, categoria: string) => {
    const b = borradores[llave(p.idProducto, v)]
    if (b && categoria in b) return b[categoria]
    return p.recetas[v]?.[categoria] ?? null
  }
  const cambiar = (p: ProductoReceta, v: Variante, categoria: string, nuevo: number | null) => {
    const k = llave(p.idProducto, v)
    setBorradores((prev) => ({ ...prev, [k]: { ...(prev[k] ?? {}), [categoria]: nuevo } }))
  }

  const aplicar = async (p: ProductoReceta, v: Variante, afectados: BotonAfectado[]) => {
    try {
      const r = await post<{ aplicados: number }>(`/recetas-cafe/estandar/${p.idProducto}/${v}/aplicar`, {})
      message.success(`Receta aplicada a ${r.aplicados} botón(es)`)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo aplicar a las máquinas')
    }
    void afectados
  }

  const guardar = async (p: ProductoReceta, v: Variante) => {
    const k = llave(p.idProducto, v)
    const columnas = categorias.filter((c) => !VARIANTES.find((x) => x.clave === v)!.excluye.includes(c.clave))
    const lineas = columnas
      .map((c) => ({ categoria: c.clave, cantidad: valor(p, v, c.clave) }))
      .filter((l) => l.cantidad != null && Number(l.cantidad) > 0)
    setGuardando(k)
    try {
      const r = await put<{ botonesAfectados: BotonAfectado[] }>(`/recetas-cafe/estandar/${p.idProducto}/${v}`, { lineas })
      message.success(`Receta de ${p.nombreProducto} guardada`)
      const afectados = r.botonesAfectados ?? []
      await cargar()
      if (afectados.length) {
        const normales = afectados.filter((b) => !b.personalizado)
        Modal.confirm({
          title: '¿Aplicar el cambio a las máquinas?',
          width: 520,
          okText: normales.length ? `Aplicar a ${normales.length} botón(es)` : 'Entendido',
          cancelText: 'No aplicar',
          okButtonProps: { disabled: false },
          content: (
            <>
              <p>Estos botones usan esta receta. Los personalizados conservan sus dosis; los demás se actualizan si confirmas.</p>
              <List
                size="small"
                dataSource={afectados}
                renderItem={(b) => (
                  <List.Item>
                    <Space>
                      <code>{b.serial}</code> botón <b>{b.boton}</b>
                      {b.personalizado ? <Tag color="orange">Personalizado: no cambia</Tag> : <Tag color="green">Se actualiza</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            </>
          ),
          onOk: () => (normales.length ? aplicar(p, v, afectados) : undefined),
        })
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'No se pudo guardar la receta')
    } finally {
      setGuardando(null)
    }
  }

  const tabla = (v: Variante) => {
    const columnas = categorias.filter((c) => !VARIANTES.find((x) => x.clave === v)!.excluye.includes(c.clave))
    return (
      <Table<ProductoReceta>
        rowKey="idProducto"
        size="small"
        loading={cargando}
        dataSource={productos}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <span>No hay productos terminados. Créalos en <Link to="/productos">Productos</Link> con la clasificación «Producto terminado (café)».</span> }}
        columns={[
          {
            title: 'Producto terminado', dataIndex: 'nombreProducto', fixed: 'left', width: 170,
            render: (n: string, p) => <span>{n}{!p.estado && <Tag style={{ marginLeft: 6 }}>Inactivo</Tag>}</span>,
          },
          ...columnas.map((c) => ({
            title: <div style={{ textAlign: 'center', lineHeight: 1.2 }}>{c.nombre}<br /><Typography.Text type="secondary">({c.unidad})</Typography.Text></div>,
            key: c.clave,
            width: 92,
            align: 'center' as const,
            render: (_: unknown, p: ProductoReceta) => (
              <InputNumber
                size="small"
                min={0}
                step={c.unidad === 'und' ? 1 : 0.5}
                precision={c.unidad === 'und' ? 0 : 2}
                value={valor(p, v, c.clave)}
                placeholder="—"
                disabled={!perm.editar}
                onChange={(n) => cambiar(p, v, c.clave, n == null || Number(n) === 0 ? null : Number(n))}
                style={{ width: 72 }}
              />
            ),
          })),
          {
            title: 'Costo estándar', key: 'costo', width: 100, align: 'right' as const,
            render: (_: unknown, p: ProductoReceta) => Object.keys(p.recetas[v] ?? {}).length
              ? <span title="Calculado con la variante grano si existe">{pesos(p.costoBase)}</span>
              : <Typography.Text type="secondary">Sin receta</Typography.Text>,
          },
          {
            title: '', key: 'acc', width: 100, fixed: 'right' as const,
            render: (_: unknown, p: ProductoReceta) => {
              const k = llave(p.idProducto, v)
              return perm.editar && borradores[k] ? (
                <Button type="primary" size="small" icon={<SaveOutlined />} loading={guardando === k} onClick={() => guardar(p, v)}>
                  Guardar
                </Button>
              ) : null
            },
          },
        ]}
      />
    )
  }

  const pendientes = useMemo(() => Object.keys(borradores).length, [borradores])

  return (
    <div>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}><ExperimentOutlined /> Recetas estándar de café</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={cargar}>Recargar</Button>
      </Space>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Dosificación de la empresa por producto terminado"
        description="Digita la dosis de cada insumo por taza. Deja la celda vacía si el producto no lleva ese insumo. Cada máquina copia esta receta en sus botones con solo los insumos que tiene, y se puede ajustar por máquina en Máquinas → Recetas por botón."
      />
      {pendientes > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Hay ${pendientes} receta(s) con cambios sin guardar`} />}
      <Tabs
        activeKey={variante}
        onChange={(k) => setVariante(k as Variante)}
        items={VARIANTES.map((x) => ({ key: x.clave, label: x.titulo, children: tabla(x.clave) }))}
      />
    </div>
  )
}

export default RecetasEstandar
