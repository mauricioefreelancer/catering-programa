import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

const NotFound404 = () => {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="404"
        title="404"
        subTitle="Lo sentimos, la página que visitaste no existe."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Volver al Dashboard
          </Button>
        }
      />
    </div>
  )
}

export default NotFound404
