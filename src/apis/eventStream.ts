import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_PREFIX, clearAuthentication, refreshAccessToken } from './client'
import { API_BASE_URL } from './config'
import { ApiError } from './errors'
import { tokenStorage } from './tokenStorage'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
export type DesktopEvent =
  | { type: 'qr.scanned' | 'qr.linked' | 'qr.expired'; sessionId: string; deviceInfo: string; eventId: string }
  | { type: 'worksheet.created' | 'worksheet.file_replaced'; sessionId: string; worksheetId: number; eventId: string }

/** 알 수 없는 이벤트, 빈 데이터와 잘못된 payload는 연결을 끊지 않고 무시한다. */
export function parseDesktopEvent(type: string, value: string): DesktopEvent | null {
  try {
    const data: unknown = JSON.parse(value)
    if (!data || typeof data !== 'object') return null
    const payload = data as Record<string, unknown>
    if (typeof payload.sessionId !== 'string') return null
    const common = { sessionId: payload.sessionId, eventId: typeof payload.eventId === 'string' ? payload.eventId : '' }
    if (type === 'qr.scanned' || type === 'qr.linked' || type === 'qr.expired') {
      return { type, ...common, deviceInfo: typeof payload.deviceInfo === 'string' ? payload.deviceInfo : '휴대폰' }
    }
    if ((type === 'worksheet.created' || type === 'worksheet.file_replaced')
      && typeof payload.worksheetId === 'number' && Number.isSafeInteger(payload.worksheetId) && payload.worksheetId > 0) {
      return { type, ...common, worksheetId: payload.worksheetId }
    }
  } catch {
    // 하트비트나 잘못된 JSON은 처리하지 않는다.
  }
  return null
}

class AuthenticationError extends Error {}

export function connectEventStream({ signal, onStatus, onEvent, onReconnect }: {
  signal: AbortSignal
  onStatus: (status: ConnectionStatus) => void
  onEvent: (event: DesktopEvent) => void
  onReconnect: () => void
}): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  let attempts = 0
  let opened = false
  const seen = new Set<string>()
  onStatus('connecting')

  return fetchEventSource(`${API_BASE_URL}${API_PREFIX}/events`, {
    signal,
    openWhenHidden: true,
    // 라이브러리 내부 재연결에서도 매번 최신 토큰으로 헤더를 구성한다.
    fetch: async (input, init) => {
      signal.throwIfAborted()
      const request = () => {
        const token = tokenStorage.get()?.accessToken
        if (!token) {
          clearAuthentication()
          throw new AuthenticationError()
        }
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, { ...init, headers })
      }
      let response = await request()
      if (response.status === 401) {
        if (!await refreshAccessToken()) throw new AuthenticationError()
        signal.throwIfAborted()
        response = await request()
        if (response.status === 401) {
          clearAuthentication()
          throw new AuthenticationError()
        }
      }
      return response
    },
    async onopen(response) {
      if (!response.ok || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) {
        const retryAfter = response.headers.get('Retry-After')
        throw new ApiError({
          status: response.status,
          code: response.status === 429 ? 'COMMON_429' : 'NETWORK_ERROR',
          retryAfterMs: retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : null,
        })
      }
      onStatus('connected')
      if (opened) onReconnect()
      opened = true
      // 접속 즉시 닫히는 연결도 백오프가 증가하도록, 이벤트 수신 시에만 초기화한다.
    },
    onmessage(message) {
      if (signal.aborted) return
      if (message.data) attempts = 0
      const event = parseDesktopEvent(message.event, message.data)
      if (!event || (event.eventId && seen.has(event.eventId))) return
      if (event.eventId) {
        seen.add(event.eventId)
        if (seen.size > 500) seen.delete(seen.values().next().value!)
      }
      onEvent(event)
    },
    onclose() {
      throw new Error('Event stream closed')
    },
    onerror(error: unknown) {
      if (signal.aborted) throw error
      if (error instanceof AuthenticationError || (error instanceof ApiError && error.status === 403)) {
        onStatus('disconnected')
        throw error
      }
      onStatus('reconnecting')
      const delay = Math.min(1000 * 2 ** Math.min(attempts++, 5), 30_000)
      return error instanceof ApiError ? Math.max(delay, error.retryAfterMs ?? 0) : delay
    },
  })
}
