import { useMemo, useEffect, useState } from 'react'
import { List, Avatar, Typography, Tag, Input, Space, Card, Spin } from 'antd'
import { SearchOutlined, DesktopOutlined, EnvironmentOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../api/services/api'
import { useAuth } from '../../hooks/useAuth'

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

const HomeMobile = () => {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [maquinas, setMaquinas] = useState<MaquinaRow[]>([])
  const [perfilOperador, setPerfilOperador] = useState<any>(null)
  const navigate = useNavigate()
  const { usuario } = useAuth()

  useEffect(() => {
    let active = true
    const cargar = async () => {
      try {
        setLoading(true)
        const [maquinasRaw, operadoresRaw] = await Promise.all([
          apiService.get<any[]>('/maquinas?limit=100').catch(() => []),
          apiService.get<any[]>('/operadores').catch(() => []),
        ])
        const maqList = Array.isArray(maquinasRaw) ? maquinasRaw : (maquinasRaw?.data ?? [])
        const opList = Array.isArray(operadoresRaw) ? operadoresRaw : (operadoresRaw?.data ?? [])
        const idUsuario = usuario?.idUsuario ?? usuario?.id

        let idOperadorActual: number | null = null
        let opActual: any = null
        const matchOp = opList.find((o: any) => o.idUsuario === idUsuario || o.usuario?.idUsuario === idUsuario || Number(o.idUsuario) === Number(idUsuario))
        if (matchOp?.idOperador) {
          idOperadorActual = Number(matchOp.idOperador)
          opActual = matchOp
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

        if (opActual && active) {
          setPerfilOperador({
            _sinVinculo: false,
            nombre: opActual.nombreCompleto || usuario?.nombreCompleto || usuario?.nombre || 'Operador',
            email: opActual.email || opActual.usuario?.email || usuario?.email || '',
            usuarioLogin: opActual.usuarioLogin || opActual.usuario?.usuarioLogin || usuario?.usuario_login || usuario?.usuarioLogin || '',
            zona: opActual.zonaAsignada || '',
            documento: opActual.numeroDocumento || opActual.usuario?.numeroDocumento || '',
            telefono: opActual.telefono || '',
            estado: (opActual.estado === false || opActual.usuario?.estado === false) ? 'INACTIVO' : 'ACTIVO',
            fechaIngreso: opActual.fechaIngreso,
            idOperador: idOperadorActual,
          })
        } else if (active) {
          const rolStr = String(usuario?.rolNombre || usuario?.rol || '').toUpperCase()
          const esRolOperador = rolStr.includes('OPERADOR') || Number((usuario as any)?.idRol) === 4 || String((usuario as any)?.perfil || '').toUpperCase() === 'OPERADOR'
          setPerfilOperador({
            _sinVinculo: esRolOperador && !idOperadorActual,
            nombre: usuario?.nombreCompleto || usuario?.nombre || 'Operador',
            email: usuario?.email || '',
            usuarioLogin: usuario?.usuario_login || usuario?.usuarioLogin || '',
            zona: '',
            documento: '',
            telefono: '',
            estado: 'ACTIVO',
            idOperador: idOperadorActual,
          })
        }

        const rows: MaquinaRow[] = maqList
          .filter((m: any) => !idOperadorActual || Number(m.idOperador) === Number(idOperadorActual))
          .map((m: any) => ({
            id: Number(m.idMaquina),
            serial: m.serial || `MÁQ-${m.idMaquina}`,
            zona: m.ubicacionEsp || m.ubicacion_fisica || 'Sin ubicación',
            clienteNombre: m.cliente?.razonSocial || m.clienteNombre || 'Sin cliente',
            tipo: (['SNACK','BEBIDA','CAFE','COMBINADA'].includes(String(m.tipo || '').toUpperCase()) ? (m.tipo as any) : 'COMBINADA'),
            base: Number(m.base ?? 0),
            fechaUltimaVisita: m.fechaUltimaVisita || m.fecha_ultima_visita || null,
            idOperador: m.idOperador ? Number(m.idOperador) : undefined,
          }))
        if (active) setMaquinas(rows)
      } catch (e: any) {
        console.error('[HomeMobile] error cargar:', e)
        setMaquinas([])
      } finally {
        if (active) setLoading(false)
      }
    }
    cargar()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id, usuario?.idUsuario])

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
    <div style={{
      padding: '8px 10px 24px',
      maxWidth: 620,
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {perfilOperador && (
        <Card size="small" style={{
          marginBottom: 10, borderRadius: 12,
          border: perfilOperador._sinVinculo ? '1px solid #fff1b8' : '1px solid #e6f4ff',
          background: perfilOperador._sinVinculo ? '#fffbe6' : '#f0f7ff',
        }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <Avatar size={44} style={{ backgroundColor: '#1677ff', fontWeight: 'bold', fontSize: 18 }}>
                {(String(perfilOperador.nombre || 'OP').trim().charAt(0) || 'O').toUpperCase()}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title level={5} style={{ margin: 0 }}>{perfilOperador.nombre}</Title>
                <Space size={6} wrap style={{ marginTop: 2 }}>
              {perfilOperador._sinVinculo ? (
                <Tag color="warning" style={{ fontSize: 12, margin: 0 }}>⚠️ SIN OPERADOR VINCULADO. Contacta administrador</Tag>
              ) : perfilOperador.zona ? (
                <Tag color="blue" style={{ margin: 0 }}><EnvironmentOutlined /> {perfilOperador.zona}</Tag>
              ) : null}
              <Tag color={perfilOperador.estado === 'ACTIVO' ? 'green' : 'red'} style={{ margin: 0 }}>
                {perfilOperador.estado === 'ACTIVO' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />} {perfilOperador.estado}
              </Tag>
            </Space>
              </div>
            </div>
            <Space size={6} wrap style={{ marginTop: 2 }}>
              {perfilOperador.usuarioLogin ? (
                <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>👤 Usuario: {perfilOperador.usuarioLogin}</Tag>
              ) : null}
              {perfilOperador.email ? (
                <Tag style={{ fontSize: 11, margin: 0 }}>✉️ {perfilOperador.email}</Tag>
              ) : null}
              {perfilOperador.documento ? (
                <Tag style={{ fontSize: 11, margin: 0 }}>🆔 {perfilOperador.documento}</Tag>
              ) : null}
              {perfilOperador.telefono ? (
                <Tag style={{ fontSize: 11, margin: 0 }}>📞 {perfilOperador.telefono}</Tag>
              ) : null}
              {perfilOperador.idOperador ? (
                <Tag color="purple" style={{ fontSize: 11, margin: 0 }}>#Op {perfilOperador.idOperador}</Tag>
              ) : null}
            </Space>
          </Space>
        </Card>
      )}

      <Title level={4} style={{ margin: 0, marginBottom: 10, fontSize: 18 }}>
        <DesktopOutlined /> Mis Máquinas Asignadas
      </Title>

      <Card size="small" style={{ marginBottom: 10 }}>
        <Space size={6} wrap style={{ justifyContent: 'center' }}>
          <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>📋 Total: {stats.total}</Tag>
          <Tag color="volcano" style={{ fontSize: 12, padding: '2px 8px' }}>
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
        style={{ marginBottom: 10 }}
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
              style={{ padding: 0, marginBottom: 8, borderRadius: 12, overflow: 'hidden' }}
            >
              <Card
                onClick={() => navigate(`/mobile/inventario/${item.id}`)}
                hoverable
                size="small"
                style={{ width: '100%', padding: 4 }}
                title={
                  <Space wrap style={{ width: '100%' }}>
                    <Avatar size={32} icon={<DesktopOutlined />} style={{ backgroundColor: '#1677ff' }} />
                    <Space direction="vertical" size={0} style={{ flex: 1, minWidth: 140 }}>
                      <Text strong style={{ fontSize: 15 }}>{item.serial}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        <EnvironmentOutlined /> {item.zona}
                      </Text>
                    </Space>
                    <Tag color={item.fechaUltimaVisita ? 'green' : 'default'} icon={<ClockCircleOutlined />} style={{ fontSize: 11, margin: 0 }}>
                      {formatearFecha(item.fechaUltimaVisita)}
                    </Tag>
                  </Space>
                }
              >
                <Space wrap size={6}>
                  <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>{item.tipo}</Tag>
                  <Tag style={{ fontSize: 11, margin: 0 }}>🏢 {item.clienteNombre}</Tag>
                  <Tag color="volcano" style={{ fontSize: 11, margin: 0 }}>
                    💰 Base: ${(item.base || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                  </Tag>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default HomeMobile
