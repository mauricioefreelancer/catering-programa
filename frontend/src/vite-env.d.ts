/// <reference types="vite/client" />

declare module 'antd' {
  const content: any
  export const ConfigProvider: any
  export const Button: any
  export const Layout: any
  export const Typography: any
  export const theme: any
  export default content
}

declare module '@ant-design/icons' {
  const content: any
  export const SmileOutlined: any
  export default content
}

declare module 'antd/locale/*' {
  const content: any
  export default content
}

declare module '@vitejs/plugin-react' {
  const content: any
  export default content
}

declare module 'vite-plugin-pwa' {
  const content: any
  export const VitePWA: any
  export default content
}
