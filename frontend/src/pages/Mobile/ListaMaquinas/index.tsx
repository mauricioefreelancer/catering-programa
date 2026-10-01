import { useMemo } from 'react'
import { List, Avatar, Typography, Tag, Input, Space, Card, Spin } from 'antd'
import { SearchOutlined, DesktopOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../../api/services/api'
import { useAuth } from '../../../hooks/useAuth'

const { Title, Text } = Typography

interface MaquinaRow {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  base: number
  fechaUltimaVisita: string | null
  idOperador?: number
}

const formatearFecha = (f: string | null | undefined): string => {
  if (!f) return 'Nunca visitada'
  const d = new Date(f)
  if (isNaN(d.getTime())) return 'Nunca visitada'
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

const ListaMaquinas = () => {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [maquinas, setMaquinas] = useState<MaquinaRow[]>([])
  const navigate = useNavigate()
  const { usuario } = useAuth()

  useEffect(() => {
    let active = true
    const cargar = async () => {
      try {
        setLoading(true)
        const [maquinasRaw, operadoresRaw] = await Promise.all([
          apiService.get<any[]>('/maquinas?limit=200').catch(() => []),
          apiService.get<any[]>('/operadores').catch(() => []),
        ])
        const maqList = Array.isArray(maquinasRaw) ? maquinasRaw : (maquinasRaw?.data ?? [])
        const opList = Array.isArray(operadoresRaw) ? operadoresRaw : (operadoresRaw?.data ?? [])
        const idUsuario = usuario?.id

        let idOperadorActual: number | null = null
        const matchOp = opList.find((o: any) => o.idUsuario === idUsuario || o.usuario?.idUsuario === idUsuario || Number(o.idUsuario) === Number(idUsuario))
        if (matchOp?.idOperador) {
          idOperadorActual = Number(matchOp.idOperador)
        } else {
          const matchMaq = maqList.find((m: any) =>
            m.operador?.idUsuario === idUsuario ||
            m.operadorUsuario?.idUsuario === idUsuario ||
            m.operador?.usuario?.idUsuario === idUsuario
          )
          if (matchMaq?.idOperador) {
            idOperadorActual = Number(matchMaq.idOperador)
          } else if ((usuario as any)?.perfil === 'OPERADOR' && maqList.length > 0 && maqList.every((m: any) => Number(m.idOperador) === Number(maqList[0].idOperador))) {
            idOperadorActual = Number(maqList[0].idOperador)
          }
        }

        const rows: MaquinaRow[] = maqList
          .filter((m: any) => !idOperadorActual || Number(m.idOperador) === Number(idOperadorActual))
          .map((m: any) => ({
            id: Number(m.idMaquina || m.id),
            serial: m.serial || `MÁQ-${m.idMaquina || m.id}`,
            zona: m.ubicacionEsp || m.ubicacion_fisica || m.zona || 'Sin ubicación',
            clienteNombre: m.cliente?.razonSocial || m.clienteNombre || m.cliente?.nombre || 'Sin cliente',
            tipo: (['SNACK','BEBIDA','CAFE','COMBINADA'].includes(String(m.tipo || '').toUpperCase()) ? (m.tipo as any) : 'COMBINADA'),
            base: Number(m.base ?? 0),
            fechaUltimaVisita: m.fechaUltimaVisita || m.fecha_ultima_visita || null,
            idOperador: m.idOperador ? Number(m.idOperador) : undefined,
          }))
        if (active) setMaquinas(rows)
      } catch (e: any) {
        console.error('[ListaMaquinas] error cargar:', e)
        setMaquinas([])
      } finally {
        if (active) setLoading(false)
      }
    }
    cargar()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  const filtered = useMemo(
    () =>
      maquinas.filter(
        (m) => !search || (m.serial + m.zona + m.clienteNombre).toLowerCase().includes(search.toLowerCase())
      ),
    [maquinas, search]
  )

  const stats = useMemo(() => ({
    total: maquinas.length,
    baseTotal: maquinas.reduce((acc, m) => acc + (m.base || 0), 0),
  }), [maquinas])

  return (
    <div>
      <Title level={4} style={{ margin: 0, marginBottom: 12 }}>
        <DesktopOutlined /> Mis Máquinas Asignadas
      </Title>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size="middle" wrap>
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px' }}>📋 Total: {stats.total}</Tag>
          <Tag color="volcano" style={{ fontSize: 14, padding: '4px 10px' }}>
            💰 Base Total: ${stats.baseTotal.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
          </Tag>
        </Space>
      </Card>

      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder="Buscar serial, zona, cliente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Cargando máquinas asignadas..." />
        </div>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={filtered}
          locale={{ emptyText: 'No hay máquinas asignadas. Contacta al administrador.' }}
          renderItem={(item) => (
            <List.Item
              style={{ padding: 0, marginBottom: 10, borderRadius: 12, overflow: 'hidden' }}
            >
              <Card
                onClick={() => navigate(`/mobile/inventario/${item.id}`)}
                hoverable
                size="small"
                style={{ width: '100%' }}
                title={
                  <Space wrap>
                    <Avatar icon={<DesktopOutlined />} style={{ backgroundColor: '#1677ff' }} />
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: 16 }}>{item.serial}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <EnvironmentOutlined /> {item.zona}
                      </Text>
                    </Space>
                    <div style={{ marginLeft: 'auto' }}>
                      <Tag color={item.fechaUltimaVisita ? 'green' : 'default'} icon={<ClockCircleOutlined />}>
                        Última visita: {formatearFecha(item.fechaUltimaVisita)}
                      </Tag>
                    </div>
                  </Space>
                }
              >
                <Space wrap>
                  <Tag color="geekblue">{item.tipo}</Tag>
                  <Tag>🏢 {item.clienteNombre}</Tag>
                  <Tag color="volcano">💰 Base: ${(item.base || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</Tag>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default ListaMaquinas
