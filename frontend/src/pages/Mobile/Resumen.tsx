import { useState } from 'react'
import {
  Card,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
  Tag,
  Divider,
  Result,
  message,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { post } from '../../api/services/api'
import { offlineStore } from './offline.store'

const { Text } = Typography

interface MaquinaCfg {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  totalEspirales: number
  totalSugeridas: number
  ultimoNR: number
  nrActual: number
  totalNRQ: number
}

const MOCK_DB: Record<number, MaquinaCfg> = {
  1: { id: 1, serial: 'SNK-00123', zona: 'Piso 3 - Cafetería', clienteNombre: 'Alimentos S.A.S.', tipo: 'COMBINADA', totalEspirales: 10, totalSugeridas: 45, ultimoNR: 45210, nrActual: 45380, totalNRQ: 0 },
  3: { id: 3, serial: 'BEB-00789', zona: 'Edificio B', clienteNombre: 'Alimentos S.A.S.', tipo: 'BEBIDA', totalEspirales: 8, totalSugeridas: 29, ultimoNR: 21480, nrActual: 21590, totalNRQ: 0 },
  2: { id: 2, serial: 'CAF-00456', zona: 'Recepción Principal', clienteNombre: 'Empresa Servicios Ltda.', tipo: 'CAFE', totalEspirales: 0, totalSugeridas: 0, ultimoNR: 89320, nrActual: 89520, totalNRQ: 250 },
  5: { id: 5, serial: 'CAF-00789', zona: 'Piso 5 - Lounge', clienteNombre: 'Alimentos S.A.S.', tipo: 'CAFE', totalEspirales: 0, totalSugeridas: 0, ultimoNR: 62100, nrActual: 62250, totalNRQ: 180 },
  6: { id: 6, serial: 'SNK-00555', zona: 'Centro Comercial L101', clienteNombre: 'Industrias Alimenticias', tipo: 'SNACK', totalEspirales: 8, totalSugeridas: 67, ultimoNR: 33180, nrActual: 33340, totalNRQ: 0 },
}

const ResumenMobile = () => {
  const { idMaquina } = useParams()
  const navigate = useNavigate()
  const id = Number(idMaquina) || 1
  const maq = MOCK_DB[id] || MOCK_DB[1]

  const diffNR = maq.nrActual - maq.ultimoNR
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)

  const save = async (forceOffline = false) => {
    setSaving(true)
    setOfflineSaved(false)
    try {
      const payload = {
        maquinaId: id,
        maquinaSerial: maq.serial,
        espirales: [],
        nr_actual: maq.nrActual,
        nrq: [],
        savedAt: Date.now(),
      }
      if (!forceOffline) {
        await post('/inventarios/operario', payload)
      } else {
        throw new Error('FORCE_OFFLINE')
      }
      setSavedOk(true)
      message.success('✅ Inventario enviado correctamente')
    } catch (e: any) {
      await offlineStore.addPending({
        maquinaId: id,
        maquinaSerial: maq.serial,
        espirales: [],
        nr_actual: maq.nrActual,
        nrq: [],
      } as any)
      setOfflineSaved(true)
      setSavedOk(true)
      message.warning('📴 Sin conexión: Guardado OFFLINE. Sincronizará luego.')
    } finally {
      setSaving(false)
    }
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
            : `Inventario para ${maq.serial} procesado. ${maq.totalSugeridas} unidades sugeridas para despacho.`
        }
        extra={[
          <Button type="primary" size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile/home')}>
            Volver a Lista Máquinas
          </Button>,
        ]}
      />
    )
  }

  return (
    <div>
      <Button type="link" onClick={() => navigate(`/mobile/contadores/${id}`)} icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 4 }}>
        Volver a Contadores
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
          </Col>
        </Row>
      </Card>

      <Card title="📋 Resumen General del Inventario">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Row gutter={8}>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Espirales Revisadas" value={maq.totalEspirales} suffix="unid." />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Unid. Sugeridas" value={maq.totalSugeridas} valueStyle={{ color: '#1677ff' }} suffix="pzs" />
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '6px 0' }} />

          <Row gutter={8}>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="NR Anterior" value={maq.ultimoNR} />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="NR Actual" value={maq.nrActual} />
              </Card>
            </Col>
          </Row>
          <Row>
            <Col xs={24}>
              <Card size="small" style={{ background: diffNR >= 0 ? '#f6ffed' : '#fff2f0' }}>
                <Statistic
                  title="Consumo NR Período"
                  value={diffNR}
                  valueStyle={{ color: diffNR >= 0 ? '#52c41a' : '#ff4d4f' }}
                  prefix={diffNR >= 0 ? '+' : ''}
                  suffix="dispensas"
                />
              </Card>
            </Col>
          </Row>

          {maq.tipo === 'CAFE' && (
            <>
              <Divider />
              <Row>
                <Col xs={24}>
                  <Card size="small" style={{ background: '#f9f0ff' }}>
                    <Statistic
                      title="☕ Total Dosificaciones NRQ"
                      value={maq.totalNRQ}
                      valueStyle={{ color: '#722ed1' }}
                      suffix="vasos"
                    />
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <Button type="primary" size="large" loading={saving} icon={<SaveOutlined />} onClick={() => save()}>
          💾 Guardar y Sincronizar (Online)
        </Button>
        <Button size="large" loading={saving} icon={<SyncOutlined />} onClick={() => save(true)}>
          📴 Guardar local (Offline)
        </Button>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/mobile/contadores/${id}`)}>
          Corregir Datos
        </Button>
      </div>
    </div>
  )
}

export default ResumenMobile
