import { Form, Input, Button, Card, Typography, message, Alert } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined, MobileOutlined, LogoutOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/auth.store'

const { Title, Paragraph } = Typography

const esOperador = (u?: any): boolean => {
  const rol = String(u?.rolNombre || u?.rol || '').toLowerCase()
  const perfil = String(u?.perfil || '').toLowerCase()
  return (
    rol.includes('operador') ||
    perfil === 'operador' ||
    perfil === 'operario' ||
    Number(u?.idRol) === 4
  )
}

const OperadorLogin = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, logout, isAuth, usuario } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  // Sesión activa de un operador → ir directo a su panel.
  // Si la sesión activa es de un usuario NO operador (admin/desarrollador), NO redirigir:
  // se muestra el cartel con el enlace compartible del portal para los operadores.
  useEffect(() => {
    if (!isAuth || !usuario) return
    if (esOperador(usuario)) {
      navigate('/mobile/home', { replace: true })
    }
  }, [isAuth, usuario, navigate])

  // Sesión activa de un NO operador (admin/desarrollador abriendo el portal para verlo/compartirlo)
  const sesionAdminAbierta = isAuth && usuario && !esOperador(usuario)
  const portalUrl = `${window.location.origin}/operador`

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(values.email, values.password)
      const user = useAuthStore.getState().usuario
      if (!esOperador(user)) {
        // El usuario autenticado no es operador: no puede entrar por este portal
        logout()
        setError('Este acceso es exclusivo para OPERADORES. Si es personal administrativo use el acceso principal.')
        setLoading(false)
        return
      }
      message.success('Bienvenido/a, operador')
      navigate('/mobile/home', { replace: true })
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Credenciales inválidas'
      setError(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSalirAdmin = () => {
    // Cierra la sesión administrativa y recarga para que el admin pueda probar el acceso como operador
    logout()
    window.location.reload()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', borderRadius: 12 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: 16, margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 40, background: '#08979c',
            }}
          >
            <MobileOutlined />
          </div>
          <Title level={3} style={{ margin: 0 }}>Portal del Operador</Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Acceso exclusivo para personal operativo
          </Paragraph>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {sesionAdminAbierta ? (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Vista para compartir con operadores"
              description="Ya tienes una sesión administrativa activa. Este portal es EXCLUSIVO para operadores y no rompe tu sesión. Comparte el siguiente enlace con tus operadores:"
            />
            <Card size="small" style={{ marginBottom: 16, background: '#f0fffb', borderColor: '#87e8de' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text code copyable style={{ flex: 1 }}>
                  {portalUrl}
                </Typography.Text>
              </div>
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                Los operadores abrirán este enlace, ingresarán con su usuario y contraseña, y solo verán su panel de máquinas y pedidos.
              </Paragraph>
            </Card>
            <Button block icon={<LogoutOutlined />} onClick={handleSalirAdmin}>
              Probar como operador (cerrar sesión admin)
            </Button>
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Usuario / Email" name="email" rules={[{ required: true, message: 'Ingresa tu usuario o email' }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder="usuario o correo" autoComplete="username" />
            </Form.Item>
            <Form.Item label="Contraseña" name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" size="large" loading={loading} block icon={<LoginOutlined />}>
                Ingresar a mi panel
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  )
}

export default OperadorLogin