import { useEffect } from 'react'
import { USE_LIVE_API } from '../apis/config'
import { connectEventStream } from '../apis/eventStream'
import { useAuthStore } from '../stores/useAuthStore'
import { useQrStore } from '../stores/useQrStore'

export function useDesktopEvents() {
  const email = useAuthStore((state) => state.user?.email)
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    if (!USE_LIVE_API || status !== 'authenticated') return
    const controller = new AbortController()
    void connectEventStream({
      signal: controller.signal,
      onStatus: (connection) => {
        if (!controller.signal.aborted) useQrStore.setState({ connection })
      },
      onEvent: (event) => { void useQrStore.getState().receiveEvent(event, controller.signal) },
      onReconnect: () => { void useQrStore.getState().syncWorksheet(controller.signal) },
    }).catch(() => {
      if (!controller.signal.aborted) useQrStore.setState({ connection: 'disconnected' })
    })
    return () => {
      controller.abort()
      useQrStore.getState().reset()
    }
  }, [email, status])
}
