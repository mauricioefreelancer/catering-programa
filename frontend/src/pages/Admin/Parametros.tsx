import { useEffect, useState } from 'react'
import { Button, Card, InputNumber, Space, Spin, message } from 'antd'
import { apiService } from '../../api/services/api'

type Parametro = { clave: string; valor: string; descripcion: string }

export default function Parametros() {
  const [filas, setFilas] = useState<Parametro[]>([])
  const [valores, setValores] = useState<Record<string, number | null>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState('')

  useEffect(() => {
    apiService.get<Parametro[]>('/admin/parametros').then(datos => {
      setFilas(datos)
      setValores(Object.fromEntries(datos.map(p => [p.clave, Number(p.valor)])))
    }).catch(() => message.error('No se pudieron cargar los parámetros')).finally(() => setCargando(false))
  }, [])

  const guardar = async (clave: string) => {
    const valor = valores[clave]
    if (valor == null || valor < 0) return
    setGuardando(clave)
    try {
      const actualizado = await apiService.patch<Parametro>(`/admin/parametros/${clave}`, { valor })
      setFilas(f => f.map(p => p.clave === clave ? actualizado : p))
      message.success('Tolerancia actualizada para las próximas visitas')
    } catch (error: any) {
      message.error(error?.response?.data?.message ?? 'No se pudo guardar el parámetro')
    } finally { setGuardando('') }
  }

  return <Spin spinning={cargando}><Card title="Parámetros del sistema">
    <Space direction="vertical" size="middle">
      <p>Los cambios no modifican las alertas guardadas en visitas anteriores.</p>
      {filas.map(p => <Space key={p.clave} wrap>
        <label htmlFor={p.clave}>{p.descripcion}</label>
        <InputNumber id={p.clave} value={valores[p.clave]} min={0} max={Number.MAX_SAFE_INTEGER} precision={2}
          onChange={(valor: number | null) => setValores(a => ({ ...a, [p.clave]: valor }))} />
        <Button onClick={() => guardar(p.clave)} loading={guardando === p.clave}
          disabled={!!guardando || valores[p.clave] == null || valores[p.clave] === Number(p.valor)}>Guardar</Button>
      </Space>)}
    </Space>
  </Card></Spin>
}
