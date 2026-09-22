import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { post } from '../api/services/api'

export interface Permisos {
  [modulo: string]: {
    ver?: boolean
    crear?: boolean
    editar?: boolean
    eliminar?: boolean
    [key: string]: boolean | undefined
  }
}

export interface Usuario {
  id?: number
  nombre?: string
  email?: string
  usuario_login?: string
  rol?: string
  rolId?: number
  perfil?: string
  permisos?: Permisos
  excepciones_permisos?: Permisos
}

interface AuthState {
  token: string | null
  usuario: Usuario | null
  permisos: Permisos
  isAuth: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (modulo: string, accion?: string) => boolean
  setUsuario: (u: Usuario) => void
}

const mergePermisos = (base?: Permisos, excepciones?: Permisos): Permisos => {
  const result: Permisos = { ...(base || {}) }
  if (excepciones) {
    for (const mod of Object.keys(excepciones)) {
      result[mod] = { ...(result[mod] || {}), ...excepciones[mod] }
    }
  }
  return result
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      permisos: {},
      isAuth: false,
      login: async (email, password) => {
        const res: any = await post('/auth/login', { email, password })
        const token = res?.accessToken || res?.token
        const usuario = res?.usuario || res?.user || res
        const permisos = mergePermisos(usuario?.permisos, usuario?.excepciones_permisos)
        set({ token, usuario, permisos, isAuth: true })
        if (token) localStorage.setItem('token', token)
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, usuario: null, permisos: {}, isAuth: false })
      },
      hasPermission: (modulo, accion = 'ver') => {
        const state = get() as any
        const { permisos, usuario } = state
        const rolName = String(usuario?.rol || usuario?.rolNombre || '').toLowerCase()
        const perfilName = String(usuario?.perfil || '').toLowerCase()
        const email = String(usuario?.email || '').toLowerCase()

        if (
          email === 'admin@example.com' ||
          rolName.includes('administrador') ||
          rolName.includes('maestro') ||
          rolName.includes('gerencia') ||
          rolName.includes('desarrollador') ||
          rolName.includes('megacuadro') ||
          perfilName === 'gerencia' ||
          perfilName === 'administrador' ||
          perfilName === 'desarrollador' ||
          perfilName === 'megacuadro'
        ) {
          return true
        }

        const mod = permisos[modulo]
        if (!mod) return false
        if (accion === 'ver' && (mod.ver || mod.crear || mod.editar || mod.eliminar)) return true
        return !!mod[accion]
      },
      setUsuario: (u) => {
        const permisos = mergePermisos((u as any)?.permisos, (u as any)?.excepciones_permisos)
        ;(set as any)({ usuario: u, permisos })
      },
    }),
    {
      name: 'auth',
      partialize: (state) => ({
        token: state.token,
        usuario: state.usuario,
        permisos: state.permisos,
        isAuth: state.isAuth,
      }),
    }
  )
)
