import { useEffect, useState, useCallback } from 'react'
import { get, set, del, clear } from 'idb-keyval'
import { message } from 'antd'
import api from '../api/axios'

export interface PendingInventory {
  id: string
  maquinaId: number
  maquinaSerial: string
  espirales?: Array<{ espiral: string; fisico: number; sugerida: number }>
  nr_actual?: number
  nrq?: Array<{ boton: string; valor: number }>
  createdAt: number
}

const IDB_KEY = 'pending_inventories_v1'

export const offlineSyncService = {
  async getPending(): Promise<PendingInventory[]> {
    try {
      const raw = (await get(IDB_KEY)) as PendingInventory[] | undefined
      return raw || []
    } catch {
      return []
    }
  },

  async addPending(item: Omit<PendingInventory, 'id' | 'createdAt'>): Promise<void> {
    try {
      const list = await offlineSyncService.getPending()
      const newItem: PendingInventory = {
        ...item,
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(),
      }
      list.push(newItem)
      await set(IDB_KEY, list)
    } catch (e) {
      console.error('Error guardando offline en IndexedDB', e)
      throw e
    }
  },

  async removePending(ids: string[]): Promise<void> {
    try {
      const list = await offlineSyncService.getPending()
      const remaining = list.filter((x) => !ids.includes(x.id))
      await set(IDB_KEY, remaining)
    } catch (e) {
      console.error('Error borrando offline de IndexedDB', e)
      throw e
    }
  },

  async clearAll(): Promise<void> {
    try {
      await del(IDB_KEY)
    } catch {
      try {
        await clear()
      } catch {
        /* ignore */
      }
    }
  },

  async syncAll(): Promise<{ total: number; success: number; failed: number }> {
    const items = await offlineSyncService.getPending()
    if (items.length === 0) {
      return { total: 0, success: 0, failed: 0 }
    }

    const successIds: string[] = []
    let failed = 0

    for (const it of items) {
      try {
        const payload = {
          maquinaId: it.maquinaId,
          maquinaSerial: it.maquinaSerial,
          espirales: it.espirales || [],
          nr_actual: it.nr_actual,
          nrq: it.nrq || [],
          offline_id: it.id,
        }
        await api.post('/pedidos-operador', payload)
        successIds.push(it.id)
      } catch (e: any) {
        const isNetworkError =
          !e?.response ||
          e?.code === 'ERR_NETWORK' ||
          (e.isAxiosError && !e.response)
        if (!isNetworkError) {
          successIds.push(it.id)
        } else {
          failed++
        }
      }
    }

    if (successIds.length > 0) {
      await offlineSyncService.removePending(successIds)
    }

    return {
      total: items.length,
      success: successIds.length,
      failed,
    }
  },
}

export const useOfflineSync = () => {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<PendingInventory[]>([])
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    const all = await offlineSyncService.getPending()
    setItems(all)
    setCount(all.length)
  }, [])

  const syncNow = useCallback(async () => {
    if (!window.navigator.onLine) {
      message.warning('📴 Sin conexión a internet')
      return { total: 0, success: 0, failed: 0 }
    }
    setSyncing(true)
    try {
      const result = await offlineSyncService.syncAll()
      if (result.total === 0) {
        message.info('No hay inventarios pendientes por sincronizar')
      } else if (result.failed === 0) {
        message.success(`✅ Sincronizados ${result.success}/${result.total} inventarios`)
      } else {
        message.warning(`Sincronizados ${result.success}/${result.total}. ${result.failed} quedaron pendientes.`)
      }
      await refresh()
      return result
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  useEffect(() => {
    refresh()

    const onOnline = () => {
      message.info('📡 Conexión restaurada - sincronizando...')
      syncNow()
    }
    const onStorage = () => refresh()

    window.addEventListener('online', onOnline)
    window.addEventListener('storage', onStorage)
    const iv = setInterval(refresh, 5000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('storage', onStorage)
      clearInterval(iv)
    }
  }, [refresh, syncNow])

  return { count, items, refresh, syncing, syncNow }
}
