import { useAuthStore } from '../store/auth.store'

export const useAuth = () => {
  const { token, usuario, permisos, isAuth, login, logout, hasPermission, setUsuario } = useAuthStore()
  return { token, usuario, permisos, isAuth, login, logout, hasPermission, setUsuario }
}
