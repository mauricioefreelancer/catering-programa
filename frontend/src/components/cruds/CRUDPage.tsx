import { useState, useMemo, ReactNode } from 'react'
import {
  Table,
  Button,
  Input,
  Space,
  Popconfirm,
  message,
  Typography,
  Form,
  Card,
} from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import ModalDrawer from '../common/ModalDrawer'
import { usePermissions } from '../../hooks/usePermissions'

const { Title } = Typography

export interface CRUDPageConfig<T extends Record<string, any>> {
  title: string
  modulo: string
  endpoint?: string
  initialData?: T[]
  columns: TableColumnsType<T> & { dataIndex?: keyof T }[]
  searchFields?: (keyof T)[]
  searchPlaceholder?: string
  formFields: ReactNode
  formInitialValues?: Partial<T>
  onSubmit?: (values: any, editing: T | null) => Promise<void> | void
  onDelete?: (record: T) => Promise<void> | void
  idKey?: keyof T
  rowKey?: string
  pageSize?: number
  showNewButton?: boolean
  extraHeader?: ReactNode
}

function CRUDPage<T extends Record<string, any>>(config: CRUDPageConfig<T>) {
  const {
    title,
    modulo,
    initialData = [],
    columns,
    searchFields,
    searchPlaceholder = 'Buscar...',
    formFields,
    formInitialValues,
    onSubmit,
    onDelete,
    idKey = 'id' as any,
    rowKey = 'id',
    pageSize = 10,
    showNewButton = true,
    extraHeader,
  } = config

  const [data, setData] = useState<T[]>(initialData)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const perm = usePermissions(modulo)

  const filtered = useMemo(() => {
    if (!search || !searchFields || searchFields.length === 0) return data
    const s = search.toLowerCase()
    return data.filter((r) =>
      searchFields.some((f) => {
        const val = r[f]
        return val !== undefined && val !== null && String(val).toLowerCase().includes(s)
      })
    )
  }, [data, search, searchFields])

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      if (onSubmit) {
        await onSubmit(values, editing)
      }
      if (editing) {
        setData(data.map((c) => (c[idKey] === editing[idKey] ? { ...c, ...values } : c)))
        message.success('Registro actualizado')
      } else {
        const newId = Math.max(0, ...data.map((d) => (d[idKey] as number) || 0)) + 1
        setData([...data, { [idKey]: newId, ...values } as T])
        message.success('Registro creado')
      }
      setOpen(false)
      setEditing(null)
    } catch (e: any) {
      message.error(e?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (record: T) => {
    try {
      if (onDelete) {
        await onDelete(record)
      }
      setData(data.filter((c) => c[idKey] !== record[idKey]))
      message.success('Registro eliminado')
    } catch (e: any) {
      message.error(e?.message || 'Error al eliminar')
    }
  }

  const actionColumns = columns.slice()
  if (perm.editar || perm.eliminar) {
    actionColumns.push({
      title: 'Acciones',
      key: 'acciones',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, r: T) => (
        <Space>
          {perm.editar && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(r)
                setOpen(true)
              }}
            >
              Editar
            </Button>
          )}
          {perm.eliminar && (
            <Popconfirm
              title="¿Eliminar registro?"
              onConfirm={() => handleDelete(r)}
              okText="Sí"
              cancelText="No"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                Eliminar
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        <Space>
          {searchFields && searchFields.length > 0 && (
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              style={{ width: 320 }}
            />
          )}
          {extraHeader}
          {showNewButton && perm.crear && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              Nuevo
            </Button>
          )}
        </Space>
      </div>

      <Card style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <Table
          rowKey={rowKey as any}
          dataSource={filtered}
          columns={actionColumns as any}
          pagination={{
            pageSize,
            showSizeChanger: true,
            showTotal: (t: any) => `Total ${t} registros`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <ModalDrawer
        title={editing ? `Editar ${title}` : `Nuevo ${title}`}
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={(editing as any) || formInitialValues}
        loading={loading}
      >
        {typeof formFields === 'function' ? (formFields as any)({ editing }) : formFields}
      </ModalDrawer>
    </div>
  )
}

export default CRUDPage
