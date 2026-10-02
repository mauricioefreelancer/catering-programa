import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntdApp } from 'antd'
import esES from 'antd/locale/es_ES'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'dayjs/locale/es'
import dayjs from 'dayjs'
import App from './App'

dayjs.locale('es')

// Auto-recarga: detecta un nuevo despliegue (Netlify) comparando version.json y
// recarga la página sola, evitando dar F5 manual tras cada cambio.
;(() => {
  let versionActual: string | null = null
  let recargando = false
  const chequeo = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const v = String(data?.version || '')
      if (!v) return
      if (versionActual === null) {
        versionActual = v // primera carga: guardar versión
        return
      }
      if (versionActual !== v && !recargando) {
        recargando = true
        window.location.reload()
      }
    } catch {
      // si falla la red, no interrumpir
    }
  }
  window.addEventListener('load', () => {
    chequeo()
    setInterval(chequeo, 20000)
  })
})()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={esES}
        theme={{
          algorithm: undefined,
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 8,
            fontSize: 14,
          },
          components: {
            Layout: {
              headerBg: '#ffffff',
              siderBg: '#001529',
            },
            Menu: {
              darkItemBg: '#001529',
              darkSubMenuItemBg: '#000c17',
            },
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
