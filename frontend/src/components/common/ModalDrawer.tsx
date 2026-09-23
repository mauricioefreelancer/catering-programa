import { ReactNode, useEffect, useRef } from 'react'
import { Drawer, Form, Button, Spin, Space } from 'antd'

interface ModalDrawerProps {
  title: string
  open: boolean
  onClose: () => void
  onSubmit: (values: any) => Promise<void> | void
  width?: number
  children: ReactNode
  initialValues?: any
  loading?: boolean
  submitText?: string
  footerExtra?: ReactNode
}

const ModalDrawer = ({
  title,
  open,
  onClose,
  onSubmit,
  width = 560,
  children,
  initialValues,
  loading = false,
  submitText = 'Guardar',
  footerExtra,
}: ModalDrawerProps) => {
  const [form] = Form.useForm()
  const prevOpen = useRef(false)

  useEffect(() => {
    // Solo hidratar el formulario en la TRANSICIÓN de abrir (false -> true)
    if (open && !prevOpen.current) {
      if (initialValues) {
        form.setFieldsValue(initialValues)
      } else {
        form.resetFields()
      }
    }
    prevOpen.current = open
  }, [open, form, initialValues])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await onSubmit(values)
    } catch {}
  }

  return (
    <Drawer
      title={title}
      width={width}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          {footerExtra}
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" onClick={handleOk} loading={loading}>
            {submitText}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" requiredMark={false} style={{ maxWidth: '100%' }}>
          {children}
        </Form>
      </Spin>
    </Drawer>
  )
}

export default ModalDrawer
