import { useState, useMemo } from 'react'
import {
  Card,
  Button,
  InputNumber,
  Typography,
  Space,
  Table,
  Tag,
  Divider,
  Row,
  Col,
  message,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'

const { Text } = Typography

interface NRQRow {
  key: string
  boton: string
  productoNombre: string
  valor: number
}

interface MaquinaCfg {
  id: number
  serial: string
  zona: string
  clienteNombre: string
  tipo: 'SNACK' | 'BEBIDA' | 'CAFE' | 'COMBINADA'
  botonesNRQ: NRQRow[]
  ultimoNR: number
}

const MOCK_DB: Record<number, MaquinaCfg> = {
  2: {
    id: 2, serial: 'CAF-00456', zona: 'Recepción Principal', clienteNombre: 'Empresa Servicios Ltda.', tipo: 'CAFE', ultimoNR: 89320,
    botonesNRQ: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map((b, i) => ({
      key: b, boton: b,
      productoNombre: ['Café Negro', 'Café con Leche', 'Chocolate', 'Cappuccino', 'Té Negro', 'Mocaccino'][i],
      valor: 0,
    })),
  },
  5: {
    id: 5, serial: 'CAF-00789', zona: 'Piso 5 - Lounge', clienteNombre: 'Alimentos S.A.S.', tipo: 'CAFE', ultimoNR: 62100,
    botonesNRQ: ['B1', 'B2', 'B3', 'B4'].map((b, i) => ({
      key: b, boton: b,
      productoNombre: ['Café Negro', 'Café con Leche', 'Chocolate', 'Té'][i],
      valor: 0,
    })),
  },
  1: {
    id: 1, serial: 'SNK-00123', zona: 'Piso 3 - Cafetería', clienteNombre: 'Alimentos S.A.S.', tipo: 'COMBINADA', ultimoNR: 45210,
    botonesNRQ: [],
  },
  3: {
    id: 3, serial: 'BEB-00789', zona: 'Edificio B', clienteNombre: 'Alimentos S.A.S.', tipo: 'BEBIDA', ultimoNR: 21480,
    botonesNRQ: [],
  },
  6: {
    id: 6, serial: 'SNK-00555', zona: 'Centro Comercial L101', clienteNombre: 'Industrias Alimenticias', tipo: 'SNACK', ultimoNR: 33180,
    botonesNRQ: [],
  },
}

const ContadoresMobile = () => {
  const { idMaquina } = useParams()
  const navigate = useNavigate()
  const id = Number(idMaquina) || 1
  const maq = MOCK_DB[id] || MOCK_DB[1]

  const [botones, setBotones] = useState<NRQRow[]>(maq.botonesNRQ.map((b) => ({ ...b })))
  const [nrActual, setNrActual] = useState<number | null>(null)

  const diffNR = nrActual !== null ? nrActual - maq.ultimoNR : 0

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

  const canContinue = () => {
    if (nrActual === null || nrActual < maq.ultimoNR) return false
    if (maq.tipo === 'CAFE') {
      const total = botones.reduce((s, b) => s + (b.valor || 0), 0)
      if (total === 0) return false
    }
    return true
  }

  return (
    <div>
      <Button type="link" onClick={() => navigate(`/mobile/inventario/${id}`)} icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: 4 }}>
        Volver a Inventario
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
                  size="middle"
                  rowKey="key"
                  dataSource={botones}
                  columns={colsNRQ}
                  pagination={false}
                  scroll={{ y: 400 }}
                />
              </div>
            </>
          )}
        </Space>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/mobile/inventario/${id}`)}>
          Atrás
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<ArrowRightOutlined />}
          disabled={!canContinue()}
          onClick={() => {
            message.info('Datos de contadores guardados temporalmente')
            navigate(`/mobile/resumen/${id}`)
          }}
        >
          Continuar a Resumen
        </Button>
      </div>
    </div>
  )
}

export default ContadoresMobile
