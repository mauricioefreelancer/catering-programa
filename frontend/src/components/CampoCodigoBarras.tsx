import { useRef, useState, useEffect } from 'react'
import { Input, Radio, Button, Space, message, Tag } from 'antd'
import { BarcodeOutlined, KeyOutlined, ScanOutlined, ThunderboltOutlined } from '@ant-design/icons'

interface Props {
  value?: string
  onChange?: (v: string) => void
  required?: boolean
  disabled?: boolean
  label?: string
}

/**
 * Campo Código de Barras con dos modos:
 *  - "Digitar": el usuario escribe el código por teclado.
 *  - "Escáner": se activa la recepción del lector (USB HID, tipo teclado).
 *    El lector envía las teclas casi de golpe y termina con Enter; se detecta
 *    ese patrón y se asigna el código automáticamente.
 */
const CampoCodigoBarras: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [modo, setModo] = useState<'DIGITAR' | 'ESCANER'>('DIGITAR')
  const [escaneando, setEscaneando] = useState(false)
  const bufferRef = useRef('')
  const lastTimeRef = useRef(0)
  const inputRef = useRef<string>(value || '')

  // Mantener el valor sincronizado con el Form
  useEffect(() => {
    inputRef.current = value || ''
  }, [value])

  // Detección global de teclas para el escáner
  useEffect(() => {
    if (!escaneando) return

    const onKey = (e: KeyboardEvent) => {
      const now = Date.now()
      const elapsed = now - lastTimeRef.current

      // Enter: fin de la lectura del escáner -> asignar código y desactivar
      if (e.key === 'Enter') {
        e.preventDefault()
        const codigo = bufferRef.current.trim()
        if (codigo) {
          onChange?.(codigo)
          message.success(`Código leído: ${codigo}`)
        }
        bufferRef.current = ''
        lastTimeRef.current = 0
        setEscaneando(false)
        return
      }

      // Si tarda más de 40ms entre teclas, no es un lector (reiniciamos buffer)
      if (bufferRef.current && elapsed > 40) {
        bufferRef.current = ''
      }
      if (e.key && e.key.length === 1) {
        bufferRef.current += e.key
        lastTimeRef.current = now
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [escaneando, onChange])

  const activarEscaneo = () => {
    if (!escaneando) {
      bufferRef.current = ''
      lastTimeRef.current = 0
      setEscaneando(true)
    } else {
      setEscaneando(false)
    }
  }

  return (
    <div>
      <Radio.Group
        value={modo}
        onChange={(e) => setModo(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        size="middle"
        style={{ marginBottom: 8 }}
        disabled={disabled}
      >
        <Radio.Button value="DIGITAR" disabled={escaneando}>
          <KeyOutlined /> Digitar
        </Radio.Button>
        <Radio.Button value="ESCANER">
          <BarcodeOutlined /> Escáner
        </Radio.Button>
      </Radio.Group>

      {modo === 'DIGITAR' ? (
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Escanee o escriba el código de barras"
          prefix={<BarcodeOutlined />}
          allowClear
          disabled={disabled}
        />
      ) : (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="El código aparecerá aquí al escanear"
            prefix={<BarcodeOutlined />}
            disabled={disabled || escaneando}
          />
          <Button
            type={escaneando ? 'primary' : 'default'}
            danger={escaneando}
            icon={escaneando ? <ThunderboltOutlined /> : <ScanOutlined />}
            onClick={activarEscaneo}
            disabled={disabled}
          >
            {escaneando ? 'Detener' : 'Conectar'}
          </Button>
        </Space.Compact>
      )}

      {modo === 'ESCANER' && (
        <div style={{ marginTop: 8 }}>
          {escaneando ? (
            <Tag color="processing" icon={<ThunderboltOutlined />}>
              Lector activo… apunte y escanee el código
            </Tag>
          ) : (
            <Tag color="default">
              Pulse <b>Conectar</b>, escanee el código con el lector USB y se asignará automáticamente.
            </Tag>
          )}
        </div>
      )}
    </div>
  )
}

export default CampoCodigoBarras