import { useEffect, useState } from 'react'
import { get, set, del, clear } from 'idb-keyval'

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

export const offlineStore = {
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
      const list = await offlineStore.getPending()
      const newItem: PendingInventory = {
        ...item,
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        createdAt: Date.now(),
      }
      list.push(newItem)
      await set(IDB_KEY, list)
    } catch (e) {
      console.error('Error guardando offline en IndexedDB', e)
    }
  },
  async removePending(ids: string[]): Promise<void> {
    try {
      const list = await offlineStore.getPending()
      const remaining = list.filter((x) => !ids.includes(x.id))
      await set(IDB_KEY, remaining)
    } catch (e) {
      console.error('Error borrando offline de IndexedDB', e)
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
}

export const useOfflinePending = () => {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<PendingInventory[]>([])

  const refresh = async () => {
    const all = await offlineStore.getPending()
    setItems(all)
    setCount(all.length)
  }

  useEffect(() => {
    refresh()
    const onStorage = () => refresh()
    window.addEventListener('storage', onStorage)
    const iv = setInterval(refresh, 5000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(iv)
    }
  }, [])

  return { count, items, refresh }
}
