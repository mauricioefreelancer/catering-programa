import api from '../axios'

export const get = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api.get<T>(url, { params })
  return res.data
}

export const post = async <T = any>(url: string, data?: any): Promise<T> => {
  const res = await api.post<T>(url, data)
  return res.data
}

export const patch = async <T = any>(url: string, data?: any): Promise<T> => {
  const res = await api.patch<T>(url, data)
  return res.data
}

export const remove = async <T = any>(url: string): Promise<T> => {
  const res = await api.delete<T>(url)
  return res.data
}

export const apiService = { get, post, patch, remove }
