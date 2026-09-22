import { useEffect, useMemo, useState } from 'react'
import {
  Layout,
  Menu,
  Table,
  Button,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
  Typography,
  Form,
  Modal,
  Card,
  Row,
  Col,
  Statistic,
  InputNumber,
  Switch,
  Select,
  Alert,
  Tooltip,
  Divider,
} from 'antd'
import {
  DatabaseOutlined,
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleFilled,
  InfoCircleOutlined,
  TableOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { apiService } from '../../../api/services/api'

const { Title, Text, Paragraph } = Typography
const { Sider, Content } = Layout
const { Option } = Select

interface MetaInfo {
  tables: { tableName: string; comment: string | null; rowCount: number; protected: boolean }[]
  foreignKeys: { tableName: string; columnName: string; foreignTableName: string; foreignColumnName: string; constraintName: string }[]
  columns: { tableName: string; columnName: string; dataType: string; isNullable: string; columnDefault: string | null; charMaxLen: number | null; ordinalPosition: number }[]
  primaryKeys: { tableName: string; columnName: string }[]
}

const fmtType = (t: string) =>
  ({
    integer: 'INT',
    bigint: 'BIGINT',
    smallint: 'SMALLINT',
    numeric: 'DECIMAL',
    decimal: 'DECIMAL',
    'character varying': 'VARCHAR',
    text: 'TEXT',
    boolean: 'BOOL',
    jsonb: 'JSONB',
    json: 'JSON',
    'timestamp without time zone': 'TIMESTAMP',
    'timestamp with time zone': 'TIMESTAMPTZ',
    date: 'DATE',
    'USER-DEFINED': 'ENUM',
  }[t] || t.toUpperCase())

const col = (table: string, columnName: string, dataType: string, opts: Partial<MetaInfo['columns'][number]> = {}): MetaInfo['columns'][number] => ({
  tableName: table, columnName, dataType,
  isNullable: opts.isNullable ?? 'YES',
  columnDefault: opts.columnDefault ?? null,
  charMaxLen: opts.charMaxLen ?? null,
  ordinalPosition: opts.ordinalPosition ?? 0,
})

const FALLBACK_META: MetaInfo = {
  tables: [
    { tableName: 'PRODUCTOS', comment: 'Catálogo Productos (3 Tipos: ESTANDAR / MATERIA_PRIMA / DOSIFICADO)', rowCount: 4, protected: false },
    { tableName: 'RECETAS_DOSIFICADOS', comment: 'Recetas Productos DOSIFICADOS (Producto Terminado ↔ Materia Prima + Cantidad Dosis)', rowCount: 1, protected: false },
    { tableName: 'PRECIOS_CLIENTE', comment: 'Matriz Precios por Cliente (Manual Sección 1.1)', rowCount: 12, protected: false },
    { tableName: 'CLIENTES', comment: 'Clientes (Empresas con Máquinas / Tiendas / Puntos Venta)', rowCount: 3, protected: false },
    { tableName: 'PROVEEDORES', comment: 'Proveedores Materia Prima / Productos Estándar', rowCount: 3, protected: false },
    { tableName: 'MAQUINAS_Y_TIENDAS', comment: 'Máquinas Vending / Tiendas / Cafeteras NRQ', rowCount: 3, protected: false },
    { tableName: 'ROLES_PERFILES', comment: 'Roles y Matriz Permisos CRUD JSONB (Administrador Maestro, Bodega, Tesorería, Operador)', rowCount: 4, protected: false },
    { tableName: 'USUARIOS_SISTEMA', comment: 'Usuarios Panel Web + Contraseña Hash + Rol FK', rowCount: 2, protected: false },
    { tableName: 'OPERADORES', comment: 'Operadores Campo Móvil (Punto Venta / Despacho)', rowCount: 2, protected: false },
    { tableName: 'MAPA_MATERIA_PRIMA', comment: 'Mapa Espirales Máquinas Snacks/Bebidas ↔ Producto', rowCount: 6, protected: false },
    { tableName: 'MAPA_CAFE_NRQ', comment: 'Mapa Botones Cafeteras NRQ ↔ Producto Dosificado', rowCount: 6, protected: false },
  ],
  foreignKeys: [
    { tableName: 'PRODUCTOS', columnName: 'ID_Proveedor', foreignTableName: 'PROVEEDORES', foreignColumnName: 'ID_Proveedor', constraintName: 'fk_producto_proveedor' },
    { tableName: 'RECETAS_DOSIFICADOS', columnName: 'ID_Prod_Term', foreignTableName: 'PRODUCTOS', foreignColumnName: 'ID_Producto', constraintName: 'fk_receta_productoterm' },
    { tableName: 'RECETAS_DOSIFICADOS', columnName: 'ID_Mat_Prima', foreignTableName: 'PRODUCTOS', foreignColumnName: 'ID_Producto', constraintName: 'fk_receta_materiaprima' },
    { tableName: 'PRECIOS_CLIENTE', columnName: 'ID_Cliente', foreignTableName: 'CLIENTES', foreignColumnName: 'ID_Cliente', constraintName: 'fk_precio_cliente' },
    { tableName: 'PRECIOS_CLIENTE', columnName: 'ID_Producto', foreignTableName: 'PRODUCTOS', foreignColumnName: 'ID_Producto', constraintName: 'fk_precio_producto' },
    { tableName: 'MAQUINAS_Y_TIENDAS', columnName: 'ID_Cliente', foreignTableName: 'CLIENTES', foreignColumnName: 'ID_Cliente', constraintName: 'fk_maquina_cliente' },
    { tableName: 'MAQUINAS_Y_TIENDAS', columnName: 'ID_Operador', foreignTableName: 'OPERADORES', foreignColumnName: 'ID_Operador', constraintName: 'fk_maquina_operador' },
    { tableName: 'USUARIOS_SISTEMA', columnName: 'ID_Rol', foreignTableName: 'ROLES_PERFILES', foreignColumnName: 'ID_Rol', constraintName: 'fk_usuario_rol' },
    { tableName: 'OPERADORES', columnName: 'ID_Usuario', foreignTableName: 'USUARIOS_SISTEMA', foreignColumnName: 'ID_Usuario', constraintName: 'fk_operador_usuario' },
    { tableName: 'MAPA_MATERIA_PRIMA', columnName: 'ID_Maquina', foreignTableName: 'MAQUINAS_Y_TIENDAS', foreignColumnName: 'ID_Maquina', constraintName: 'fk_mapmp_maquina' },
    { tableName: 'MAPA_MATERIA_PRIMA', columnName: 'ID_Producto', foreignTableName: 'PRODUCTOS', foreignColumnName: 'ID_Producto', constraintName: 'fk_mapmp_producto' },
    { tableName: 'MAPA_CAFE_NRQ', columnName: 'ID_Maquina', foreignTableName: 'MAQUINAS_Y_TIENDAS', foreignColumnName: 'ID_Maquina', constraintName: 'fk_mapcafe_maquina' },
    { tableName: 'MAPA_CAFE_NRQ', columnName: 'ID_Producto', foreignTableName: 'PRODUCTOS', foreignColumnName: 'ID_Producto', constraintName: 'fk_mapcafe_producto' },
  ],
  columns: [
    col('PRODUCTOS', 'ID_Producto', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('PRODUCTOS', 'ID_Proveedor', 'integer', { ordinalPosition: 2 }),
    col('PRODUCTOS', 'Codigo_Barras', 'character varying', { charMaxLen: 100, isNullable: 'NO', ordinalPosition: 3 }),
    col('PRODUCTOS', 'Nombre_Producto', 'character varying', { charMaxLen: 250, isNullable: 'NO', ordinalPosition: 4 }),
    col('PRODUCTOS', 'Tipo_Producto', 'character varying', { charMaxLen: 30, columnDefault: "'ESTANDAR'", ordinalPosition: 5, isNullable: 'NO' }),
    col('PRODUCTOS', 'Unidad_Compra', 'character varying', { charMaxLen: 50, columnDefault: "'Unidad'", ordinalPosition: 6, isNullable: 'NO' }),
    col('PRODUCTOS', 'Unidad_Consumo', 'character varying', { charMaxLen: 50, columnDefault: "'Unidad'", ordinalPosition: 7, isNullable: 'NO' }),
    col('PRODUCTOS', 'Equivalencia', 'numeric', { ordinalPosition: 8, isNullable: 'NO' }),
    col('PRODUCTOS', 'Costo_Base', 'numeric', { ordinalPosition: 9, isNullable: 'NO' }),
    col('PRODUCTOS', 'Porcentaje_Imp', 'numeric', { ordinalPosition: 10, isNullable: 'NO' }),
    col('PRODUCTOS', 'Costo_Total', 'numeric', { ordinalPosition: 11, isNullable: 'NO' }),
    col('PRODUCTOS', 'Stock_Min', 'integer', { ordinalPosition: 12, isNullable: 'NO' }),
    col('PRODUCTOS', 'Stock_Max', 'integer', { ordinalPosition: 13, isNullable: 'NO' }),
    col('PRODUCTOS', 'Stock_Actual', 'integer', { ordinalPosition: 14, isNullable: 'NO' }),
    col('PRODUCTOS', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 15, isNullable: 'NO' }),
    col('PRODUCTOS', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 16, isNullable: 'NO' }),
    col('RECETAS_DOSIFICADOS', 'ID_Receta', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('RECETAS_DOSIFICADOS', 'ID_Prod_Term', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('RECETAS_DOSIFICADOS', 'ID_Mat_Prima', 'integer', { isNullable: 'NO', ordinalPosition: 3 }),
    col('RECETAS_DOSIFICADOS', 'Cantidad_Dosis', 'numeric', { isNullable: 'NO', ordinalPosition: 4 }),
    col('RECETAS_DOSIFICADOS', 'Unidad_Dosis', 'character varying', { charMaxLen: 50, isNullable: 'NO', ordinalPosition: 5 }),
    col('RECETAS_DOSIFICADOS', 'Costo_Proporcional', 'numeric', { ordinalPosition: 6, isNullable: 'NO' }),
    col('RECETAS_DOSIFICADOS', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 7, isNullable: 'NO' }),
    col('PRECIOS_CLIENTE', 'ID_Precio', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('PRECIOS_CLIENTE', 'ID_Cliente', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('PRECIOS_CLIENTE', 'ID_Producto', 'integer', { isNullable: 'NO', ordinalPosition: 3 }),
    col('PRECIOS_CLIENTE', 'Precio_Venta', 'numeric', { isNullable: 'NO', ordinalPosition: 4 }),
    col('PRECIOS_CLIENTE', 'Margen_Actual', 'numeric', { ordinalPosition: 5, isNullable: 'NO' }),
    col('PRECIOS_CLIENTE', 'Aumento_IPC', 'numeric', { ordinalPosition: 6, isNullable: 'NO' }),
    col('PRECIOS_CLIENTE', 'Alerta_Margen', 'boolean', { ordinalPosition: 7, isNullable: 'NO' }),
    col('PRECIOS_CLIENTE', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 8, isNullable: 'NO' }),
    col('PRECIOS_CLIENTE', 'Fecha_Ultima_Actualizacion', 'timestamp without time zone', { ordinalPosition: 9, isNullable: 'NO' }),
    col('CLIENTES', 'ID_Cliente', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('CLIENTES', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 2, isNullable: 'NO' }),
    col('CLIENTES', 'Fecha_Contrato', 'date', { isNullable: 'NO', ordinalPosition: 3 }),
    col('CLIENTES', 'NIT', 'character varying', { charMaxLen: 30, isNullable: 'NO', ordinalPosition: 4 }),
    col('CLIENTES', 'Razon_Social', 'character varying', { charMaxLen: 250, isNullable: 'NO', ordinalPosition: 5 }),
    col('CLIENTES', 'Contacto_Nombre', 'character varying', { charMaxLen: 200, ordinalPosition: 6 }),
    col('CLIENTES', 'Contacto_Telefono', 'character varying', { charMaxLen: 50, ordinalPosition: 7 }),
    col('CLIENTES', 'Contacto_Correo', 'character varying', { charMaxLen: 200, ordinalPosition: 8 }),
    col('CLIENTES', 'Contacto_Direccion', 'character varying', { charMaxLen: 300, ordinalPosition: 9 }),
    col('CLIENTES', 'Contacto_Ciudad', 'character varying', { charMaxLen: 100, ordinalPosition: 10 }),
    col('CLIENTES', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 11, isNullable: 'NO' }),
    col('PROVEEDORES', 'ID_Proveedor', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('PROVEEDORES', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 2, isNullable: 'NO' }),
    col('PROVEEDORES', 'NIT', 'character varying', { charMaxLen: 30, isNullable: 'NO', ordinalPosition: 3 }),
    col('PROVEEDORES', 'Razon_Social', 'character varying', { charMaxLen: 250, isNullable: 'NO', ordinalPosition: 4 }),
    col('PROVEEDORES', 'Asesor_Nombre', 'character varying', { charMaxLen: 200, ordinalPosition: 5 }),
    col('PROVEEDORES', 'Asesor_Telefono', 'character varying', { charMaxLen: 50, ordinalPosition: 6 }),
    col('PROVEEDORES', 'Asesor_Correo', 'character varying', { charMaxLen: 200, ordinalPosition: 7 }),
    col('PROVEEDORES', 'Condicion_Pago_Tipo', 'character varying', { charMaxLen: 20, columnDefault: "'CONTADO'", ordinalPosition: 8, isNullable: 'NO' }),
    col('PROVEEDORES', 'Condicion_Pago_Dias', 'integer', { ordinalPosition: 9, isNullable: 'NO' }),
    col('PROVEEDORES', 'Banco_Nombre', 'character varying', { charMaxLen: 150, ordinalPosition: 10 }),
    col('PROVEEDORES', 'Banco_Tipo_Cuenta', 'character varying', { charMaxLen: 50, ordinalPosition: 11 }),
    col('PROVEEDORES', 'Banco_Numero_Cuenta', 'character varying', { charMaxLen: 100, ordinalPosition: 12 }),
    col('PROVEEDORES', 'Banco_Titular', 'character varying', { charMaxLen: 200, ordinalPosition: 13 }),
    col('PROVEEDORES', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 14, isNullable: 'NO' }),
    col('MAQUINAS_Y_TIENDAS', 'ID_Maquina', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('MAQUINAS_Y_TIENDAS', 'ID_Cliente', 'integer', { ordinalPosition: 2 }),
    col('MAQUINAS_Y_TIENDAS', 'ID_Operador', 'integer', { ordinalPosition: 3 }),
    col('MAQUINAS_Y_TIENDAS', 'Serial', 'character varying', { charMaxLen: 100, isNullable: 'NO', ordinalPosition: 4 }),
    col('MAQUINAS_Y_TIENDAS', 'Marca', 'character varying', { charMaxLen: 150, ordinalPosition: 5 }),
    col('MAQUINAS_Y_TIENDAS', 'Tipo', 'character varying', { charMaxLen: 30, columnDefault: "'SNACKS'", ordinalPosition: 6, isNullable: 'NO' }),
    col('MAQUINAS_Y_TIENDAS', 'Ubicacion_Esp', 'character varying', { charMaxLen: 300, ordinalPosition: 7 }),
    col('MAQUINAS_Y_TIENDAS', 'Medios_Pago', 'jsonb', { ordinalPosition: 8 }),
    col('MAQUINAS_Y_TIENDAS', 'Tarifa_Promedio_Override', 'numeric', { ordinalPosition: 9 }),
    col('MAQUINAS_Y_TIENDAS', 'Fecha_Instalacion', 'date', { ordinalPosition: 10 }),
    col('MAQUINAS_Y_TIENDAS', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 11, isNullable: 'NO' }),
    col('MAQUINAS_Y_TIENDAS', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 12, isNullable: 'NO' }),
    col('ROLES_PERFILES', 'ID_Rol', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('ROLES_PERFILES', 'Nombre_Rol', 'character varying', { charMaxLen: 120, isNullable: 'NO', ordinalPosition: 2 }),
    col('ROLES_PERFILES', 'Permisos_CRUD', 'jsonb', { isNullable: 'NO', ordinalPosition: 3 }),
    col('ROLES_PERFILES', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 4, isNullable: 'NO' }),
    col('ROLES_PERFILES', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 5, isNullable: 'NO' }),
    col('USUARIOS_SISTEMA', 'ID_Usuario', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('USUARIOS_SISTEMA', 'ID_Rol', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('USUARIOS_SISTEMA', 'Nombre_Completo', 'character varying', { charMaxLen: 200, isNullable: 'NO', ordinalPosition: 3 }),
    col('USUARIOS_SISTEMA', 'Usuario_Login', 'character varying', { charMaxLen: 100, isNullable: 'NO', ordinalPosition: 4 }),
    col('USUARIOS_SISTEMA', 'Email', 'character varying', { charMaxLen: 200, isNullable: 'NO', ordinalPosition: 5 }),
    col('USUARIOS_SISTEMA', 'Password_Hash', 'character varying', { charMaxLen: 255, isNullable: 'NO', ordinalPosition: 6 }),
    col('USUARIOS_SISTEMA', 'Permisos_Excepcion', 'jsonb', { ordinalPosition: 7 }),
    col('USUARIOS_SISTEMA', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 8, isNullable: 'NO' }),
    col('USUARIOS_SISTEMA', 'Fecha_Creacion', 'timestamp without time zone', { ordinalPosition: 9, isNullable: 'NO' }),
    col('USUARIOS_SISTEMA', 'Ultimo_Acceso', 'timestamp without time zone', { ordinalPosition: 10 }),
    col('OPERADORES', 'ID_Operador', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('OPERADORES', 'ID_Usuario', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('OPERADORES', 'Nombre_Completo', 'character varying', { charMaxLen: 200, isNullable: 'NO', ordinalPosition: 3 }),
    col('OPERADORES', 'Telefono', 'character varying', { charMaxLen: 50, ordinalPosition: 4 }),
    col('OPERADORES', 'Zona_Asignada', 'character varying', { charMaxLen: 200, ordinalPosition: 5 }),
    col('OPERADORES', 'Fecha_Ingreso', 'date', { isNullable: 'NO', ordinalPosition: 6 }),
    col('OPERADORES', 'Estado', 'boolean', { columnDefault: 'true', ordinalPosition: 7, isNullable: 'NO' }),
    col('MAPA_MATERIA_PRIMA', 'ID_Mapa_MP', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('MAPA_MATERIA_PRIMA', 'ID_Maquina', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('MAPA_MATERIA_PRIMA', 'ID_Producto', 'integer', { isNullable: 'NO', ordinalPosition: 3 }),
    col('MAPA_MATERIA_PRIMA', 'Espiral_Codigo', 'character varying', { charMaxLen: 20, isNullable: 'NO', ordinalPosition: 4 }),
    col('MAPA_MATERIA_PRIMA', 'Cantidad', 'integer', { ordinalPosition: 5, isNullable: 'NO' }),
    col('MAPA_CAFE_NRQ', 'ID_Mapa_NRQ', 'integer', { isNullable: 'NO', ordinalPosition: 1 }),
    col('MAPA_CAFE_NRQ', 'ID_Maquina', 'integer', { isNullable: 'NO', ordinalPosition: 2 }),
    col('MAPA_CAFE_NRQ', 'ID_Producto', 'integer', { isNullable: 'NO', ordinalPosition: 3 }),
    col('MAPA_CAFE_NRQ', 'Boton_Codigo', 'character varying', { charMaxLen: 20, isNullable: 'NO', ordinalPosition: 4 }),
    col('MAPA_CAFE_NRQ', 'Precio_Override', 'numeric', { ordinalPosition: 5 }),
  ],
  primaryKeys: [
    { tableName: 'PRODUCTOS', columnName: 'ID_Producto' },
    { tableName: 'RECETAS_DOSIFICADOS', columnName: 'ID_Receta' },
    { tableName: 'PRECIOS_CLIENTE', columnName: 'ID_Precio' },
    { tableName: 'CLIENTES', columnName: 'ID_Cliente' },
    { tableName: 'PROVEEDORES', columnName: 'ID_Proveedor' },
    { tableName: 'MAQUINAS_Y_TIENDAS', columnName: 'ID_Maquina' },
    { tableName: 'ROLES_PERFILES', columnName: 'ID_Rol' },
    { tableName: 'USUARIOS_SISTEMA', columnName: 'ID_Usuario' },
    { tableName: 'OPERADORES', columnName: 'ID_Operador' },
    { tableName: 'MAPA_MATERIA_PRIMA', columnName: 'ID_Mapa_MP' },
    { tableName: 'MAPA_CAFE_NRQ', columnName: 'ID_Mapa_NRQ' },
  ],
}

const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
const today = new Date().toISOString().substring(0, 10)

const _PRODUCTOS_DEMO = [
  { ID_Producto: 1, ID_Proveedor: 1, Codigo_Barras: '7701001001001', Nombre_Producto: 'Coca-Cola 350ml', Tipo_Producto: 'ESTANDAR', Unidad_Compra: 'CAJA 24', Unidad_Consumo: 'UND', Equivalencia: 24, Costo_Base: 2500, Porcentaje_Imp: 0.19, Costo_Total: 2975, Stock_Min: 48, Stock_Max: 240, Stock_Actual: 120, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 2, ID_Proveedor: 2, Codigo_Barras: '7702002002002', Nombre_Producto: 'Agua Cristal 500ml', Tipo_Producto: 'ESTANDAR', Unidad_Compra: 'CAJA 12', Unidad_Consumo: 'UND', Equivalencia: 12, Costo_Base: 1200, Porcentaje_Imp: 0, Costo_Total: 1200, Stock_Min: 60, Stock_Max: 180, Stock_Actual: 35, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 3, ID_Proveedor: 3, Codigo_Barras: '7703003003003', Nombre_Producto: 'Café Tostado Molido 500g', Tipo_Producto: 'MATERIA_PRIMA', Unidad_Compra: 'BOLSA', Unidad_Consumo: 'g', Equivalencia: 500, Costo_Base: 18000, Porcentaje_Imp: 0.19, Costo_Total: 21420, Stock_Min: 10, Stock_Max: 100, Stock_Actual: 45, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 4, ID_Proveedor: null, Codigo_Barras: 'DOS001', Nombre_Producto: 'Café Negro 12oz', Tipo_Producto: 'DOSIFICADO', Unidad_Compra: 'PORCION', Unidad_Consumo: 'UND', Equivalencia: 1, Costo_Base: 0, Porcentaje_Imp: 0.19, Costo_Total: 1800, Stock_Min: 0, Stock_Max: 9999, Stock_Actual: 999, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 5, ID_Proveedor: 3, Codigo_Barras: '7703004004004', Nombre_Producto: 'Azúcar Blanca Bolsa 1kg', Tipo_Producto: 'MATERIA_PRIMA', Unidad_Compra: 'BOLSA 50und', Unidad_Consumo: 'g', Equivalencia: 50000, Costo_Base: 1600, Porcentaje_Imp: 0, Costo_Total: 1600, Stock_Min: 20, Stock_Max: 200, Stock_Actual: 110, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 6, ID_Proveedor: 3, Codigo_Barras: '7703005005005', Nombre_Producto: 'Leche Entera 1L', Tipo_Producto: 'MATERIA_PRIMA', Unidad_Compra: 'CAJA 6', Unidad_Consumo: 'ml', Equivalencia: 6000, Costo_Base: 4500, Porcentaje_Imp: 0.19, Costo_Total: 5355, Stock_Min: 12, Stock_Max: 60, Stock_Actual: 24, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 7, ID_Proveedor: 3, Codigo_Barras: 'DOS002', Nombre_Producto: 'Café Con Leche 12oz', Tipo_Producto: 'DOSIFICADO', Unidad_Compra: 'PORCION', Unidad_Consumo: 'UND', Equivalencia: 1, Costo_Base: 0, Porcentaje_Imp: 0.19, Costo_Total: 2200, Stock_Min: 0, Stock_Max: 9999, Stock_Actual: 999, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 8, ID_Proveedor: 3, Codigo_Barras: 'DOS003', Nombre_Producto: 'Chocolate Caliente 10oz', Tipo_Producto: 'DOSIFICADO', Unidad_Compra: 'PORCION', Unidad_Consumo: 'UND', Equivalencia: 1, Costo_Base: 0, Porcentaje_Imp: 0.19, Costo_Total: 2100, Stock_Min: 0, Stock_Max: 9999, Stock_Actual: 999, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 9, ID_Proveedor: 1, Codigo_Barras: '7701006006006', Nombre_Producto: 'Chocolatina Jet 25g', Tipo_Producto: 'ESTANDAR', Unidad_Compra: 'CAJA 48', Unidad_Consumo: 'UND', Equivalencia: 48, Costo_Base: 600, Porcentaje_Imp: 0.19, Costo_Total: 714, Stock_Min: 72, Stock_Max: 288, Stock_Actual: 210, Fecha_Creacion: now, Estado: true },
  { ID_Producto: 10, ID_Proveedor: 1, Codigo_Barras: '7701007007007', Nombre_Producto: 'Ponque Relleno 50g', Tipo_Producto: 'ESTANDAR', Unidad_Compra: 'CAJA 36', Unidad_Consumo: 'UND', Equivalencia: 36, Costo_Base: 900, Porcentaje_Imp: 0.19, Costo_Total: 1071, Stock_Min: 48, Stock_Max: 180, Stock_Actual: 14, Fecha_Creacion: now, Estado: true },
]

const _CLIENTES_DEMO = [
  { ID_Cliente: 1, Fecha_Creacion: now, Fecha_Contrato: '2025-01-15', NIT: '900.123.456-7', Razon_Social: 'Alimentos SAS', Contacto_Nombre: 'Carlos Patiño', Contacto_Telefono: '3105551234', Contacto_Correo: 'cpatino@alimentos.co', Contacto_Direccion: 'Cra 19 #98-21 Of 402', Contacto_Ciudad: 'Bogotá D.C.', Estado: true },
  { ID_Cliente: 2, Fecha_Creacion: now, Fecha_Contrato: '2025-02-01', NIT: '900.234.567-8', Razon_Social: 'Empresa de Servicios Integrales', Contacto_Nombre: 'Laura Jiménez', Contacto_Telefono: '3155552345', Contacto_Correo: 'ljimenez@servintegrales.co', Contacto_Direccion: 'Cl 93 #11-45 Piso 3', Contacto_Ciudad: 'Bogotá D.C.', Estado: true },
  { ID_Cliente: 3, Fecha_Creacion: now, Fecha_Contrato: '2025-03-10', NIT: '900.345.678-9', Razon_Social: 'Industrias Alimenticias Unidas', Contacto_Nombre: 'Ricardo Gómez', Contacto_Telefono: '3205553456', Contacto_Correo: 'rgomez@industriasau.co', Contacto_Direccion: 'Av 68 #24-33', Contacto_Ciudad: 'Medellín', Estado: true },
]

const _PRECIOS_CLIENTE_DEMO: any[] = (() => {
  const rows: any[] = []
  let idP = 1
  const productos = _PRODUCTOS_DEMO.filter((p: any) => ['ESTANDAR', 'DOSIFICADO'].includes(p.Tipo_Producto))
  _CLIENTES_DEMO.forEach((c: any) => {
    productos.forEach((p: any) => {
      const basePrecio = p.Costo_Total || 1000
      const clienteFactor = c.ID_Cliente === 1 ? 1.25 : c.ID_Cliente === 2 ? 1.32 : 1.4
      const precio = Math.round(basePrecio * clienteFactor / 50) * 50
      const margen = precio === 0 ? 0 : (precio - basePrecio) / precio
      rows.push({
        ID_Precio: idP++, ID_Cliente: c.ID_Cliente, ID_Producto: p.ID_Producto,
        Precio_Venta: precio, Margen_Actual: Math.round(margen * 10000) / 10000,
        Aumento_IPC: 0, Alerta_Margen: margen < 0.08, Fecha_Creacion: now, Fecha_Ultima_Actualizacion: now,
      })
    })
  })
  return rows
})()

const FALLBACK_ROWS: Record<string, any[]> = {
  PRODUCTOS: _PRODUCTOS_DEMO,
  RECETAS_DOSIFICADOS: [
    { ID_Receta: 1, ID_Prod_Term: 4, ID_Mat_Prima: 3, Cantidad_Dosis: 12, Unidad_Dosis: 'g', Costo_Proporcional: 514, Fecha_Creacion: now },
    { ID_Receta: 2, ID_Prod_Term: 4, ID_Mat_Prima: 5, Cantidad_Dosis: 8, Unidad_Dosis: 'g', Costo_Proporcional: 13, Fecha_Creacion: now },
    { ID_Receta: 3, ID_Prod_Term: 7, ID_Mat_Prima: 3, Cantidad_Dosis: 9, Unidad_Dosis: 'g', Costo_Proporcional: 385, Fecha_Creacion: now },
    { ID_Receta: 4, ID_Prod_Term: 7, ID_Mat_Prima: 6, Cantidad_Dosis: 120, Unidad_Dosis: 'ml', Costo_Proporcional: 1071, Fecha_Creacion: now },
    { ID_Receta: 5, ID_Prod_Term: 7, ID_Mat_Prima: 5, Cantidad_Dosis: 6, Unidad_Dosis: 'g', Costo_Proporcional: 10, Fecha_Creacion: now },
  ],
  CLIENTES: _CLIENTES_DEMO,
  PROVEEDORES: [
    { ID_Proveedor: 1, Fecha_Creacion: now, NIT: '890.000.111-2', Razon_Social: 'Distribuidora Nacional Snack SAS', Asesor_Nombre: 'Héctor López', Asesor_Telefono: '3115559988', Asesor_Correo: 'hlopez@distrisnack.co', Condicion_Pago_Tipo: 'CREDITO', Condicion_Pago_Dias: 15, Banco_Nombre: 'Bancolombia', Banco_Tipo_Cuenta: 'CORRIENTE', Banco_Numero_Cuenta: '01234567890', Banco_Titular: 'Distribuidora Nacional Snack SAS', Estado: true },
    { ID_Proveedor: 2, Fecha_Creacion: now, NIT: '890.111.222-3', Razon_Social: 'Aguas Cristalinas Andinas', Asesor_Nombre: 'Silvia Rodríguez', Asesor_Telefono: '3125558877', Asesor_Correo: 'srodriguez@aguascristal.co', Condicion_Pago_Tipo: 'CONTADO', Condicion_Pago_Dias: 0, Banco_Nombre: 'Davivienda', Banco_Tipo_Cuenta: 'AHORROS', Banco_Numero_Cuenta: '98765432101', Banco_Titular: 'Aguas Cristalinas Andinas', Estado: true },
    { ID_Proveedor: 3, Fecha_Creacion: now, NIT: '890.222.333-4', Razon_Social: 'Mayorista Insumos Cafeteros SAS', Asesor_Nombre: 'Carlos Mejía', Asesor_Telefono: '3135557766', Asesor_Correo: 'cmejia@insumoscafe.co', Condicion_Pago_Tipo: 'CREDITO', Condicion_Pago_Dias: 30, Banco_Nombre: 'BBVA', Banco_Tipo_Cuenta: 'CORRIENTE', Banco_Numero_Cuenta: '13579246801', Banco_Titular: 'Mayorista Insumos Cafeteros', Estado: true },
  ],
  MAQUINAS_Y_TIENDAS: [
    { ID_Maquina: 1, ID_Cliente: 1, ID_Operador: 1, Serial: 'SNK-1001-0023', Marca: 'Automatic Products', Tipo: 'SNACKS', Ubicacion_Esp: 'Piso 3 - Zona Cafetería Alimentos SAS', Medios_Pago: { efectivo: true, nequi: false, daviplata: false, tarjeta: true }, Tarifa_Promedio_Override: null, Fecha_Instalacion: today, Estado: true, Fecha_Creacion: now },
    { ID_Maquina: 2, ID_Cliente: 2, ID_Operador: 2, Serial: 'BEB-2002-0045', Marca: 'Vendo', Tipo: 'BEBIDAS', Ubicacion_Esp: 'Piso 7 - Zona ServInt', Medios_Pago: { efectivo: true, nequi: true, daviplata: true, tarjeta: true }, Tarifa_Promedio_Override: 3500, Fecha_Instalacion: today, Estado: true, Fecha_Creacion: now },
    { ID_Maquina: 3, ID_Cliente: 3, ID_Operador: 2, Serial: 'NRQ-3003-0078', Marca: 'Necta Kalea', Tipo: 'CAFETERA_NRQ', Ubicacion_Esp: 'Zona Cafetería Industrias Alimenticias', Medios_Pago: { efectivo: true, nequi: true, daviplata: false, tarjeta: true }, Tarifa_Promedio_Override: null, Fecha_Instalacion: today, Estado: true, Fecha_Creacion: now },
  ],
  ROLES_PERFILES: [
    { ID_Rol: 1, Nombre_Rol: 'Administrador Maestro', Permisos_CRUD: { productos: { ver: true, crear: true, editar: true, eliminar: true }, precios: { ver: true, crear: true, editar: true, eliminar: true }, clientes: { ver: true, crear: true, editar: true, eliminar: true }, proveedores: { ver: true, crear: true, editar: true, eliminar: true }, maquinas: { ver: true, crear: true, editar: true, eliminar: true }, bodega: { ver: true, crear: true, editar: true, eliminar: true }, tesoreria: { ver: true, crear: true, editar: true, eliminar: true }, admin: { ver: true, crear: true, editar: true, eliminar: true }, preciosCliente: { ver: true, crear: true, editar: true, eliminar: true } }, Fecha_Creacion: now, Estado: true },
    { ID_Rol: 2, Nombre_Rol: 'Bodega', Permisos_CRUD: { productos: { ver: true, crear: true, editar: true, eliminar: false }, precios: { ver: false, crear: false, editar: false, eliminar: false }, clientes: { ver: true, crear: false, editar: false, eliminar: false }, proveedores: { ver: true, crear: true, editar: true, eliminar: false }, maquinas: { ver: true, crear: false, editar: false, eliminar: false }, bodega: { ver: true, crear: true, editar: true, eliminar: true }, tesoreria: { ver: false, crear: false, editar: false, eliminar: false }, admin: { ver: false, crear: false, editar: false, eliminar: false }, preciosCliente: { ver: false, crear: false, editar: false, eliminar: false } }, Fecha_Creacion: now, Estado: true },
    { ID_Rol: 3, Nombre_Rol: 'Tesorería', Permisos_CRUD: { productos: { ver: true, crear: false, editar: false, eliminar: false }, precios: { ver: true, crear: true, editar: true, eliminar: true }, clientes: { ver: true, crear: true, editar: true, eliminar: false }, proveedores: { ver: true, crear: false, editar: false, eliminar: false }, maquinas: { ver: true, crear: false, editar: false, eliminar: false }, bodega: { ver: true, crear: false, editar: false, eliminar: false }, tesoreria: { ver: true, crear: true, editar: true, eliminar: true }, admin: { ver: false, crear: false, editar: false, eliminar: false }, preciosCliente: { ver: true, crear: true, editar: true, eliminar: true } }, Fecha_Creacion: now, Estado: true },
    { ID_Rol: 4, Nombre_Rol: 'Operador', Permisos_CRUD: { productos: { ver: true, crear: false, editar: false, eliminar: false }, precios: { ver: true, crear: false, editar: false, eliminar: false }, clientes: { ver: false, crear: false, editar: false, eliminar: false }, proveedores: { ver: false, crear: false, editar: false, eliminar: false }, maquinas: { ver: true, crear: false, editar: false, eliminar: false }, bodega: { ver: false, crear: false, editar: false, eliminar: false }, tesoreria: { ver: false, crear: false, editar: false, eliminar: false }, admin: { ver: false, crear: false, editar: false, eliminar: false }, preciosCliente: { ver: true, crear: false, editar: false, eliminar: false } }, Fecha_Creacion: now, Estado: true },
  ],
  USUARIOS_SISTEMA: [
    { ID_Usuario: 1, ID_Rol: 1, Nombre_Completo: 'Administrador del Sistema', Usuario_Login: 'admin', Email: 'admin@example.com', Password_Hash: '$2b$10$xxxxxxxxxxxxxxxxxxxxxx', Permisos_Excepcion: null, Estado: true, Fecha_Creacion: now, Ultimo_Acceso: now },
    { ID_Usuario: 2, ID_Rol: 4, Nombre_Completo: 'Operador Demo Uno', Usuario_Login: 'operador1', Email: 'operador1@example.com', Password_Hash: '$2b$10$yyyyyyyyyyyyyyyyyyyyyy', Permisos_Excepcion: null, Estado: true, Fecha_Creacion: now, Ultimo_Acceso: now },
  ],
  OPERADORES: [
    { ID_Operador: 1, ID_Usuario: 1, Nombre_Completo: 'Jhonatan Arévalo', Telefono: '3157771111', Zona_Asignada: 'Zona Norte Bogotá', Fecha_Ingreso: '2025-01-10', Estado: true },
    { ID_Operador: 2, ID_Usuario: 2, Nombre_Completo: 'Diana Carolina Torres', Telefono: '3108882222', Zona_Asignada: 'Zona Centro Bogotá / Medellín', Fecha_Ingreso: '2025-02-05', Estado: true },
  ],
  PRECIOS_CLIENTE: _PRECIOS_CLIENTE_DEMO,
  MAPA_MATERIA_PRIMA: [
    { ID_Mapa_MP: 1, ID_Maquina: 1, ID_Producto: 1, Espiral_Codigo: 'A01', Cantidad: 18 },
    { ID_Mapa_MP: 2, ID_Maquina: 1, ID_Producto: 9, Espiral_Codigo: 'A02', Cantidad: 30 },
    { ID_Mapa_MP: 3, ID_Maquina: 1, ID_Producto: 10, Espiral_Codigo: 'A03', Cantidad: 24 },
    { ID_Mapa_MP: 4, ID_Maquina: 1, ID_Producto: 2, Espiral_Codigo: 'B01', Cantidad: 12 },
    { ID_Mapa_MP: 5, ID_Maquina: 2, ID_Producto: 2, Espiral_Codigo: 'C01', Cantidad: 15 },
    { ID_Mapa_MP: 6, ID_Maquina: 2, ID_Producto: 1, Espiral_Codigo: 'C02', Cantidad: 10 },
  ],
  MAPA_CAFE_NRQ: [
    { ID_Mapa_NRQ: 1, ID_Maquina: 3, ID_Producto: 4, Boton_Codigo: 'B01', Precio_Override: null },
    { ID_Mapa_NRQ: 2, ID_Maquina: 3, ID_Producto: 7, Boton_Codigo: 'B02', Precio_Override: 2500 },
    { ID_Mapa_NRQ: 3, ID_Maquina: 3, ID_Producto: 8, Boton_Codigo: 'B03', Precio_Override: null },
    { ID_Mapa_NRQ: 4, ID_Maquina: 3, ID_Producto: 3, Boton_Codigo: 'B10', Precio_Override: null },
    { ID_Mapa_NRQ: 5, ID_Maquina: 3, ID_Producto: 5, Boton_Codigo: 'B11', Precio_Override: null },
    { ID_Mapa_NRQ: 6, ID_Maquina: 3, ID_Producto: 6, Boton_Codigo: 'B12', Precio_Override: null },
  ],
}

function fallbackSearch(rowsLocal: any[], q: string) {
  if (!q) return rowsLocal
  const s = q.toLowerCase()
  return rowsLocal.filter((r) =>
    Object.values(r).some((v: any) => {
      if (v == null) return false
      if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(s)
      return String(v).toLowerCase().includes(s)
    })
  )
}

const AdminDataPanel = () => {
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [sel, setSel] = useState<string>('PRODUCTOS')
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [take, setTake] = useState(50)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<'EDIT' | 'NEW'>('EDIT')
  const [editPk, setEditPk] = useState<Record<string, any> | null>(null)
  const [form] = Form.useForm()
  const [fallbackData, setFallbackData] = useState<Record<string, any[]>>(JSON.parse(JSON.stringify(FALLBACK_ROWS)))
  const [usingFallback, setUsingFallback] = useState(false)

  const effectiveMeta = (): MetaInfo => {
    if (meta) return meta
    const fm = JSON.parse(JSON.stringify(FALLBACK_META)) as MetaInfo
    fm.tables = fm.tables.map(t => ({ ...t, rowCount: fallbackData[t.tableName]?.length || 0 }))
    return fm
  }

  const loadMeta = async () => {
    try {
      const m = await apiService.get<MetaInfo>('/admin/tables')
      setMeta(m)
      setUsingFallback(false)
      if ((!sel || !m.tables.find(t => t.tableName === sel)) && m.tables.length) {
        const defaultTable = m.tables.find(t => t.tableName === 'PRODUCTOS')?.tableName || m.tables[0].tableName
        setSel(defaultTable)
      }
    } catch (e: any) {
      message.warning('API /admin/tables no responde (backend offline). Usando MODO FUERZA local (catalogo completo de tablas mock)')
      setMeta(null)
      setUsingFallback(true)
      const fm = effectiveMeta()
      if (!sel || !fm.tables.find(t => t.tableName === sel)) {
        setSel(fm.tables.find(t => t.tableName === 'PRODUCTOS')?.tableName || (fm.tables[0]?.tableName || ''))
      }
    }
  }
  useEffect(() => { loadMeta() }, [])

  const cols = useMemo(() => effectiveMeta()?.columns.filter(c => c.tableName === sel).sort((a, b) => a.ordinalPosition - b.ordinalPosition) || [], [meta, sel, usingFallback, fallbackData])
  const pks = useMemo(() => (effectiveMeta()?.primaryKeys.filter(p => p.tableName === sel).map(p => p.columnName) || []), [meta, sel, usingFallback, fallbackData])
  const fks = useMemo(() => (effectiveMeta()?.foreignKeys.filter(f => f.tableName === sel) || []), [meta, sel, usingFallback, fallbackData])
  const fksTo = useMemo(() => (effectiveMeta()?.foreignKeys.filter(f => f.foreignTableName === sel) || []), [meta, sel, usingFallback, fallbackData])
  const curTab = useMemo(() => effectiveMeta()?.tables.find(t => t.tableName === sel), [meta, sel, usingFallback, fallbackData])

  const loadRows = async () => {
    if (!sel) return
    setLoading(true)
    try {
      if (usingFallback) {
        throw new Error('__SKIP_API__')
      }
      const r = await apiService.get<{ data: any[]; total: number }>(`/admin/tables/${sel}`, { skip, take, search })
      setRows(r.data.map((row: any) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))))
      setTotal(r.total)
      setUsingFallback(false)
    } catch (e: any) {
      const needMessage = String(e?.message || '') !== '__SKIP_API__'
      if (needMessage && !usingFallback) message.warning(`API /admin/tables/${sel} no responde. Usando datos locales (MOCK) modo fuerza`)
      setUsingFallback(true)
      const all = fallbackData[sel] || []
      const filtered = fallbackSearch(all, search)
      const totalF = filtered.length
      const takeN = take <= 0 ? totalF : take
      const page = filtered.slice(skip, skip + takeN)
      setRows(page)
      setTotal(totalF)
    } finally { setLoading(false) }
  }
  useEffect(() => { if (sel) { setSkip(0); loadRows() } /* eslint-disable-next-line */ }, [sel])
  useEffect(() => { if (sel) loadRows() /* eslint-disable-next-line */ }, [skip, take, search])

  const formInitialFromRow = (row: any, columns: typeof cols) => {
    const o: any = {}
    columns.forEach(c => {
      const v = row?.[c.columnName]
      if (v === undefined || v === null) { o[c.columnName] = undefined; return }
      if (c.dataType === 'json' || c.dataType === 'jsonb') {
        o[c.columnName] = typeof v === 'string' ? v : JSON.stringify(v, null, 2)
      } else if (c.dataType === 'boolean') {
        o[c.columnName] = !!v
      } else {
        o[c.columnName] = v
      }
    })
    return o
  }

  const openNew = () => {
    if (curTab?.protected) { message.warning('Tabla protegida (solo lectura)'); return }
    setEditMode('NEW')
    setEditPk(null)
    form.setFieldsValue(formInitialFromRow({}, cols))
    setEditOpen(true)
  }
  const openEdit = (row: any) => {
    if (curTab?.protected) { message.warning('Tabla protegida (solo lectura)'); return }
    const pk: Record<string, any> = {}
    pks.forEach(k => { pk[k] = row[k] })
    if (Object.keys(pk).length === 0) { pk[cols[0]?.columnName] = row[cols[0]?.columnName] }
    setEditMode('EDIT')
    setEditPk(pk)
    form.setFieldsValue(formInitialFromRow(row, cols))
    setEditOpen(true)
  }

  const onSubmitEdit = async () => {
    try {
      const vals = await form.validateFields()
      const final: any = {}
      cols.forEach(c => {
        const v = vals[c.columnName]
        if (v === undefined || v === null || v === '') {
          if (c.isNullable === 'YES' || c.columnDefault) final[c.columnName] = null
          return
        }
        if (c.dataType === 'json' || c.dataType === 'jsonb') {
          try { final[c.columnName] = typeof v === 'string' ? JSON.parse(v) : v }
          catch { message.error(`Campo ${c.columnName} JSON inválido`); throw new Error('invalid json') }
        } else if (c.dataType === 'boolean') {
          final[c.columnName] = !!v
        } else if (c.dataType.includes('int') || c.dataType.includes('numeric') || c.dataType === 'decimal') {
          const n = Number(v)
          final[c.columnName] = isNaN(n) ? v : n
        } else {
          final[c.columnName] = v
        }
      })
      if (usingFallback) {
        const currentTabla = fallbackData[sel] || []
        const pkCol = pks[0] || cols[0]?.columnName
        if (editMode === 'NEW') {
          const maxId = currentTabla.reduce((m: number, r: any) => Math.max(m, Number(r[pkCol]) || 0), 0)
          const newRow = { ...final }
          if (pkCol && (newRow[pkCol] === undefined || newRow[pkCol] === null)) newRow[pkCol] = maxId + 1
          setFallbackData({ ...fallbackData, [sel]: [...currentTabla, newRow] })
          message.success('Registro insertado (MODO FUERZA local)')
        } else if (editMode === 'EDIT' && editPk) {
          const updated = currentTabla.map((r: any) =>
            Object.entries(editPk).every(([k, v]) => r[k] === v) ? { ...r, ...final } : r
          )
          setFallbackData({ ...fallbackData, [sel]: updated })
          message.success('Registro actualizado (MODO FUERZA local)')
        }
        setEditOpen(false)
        loadRows()
        return
      }
      if (editMode === 'NEW') {
        await apiService.post(`/admin/tables/${sel}`, final)
        message.success('Registro insertado')
      } else if (editMode === 'EDIT' && editPk) {
        await apiService.patch(`/admin/tables/${sel}`, { where: editPk, data: final })
        message.success('Registro actualizado')
      }
      setEditOpen(false)
      loadRows()
    } catch { /* handled */ }
  }

  const onDelete = async (row: any) => {
    if (curTab?.protected) { message.warning('Tabla protegida'); return }
    const pk: Record<string, any> = {}
    pks.forEach(k => { pk[k] = row[k] })
    if (Object.keys(pk).length === 0) { pk[cols[0]?.columnName] = row[cols[0]?.columnName] }
    if (usingFallback) {
      const currentTabla = fallbackData[sel] || []
      const filtered = currentTabla.filter((r: any) =>
        !Object.entries(pk).every(([k, v]) => r[k] === v)
      )
      setFallbackData({ ...fallbackData, [sel]: filtered })
      message.success('Registro eliminado (MODO FUERZA local)')
      loadRows()
      return
    }
    try {
      const where = Buffer.from(JSON.stringify(pk), 'utf8').toString('base64')
      await apiService.remove(`/admin/tables/${sel}?where=${encodeURIComponent(where)}`)
      message.success('Registro eliminado')
      loadRows()
    } catch (e: any) {
      message.error('No se pudo eliminar: ' + (e?.response?.data?.message || e.message))
    }
  }

  const renderField = (c: typeof cols[number]) => {
    const key = c.columnName
    const isPk = pks.includes(key)
    const isFk = !!fks.find(f => f.columnName === key)
    const label = (
      <Space>
        {key}
        {isPk && <Tag color="gold" style={{ marginInlineStart: 4 }}>🔑 PK</Tag>}
        {isFk && <Tag color="blue" style={{ marginInlineStart: 4 }}>🔗 FK</Tag>}
        {c.isNullable === 'NO' && <Tag color="magenta">NOT NULL</Tag>}
        <Tooltip title={`Tipo: ${c.dataType}${c.charMaxLen ? `(${c.charMaxLen})` : ''}${c.columnDefault ? ` · Default: ${c.columnDefault}` : ''}`}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {fmtType(c.dataType)}{c.charMaxLen ? `(${c.charMaxLen})` : ''}
          </Text>
        </Tooltip>
      </Space>
    )
    const rules: any[] = []
    if (c.isNullable === 'NO' && !c.columnDefault && !(isPk && editMode === 'EDIT')) {
      rules.push({ required: true, message: `${key} es obligatorio` })
    }
    if (c.dataType === 'json' || c.dataType === 'jsonb') {
      return (
        <Form.Item key={key} label={label} name={key} rules={rules}>
          <Input.TextArea rows={5} placeholder="{...} o [...]" />
        </Form.Item>
      )
    }
    if (c.dataType === 'boolean') {
      return (
        <Form.Item key={key} label={label} name={key} valuePropName="checked" initialValue={false}>
          <Switch />
        </Form.Item>
      )
    }
    if (c.dataType.includes('int')) {
      return (
        <Form.Item key={key} label={label} name={key} rules={rules}>
          <InputNumber style={{ width: '100%' }} disabled={isPk && editMode === 'EDIT'} />
        </Form.Item>
      )
    }
    if (c.dataType.includes('numeric') || c.dataType.includes('decimal')) {
      return (
        <Form.Item key={key} label={label} name={key} rules={rules}>
          <InputNumber style={{ width: '100%' }} step="0.01" stringMode />
        </Form.Item>
      )
    }
    if (c.dataType === 'date') {
      return (
        <Form.Item key={key} label={label} name={key} rules={rules}>
          <Input placeholder="YYYY-MM-DD" />
        </Form.Item>
      )
    }
    if (c.dataType.startsWith('timestamp')) {
      return (
        <Form.Item key={key} label={label} name={key} rules={rules}>
          <Input placeholder="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
      )
    }
    return (
      <Form.Item key={key} label={label} name={key} rules={rules}>
        <Input disabled={isPk && editMode === 'EDIT'} maxLength={c.charMaxLen || undefined} />
      </Form.Item>
    )
  }

  const columns = cols.map(c => ({
    title: (
      <Space>
        <Text strong>{c.columnName}</Text>
        {pks.includes(c.columnName) && <Tag color="gold" style={{ fontSize: 10 }}>🔑</Tag>}
        {fks.find(f => f.columnName === c.columnName) && <Tag color="blue" style={{ fontSize: 10 }}>🔗 FK</Tag>}
      </Space>
    ),
    dataIndex: c.columnName,
    key: c.columnName,
    sorter: (a: any, b: any) => {
      const av = a[c.columnName], bv = b[c.columnName]
      if (av == null) return bv == null ? 0 : 1
      if (bv == null) return -1
      if (typeof av === 'number') return av - bv
      return String(av).localeCompare(String(bv))
    },
    render: (v: any) => {
      if (v === null || v === undefined) return <Text type="secondary">NULL</Text>
      if (typeof v === 'object') return <Text code>{JSON.stringify(v)}</Text>
      if (typeof v === 'boolean') return <Tag color={v ? 'green' : 'default'}>{v ? 'TRUE' : 'FALSE'}</Tag>
      const s = String(v)
      return s.length > 60 ? <Tooltip title={s}><Text>{s.substring(0, 60)}…</Text></Tooltip> : s
    },
  }))

  if (!curTab?.protected) {
    columns.push({
      title: 'Acciones',
      key: 'acc',
      fixed: 'right' as const,
      width: 140,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>Editar</Button>
          <Popconfirm title="¿Eliminar este registro?" onConfirm={() => onDelete(row)} okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }} icon={<ExclamationCircleFilled style={{ color: '#ff4d4f' }} />}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>Eliminar</Button>
          </Popconfirm>
        </Space>
      ),
    })
  }

  const stats = useMemo(() => {
    const eff = effectiveMeta()
    const t = eff.tables || []
    return {
      nTablas: t.length,
      nFilas: t.reduce((a, b) => a + (b.rowCount || 0), 0),
      nFks: eff.foreignKeys.length || 0,
      nProteg: t.filter(x => x.protected).length,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, usingFallback, fallbackData, sel])

  return (
    <Layout style={{ minHeight: 'calc(100vh - 48px)', background: '#fff' }}>
      <Sider width={260} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <Space align="center"><DatabaseOutlined style={{ fontSize: 22, color: '#1677ff' }} /><Title level={4} style={{ margin: 0 }}>Tablas BD</Title></Space>
          <Row gutter={8} style={{ marginTop: 12 }}>
            <Col span={12}><Card size="small"><Statistic title="Tablas" value={stats.nTablas} prefix={<TableOutlined />} /></Card></Col>
            <Col span={12}><Card size="small"><Statistic title="Filas totales" value={stats.nFilas} /></Card></Col>
            <Col span={12} style={{ marginTop: 8 }}><Card size="small"><Statistic title="Relaciones FK" value={stats.nFks} prefix={<LinkOutlined />} /></Card></Col>
            <Col span={12} style={{ marginTop: 8 }}><Card size="small"><Statistic title="Protegidas" value={stats.nProteg} /></Card></Col>
          </Row>
        </div>
        <div style={{ padding: 12 }}>
          <Input
            allowClear
            placeholder="Buscar tabla..."
            prefix={<SearchOutlined />}
            onChange={(e) => {
              const q = e.target.value.toLowerCase()
              const list = (effectiveMeta().tables || []).filter(t => t.tableName.toLowerCase().includes(q) || (t.comment || '').toLowerCase().includes(q))
              if (list.length && (!sel || !list.find(t => t.tableName === sel))) setSel(list[0].tableName)
            }}
          />
          {usingFallback && (
            <div style={{ marginTop: 8 }}>
              <Tag color="orange" icon={<InfoCircleOutlined />} style={{ width: '100%', textAlign: 'center', fontSize: 11 }}>
                MODO FUERZA LOCAL ACTIVO
              </Tag>
            </div>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[sel]}
          onClick={(e) => setSel(e.key)}
          style={{ height: usingFallback ? 'calc(100% - 270px)' : 'calc(100% - 220px)', overflow: 'auto', border: 'none' }}
          items={(effectiveMeta().tables || []).map(t => ({
            key: t.tableName,
            icon: t.protected ? <ExclamationCircleFilled style={{ color: '#faad14' }} /> : <TableOutlined />,
            label: (
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>{t.tableName}</Text>
                <Tag style={{ marginInlineEnd: 0 }} color={t.protected ? 'gold' : 'default'}>{t.rowCount || 0}</Tag>
              </Space>
            ),
          }))}
        />
      </Sider>

      <Content style={{ padding: 16, overflow: 'auto' }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small">
            <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  <Space>{curTab?.protected && <Tag color="gold">⛔ SOLO LECTURA</Tag>}Tabla · {sel}</Space>
                </Title>
                <Paragraph style={{ margin: '6px 0 0' }} type="secondary">{curTab?.comment || 'Sin comentario en schema'}</Paragraph>
              </div>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadRows}>Recargar</Button>
                <Button icon={<PlusOutlined />} type="primary" onClick={openNew} disabled={!!curTab?.protected}>Nuevo Registro</Button>
              </Space>
            </Space>

            {fks.length > 0 && (
              <Alert type="info" style={{ marginTop: 12 }} showIcon
                message={<Space><b>Campos con FK entrantes (dependen de otras tablas):</b></Space>}
                description={fks.map(f => (
                  <Tag key={f.constraintName} color="blue" icon={<LinkOutlined />}>
                    {f.columnName} → {f.foreignTableName}.{f.foreignColumnName}
                  </Tag>
                ))}
              />
            )}
            {fksTo.length > 0 && (
              <Alert type="info" style={{ marginTop: 8 }} showIcon
                message={<Space><b>Tablas que dependen de esta (FK salientes):</b></Space>}
                description={fksTo.map(f => (
                  <Tag key={f.constraintName} color="geekblue" icon={<LinkOutlined />}>
                    {f.tableName}.{f.columnName} ← {sel}.{f.foreignColumnName}
                  </Tag>
                ))}
              />
            )}

            <Divider />

            <Row gutter={12}>
              <Col xs={24} md={10}>
                <Input.Search
                  placeholder="Buscar en TODAS las columnas (ILIKE)..."
                  allowClear
                  enterButton={<><SearchOutlined /> Buscar</>}
                  onSearch={(v) => { setSearch(v); setSkip(0) }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Space>
                  <Text type="secondary">Páginado:</Text>
                  <Select value={take} onChange={(v) => { setTake(v); setSkip(0) }} style={{ width: 170 }}>
                    <Option value={25}>25 filas</Option>
                    <Option value={50}>50 filas</Option>
                    <Option value={100}>100 filas</Option>
                    <Option value={200}>200 filas</Option>
                    <Option value={500}>500 filas</Option>
                    <Option value={0}>📋 TODAS (sin paginar)</Option>
                  </Select>
                </Space>
              </Col>
              <Col xs={24} md={6} style={{ textAlign: 'right' }}>
                <Text type="secondary">
                  <InfoCircleOutlined /> Columnas: <b>{cols.length}</b> · PKs: <b>{pks.join(', ') || '—'}</b> · Total filas: <b>{total}</b>
                </Text>
              </Col>
            </Row>
          </Card>

          <Card size="small">
            <Table
              rowKey={(r: any) => pks.map(k => r[k]).join('|') || cols[0]?.columnName + '_' + Math.random()}
              size="small"
              loading={loading}
              columns={columns}
              dataSource={rows}
              scroll={{ x: cols.length * 160, y: 520 }}
              pagination={
                take <= 0
                  ? false
                  : {
                      current: Math.floor(skip / (take || 1)) + 1,
                      pageSize: take,
                      total,
                      showSizeChanger: false,
                      showQuickJumper: true,
                      showTotal: (t, r) => `${t} registros · mostrando ${r[0]}-${r[1]}`,
                      onChange: (p) => setSkip((p - 1) * take),
                    }
              }
            />
          </Card>
        </Space>
      </Content>

      <Modal
        title={
          <Space>
            {editMode === 'NEW' ? <PlusOutlined /> : <EditOutlined />}
            <b>{editMode === 'NEW' ? 'Nuevo Registro · ' : 'Editar Registro · '}{sel}</b>
            {curTab?.protected && <Tag color="gold">PROTEGIDA</Tag>}
          </Space>
        }
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={onSubmitEdit}
        okText={editMode === 'NEW' ? 'Insertar' : 'Guardar Cambios'}
        cancelText="Cancelar"
        confirmLoading={loading}
        width={720}
        styles={{ body: { maxHeight: '65vh', overflow: 'auto' } }}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Modo Fuerza (Admin Maestro)"
          description="Cualquier cambio se aplica DIRECTAMENTE en PostgreSQL sin validaciones de negocio. ¡Cuidado con FKs, cascadas y triggers!"
        />
        <Form form={form} layout="vertical">
          {cols.map(c => renderField(c))}
        </Form>
      </Modal>
    </Layout>
  )
}

export default AdminDataPanel
