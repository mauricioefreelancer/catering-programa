import { ReactNode, useEffect } from 'react'
import { Drawer, Form, Button, Spin, Space, message } from 'antd'

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

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (initialValues) {
        form.setFieldsValue(initialValues)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await onSubmit(values)
    } catch (err: any) {
      if (err && err.errorFields && err.errorFields.length) {
        message.error('Por favor complete los campos obligatorios marcados en rojo antes de guardar.')
      } else if (err && err.message) {
        message.error(err.message)
      }
    }
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
        <Form form={form} layout="vertical" requiredMark={false} style={{ maxWidth: '100%' }} initialValues={initialValues}>
          {children}
        </Form>
      </Spin>
    </Drawer>
  )
}

export default ModalDrawer
