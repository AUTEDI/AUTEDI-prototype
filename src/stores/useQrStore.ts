import { create } from 'zustand'
import { USE_LIVE_API } from '../apis/config'
import { getErrorMessage, isApiError } from '../apis/errors'
import type { ConnectionStatus, DesktopEvent } from '../apis/eventStream'
import { qrApi, type QrSession } from '../apis/qrApi'
import { fetchUploadedWorksheet } from '../apis/reviewService'
import { useAppStore } from './useAppStore'
import { useReviewStore } from './useReviewStore'

type QrPhase = 'pending' | 'scanned' | 'approved' | 'linked' | 'rejected' | 'expired' | 'receiving' | 'uploaded'
type DesktopSession = QrSession & { worksheetId: number | null; phase: QrPhase; deviceInfo: string }

type QrState = {
  connection: ConnectionStatus
  session: DesktopSession | null
  modalOpen: boolean
  creating: boolean
  deciding: boolean
  syncing: boolean
  error: string | null
  retryAt: number
  pendingWorksheetId: number | null
  openSession: (worksheetId?: number) => Promise<void>
  regenerate: () => Promise<void>
  close: () => void
  approve: () => Promise<void>
  reject: () => Promise<void>
  expire: () => void
  receiveEvent: (event: DesktopEvent, signal?: AbortSignal) => Promise<void>
  syncWorksheet: (signal?: AbortSignal) => Promise<void>
  reset: () => void
}

let creation: AbortController | null = null
const initialState = {
  connection: 'disconnected' as ConnectionStatus,
  session: null,
  modalOpen: false,
  creating: false,
  deciding: false,
  syncing: false,
  error: null,
  retryAt: 0,
  pendingWorksheetId: null,
}

/** 스캔 알림을 놓치지 않도록 SSE 연결 완료 후 QR을 생성한다. */
function waitForConnection(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  if (useQrStore.getState().connection === 'connected') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      unsubscribe()
      signal.removeEventListener('abort', abort)
    }
    const abort = () => { cleanup(); reject(signal.reason) }
    const unsubscribe = useQrStore.subscribe((state) => {
      if (state.connection !== 'connected') return
      cleanup()
      resolve()
    })
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Connection timeout'))
    }, 15_000)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const useQrStore = create<QrState>()((set, get) => {
  const setFailure = (error: unknown, fallback: string) => set({
    error: getErrorMessage(error, fallback),
    retryAt: isApiError(error) && error.status === 429 ? Date.now() + (error.retryAfterMs ?? 2000) : 0,
  })

  const createSession = async (worksheetId?: number) => {
    if (get().creating || Date.now() < get().retryAt) return
    creation?.abort()
    const controller = new AbortController()
    creation = controller
    set({ modalOpen: true, creating: true, deciding: false, syncing: false, session: null, error: null, pendingWorksheetId: null })
    try {
      if (!USE_LIVE_API) throw new Error('Demo mode')
      await waitForConnection(controller.signal)
      const { data } = await qrApi.create(worksheetId, controller.signal)
      controller.signal.throwIfAborted()
      set({ session: { ...data, worksheetId: worksheetId ?? null, phase: 'pending', deviceInfo: '' } })
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailure(error, USE_LIVE_API ? '연결을 준비하지 못했어요. 잠시 후 다시 시도해주세요.' : '휴대폰 업로드는 서버에 연결된 환경에서 이용할 수 있어요.')
      }
    } finally {
      if (creation === controller) set({ creating: false })
    }
  }

  const decide = async (approve: boolean) => {
    const { session, deciding, retryAt } = get()
    if (!session || session.phase !== 'scanned' || deciding || Date.now() < retryAt) return
    set({ deciding: true, error: null })
    try {
      await (approve ? qrApi.approve(session.sessionId) : qrApi.reject(session.sessionId))
      if (get().session?.sessionId !== session.sessionId) return
      set((state) => ({ session: state.session?.phase === 'scanned'
        ? { ...state.session, phase: approve ? 'approved' : 'rejected' } : state.session }))
    } catch (error) {
      if (get().session?.sessionId !== session.sessionId) return
      setFailure(error, '요청을 처리하지 못했어요. 다시 시도해주세요.')
      if (isApiError(error) && error.code === 'QR_002') get().expire()
    } finally {
      if (get().session?.sessionId === session.sessionId) set({ deciding: false })
    }
  }

  return {
    ...initialState,
    openSession: async (worksheetId) => {
      set({ modalOpen: true })
      const current = get().session
      if (current && !['uploaded', 'expired', 'rejected'].includes(current.phase)) {
        return
      }
      await createSession(worksheetId)
    },
    regenerate: () => createSession(get().session?.worksheetId ?? undefined),
    close: () => set({ modalOpen: false }),
    approve: () => decide(true),
    reject: () => decide(false),
    expire: () => set((state) => ({
      session: state.session && ['pending', 'scanned'].includes(state.session.phase)
        ? { ...state.session, phase: 'expired' } : state.session,
    })),
    receiveEvent: async (event, signal) => {
      const session = get().session
      if (!session || event.sessionId !== session.sessionId || signal?.aborted) return
      if (event.type === 'qr.scanned' && session.phase === 'pending') {
        set({ session: { ...session, phase: 'scanned', deviceInfo: event.deviceInfo }, modalOpen: true })
      } else if (event.type === 'qr.linked' && ['pending', 'scanned'].includes(session.phase)) {
        set({ session: { ...session, phase: 'linked', deviceInfo: event.deviceInfo }, modalOpen: true })
      } else if (event.type === 'qr.expired') {
        get().expire()
      } else if ('worksheetId' in event && session.phase !== 'uploaded') {
        if (event.type === 'worksheet.created' && session.worksheetId !== null) return
        if (event.type === 'worksheet.file_replaced' && session.worksheetId !== event.worksheetId) return
        set({ pendingWorksheetId: event.worksheetId, session: { ...session, phase: 'receiving' } })
        await get().syncWorksheet(signal)
      }
    },
    syncWorksheet: async (signal) => {
      const { pendingWorksheetId, session, syncing } = get()
      if (!pendingWorksheetId || !session || syncing || signal?.aborted) return
      set({ syncing: true, error: null })
      try {
        const file = await fetchUploadedWorksheet(pendingWorksheetId, signal)
        if (signal?.aborted || get().session?.sessionId !== session.sessionId) return
        const uploadId = useAppStore.getState().receiveWorksheet(file)
        if (useReviewStore.getState().activeUploadId === uploadId) useAppStore.getState().setStep('upload')
        useReviewStore.getState().forgetReview(uploadId)
        set((state) => ({
          session: state.session ? { ...state.session, phase: 'uploaded' } : null,
          modalOpen: false,
          pendingWorksheetId: null,
        }))
        useAppStore.getState().showToast('휴대폰에서 올린 학습지를 불러왔어요')
      } catch (error) {
        if (signal?.aborted || get().session?.sessionId !== session.sessionId) return
        setFailure(error, '사진을 불러오지 못했어요. 다시 불러오기를 눌러주세요.')
        set({ modalOpen: true })
      } finally {
        if (get().session?.sessionId === session.sessionId) set({ syncing: false })
      }
    },
    reset: () => {
      creation?.abort()
      creation = null
      set(initialState)
    },
  }
})
