import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../services/api'

// Shared notification state for the portal bell. Reads the same session token
// every dashboard uses and talks to the existing /notifications endpoints.
export function useNotifications(token) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    if (!token) return
    try { setItems(await apiRequest('/notifications', 'GET', null, token)) } catch { /* non-fatal */ }
  }, [token])
  useEffect(() => { load() }, [load])
  const markRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, 'PUT', {}, token)
      setItems((rows) => rows.map((row) => (row.id === id ? { ...row, read: true } : row)))
    } catch { /* non-fatal */ }
  }
  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', 'PUT', {}, token)
      setItems((rows) => rows.map((row) => ({ ...row, read: true })))
    } catch { /* non-fatal */ }
  }
  return { items, unread: items.filter((item) => !item.read).length, open, setOpen, markRead, markAllRead }
}
