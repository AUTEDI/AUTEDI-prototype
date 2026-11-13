import { ApiError, isApiError } from './errors'
import { qrApi, type QrLoginResponse } from './qrApi'
import { tokenStorage } from './tokenStorage'
import { worksheetApi } from './worksheetApi'
import { abortableDelay } from '../utils/abortableDelay'

/** 429만 자동 재시도한다. 단 한 번 성공하는 scan/link/token은 통신 오류 시 임의로 재전송하지 않는다. */
async function rateLimited<T>(request: () => Promise<T>, deadline: number, signal: AbortSignal): Promise<T> {
  while (true) {
    signal.throwIfAborted()
    if (Date.now() >= deadline) throw new ApiError({ status: 410, code: 'QR_002' })
    try {
      return await request()
    } catch (error) {
      if (!isApiError(error) || error.status !== 429) throw error
      await abortableDelay(Math.min(Math.max(error.retryAfterMs ?? 2000, 1000), deadline - Date.now()), signal)
    }
  }
}

export async function connectMobileQr(
  qrToken: string,
  signal: AbortSignal,
  onWaiting: () => void,
): Promise<QrLoginResponse> {
  const deadline = Date.now() + 3 * 60 * 1000
  if (tokenStorage.get()?.accessToken) {
    try {
      return (await rateLimited(() => qrApi.link(qrToken, signal), deadline, signal)).data
    } catch (error) {
      // API 클라이언트가 401 시 refresh와 재요청을 먼저 수행한다.
      if (!isApiError(error) || (error.status !== 401 && error.code !== 'QR_005')) throw error
    }
  }

  await rateLimited(() => qrApi.scan(qrToken, signal), deadline, signal)
  onWaiting()
  while (true) {
    let status
    try {
      const response = await rateLimited(() => qrApi.status(qrToken, signal), deadline, signal)
      status = response.data.status
    } catch (error) {
      if (!isApiError(error) || error.code !== 'NETWORK_ERROR') throw error
      await abortableDelay(2000, signal)
      continue
    }
    if (status === 'APPROVED') {
      return (await rateLimited(() => qrApi.token(qrToken, signal), deadline, signal)).data
    }
    if (status === 'REJECTED') {
      throw new ApiError({ status: 409, code: 'QR_003', message: '로그인 요청이 거절되었어요. 노트북에서 새 QR을 생성해주세요.' })
    }
    if (status === 'EXPIRED') throw new ApiError({ status: 410, code: 'QR_002' })
    if (status !== 'PENDING' && status !== 'SCANNED') throw new ApiError({ status: 409, code: 'QR_003' })
    await abortableDelay(2000, signal)
  }
}

/** QR에 지정된 대상에만 한 장을 업로드한다. 첨삭은 시작하지 않는다. */
export async function uploadMobilePhoto(worksheetId: number | null, file: File, signal?: AbortSignal) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new ApiError({ status: 415, code: 'FILE_002' })
  if (file.size === 0) throw new ApiError({ status: 400, code: 'FILE_001' })
  signal?.throwIfAborted()
  if (worksheetId === null) {
    const { data } = await worksheetApi.upload(file, signal)
    return 'worksheet' in data ? data.worksheet.id : data.id
  }
  const { data: worksheet } = await worksheetApi.get(worksheetId, signal)
  const { data } = await worksheetApi.replaceFile(worksheetId, file, worksheet.etag, signal)
  return data.id
}
