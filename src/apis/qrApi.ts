import { api } from './client'
import type { LoginResponse } from './types'

export type QrStatus = 'PENDING' | 'SCANNED' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'EXPIRED'
export type QrSession = { sessionId: string; expiresAt: string; qrImage: string }
export type QrLoginResponse = LoginResponse & { worksheetId: number | null }

const path = '/auth/qr-sessions'

export const qrApi = {
  create: (worksheetId?: number, signal?: AbortSignal) =>
    api.post<QrSession>(path, worksheetId === undefined ? {} : { worksheetId }, { signal }),
  scan: (qrToken: string, signal?: AbortSignal) =>
    api.post<null>(`${path}/scan`, { qrToken }, { anonymous: true, signal }),
  status: (qrToken: string, signal?: AbortSignal) =>
    api.post<{ status: QrStatus }>(`${path}/status`, { qrToken }, { anonymous: true, signal }),
  token: (qrToken: string, signal?: AbortSignal) =>
    api.post<QrLoginResponse>(`${path}/token`, { qrToken }, { anonymous: true, signal }),
  link: (qrToken: string, signal?: AbortSignal) =>
    api.post<QrLoginResponse>(`${path}/link`, { qrToken }, { signal }),
  approve: (sessionId: string) => api.post<null>(`${path}/${encodeURIComponent(sessionId)}/approve`),
  reject: (sessionId: string) => api.post<null>(`${path}/${encodeURIComponent(sessionId)}/reject`),
}
