import { useState, useEffect, useCallback } from 'react'
import { errorsApi, type ErrorEvent } from '../lib/api'

export function useErrors(params: Record<string, unknown>) {
  const [data, setData] = useState<ErrorEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await errorsApi.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(params)])

  useEffect(() => { fetch() }, [fetch])

  return { data, total, loading, error, refetch: fetch }
}
