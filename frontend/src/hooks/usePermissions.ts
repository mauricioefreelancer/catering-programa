import { useAuth } from './useAuth'

export const usePermissions = (modulo: string) => {
  const { hasPermission } = useAuth()
  return {
    ver: hasPermission(modulo, 'ver'),
    crear: hasPermission(modulo, 'crear'),
    editar: hasPermission(modulo, 'editar'),
    eliminar: hasPermission(modulo, 'eliminar'),
    has: (accion: string) => hasPermission(modulo, accion),
  }
}
