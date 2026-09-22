import { Form, Input, Button, Card, Typography, message, Alert } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/auth.store'

const { Title, Paragraph } = Typography

const getHomeRoute = (usuario?: any) => {
  const rol = String(usuario?.rolNombre || usuario?.rol || '').toLowerCase()
  const perfil = String(usuario?.perfil || '').toLowerCase()
  if (rol.includes('operador') || perfil === 'operador' || perfil === 'operario') return '/mobile/home'
  if (rol.includes('bodega') || perfil === 'bodega') return '/despachos'
  if (rol.includes('tesorer') || perfil === 'tesoreria' || perfil === 'tesorero') return '/tesoreria/efectivo'
  return '/dashboard'
}

const Login = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, isAuth, usuario } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  useEffect(() => {
    if (isAuth) {
      const route = getHomeRoute(usuario)
      navigate(route, { replace: true })
    }
  }, [isAuth, usuario, navigate])

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(values.email, values.password)
      message.success('Inicio de sesión exitoso')
      const user = useAuthStore.getState().usuario
      navigate(getHomeRoute(user), { replace: true })
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Credenciales inválidas'
      setError(msg)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    form.setFieldsValue({ email: 'admin@example.com', password: 'Admin123*' })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: '#1677ff',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              fontWeight: 'bold',
            }}
          >
            V&C
          </div>
          <Title level={3} style={{ margin: 0 }}>
            ERP Vending & Catering
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            Inicia sesión para continuar
          </Paragraph>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            label="Email / Usuario"
            name="email"
            rules={[{ required: true, message: 'Ingresa tu email o usuario' }]}
          >
            <Input size="large" prefix={<UserOutlined />} placeholder="correo@empresa.com" />
          </Form.Item>
          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" size="large" loading={loading} block icon={<LoginOutlined />}>
              Iniciar Sesión
            </Button>
          </Form.Item>
          <Button size="small" type="link" onClick={fillDemo} block>
            (Demo) Llenar credenciales de prueba
          </Button>
        </Form>

        <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, fontSize: 12, marginBottom: 0 }}>
          © {new Date().getFullYear()} ERP Vending & Catering - Todos los derechos reservados
        </Paragraph>
      </Card>
    </div>
  )
}

export default Login
