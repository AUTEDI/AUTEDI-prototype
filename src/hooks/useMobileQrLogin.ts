import { useEffect, useState } from 'react'
import { USE_LIVE_API } from '../apis/config'
import { getErrorMessage } from '../apis/errors'
import { connectMobileQr } from '../apis/qrLoginService'
import { useAuthStore } from '../stores/useAuthStore'

type MobileConnection =
  | { status: 'connecting' | 'waiting' }
  | { status: 'ready'; worksheetId: number | null }
  | { status: 'error'; message: string }

export function useMobileQrLogin() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'))
  const [connection, setConnection] = useState<MobileConnection>(() => {
    if (!token) return { status: 'error', message: '노트북에서 휴대폰 업로드 버튼을 누른 뒤 QR을 스캔해주세요.' }
    if (!USE_LIVE_API) return { status: 'error', message: '서버에 연결된 환경에서 QR을 다시 스캔해주세요.' }
    return { status: 'connecting' }
  })

  useEffect(() => {
    if (!token || !USE_LIVE_API) return
    const controller = new AbortController()
    // StrictMode의 첫 setup/cleanup에서는 일회성 scan/link 요청을 보내지 않는다.
    const timer = window.setTimeout(() => {
      void connectMobileQr(token, controller.signal, () => {
        if (!controller.signal.aborted) setConnection({ status: 'waiting' })
      }).then((response) => {
        if (controller.signal.aborted) return
        useAuthStore.getState().acceptLogin(response)
        setConnection({ status: 'ready', worksheetId: response.worksheetId })
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setConnection({ status: 'error', message: getErrorMessage(error, '연결하지 못했어요. 노트북에서 새 QR을 생성해 다시 스캔해주세요.') })
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [token])

  return connection
}
