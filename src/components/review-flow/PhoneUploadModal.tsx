import { useEffect, useState } from 'react'
import { useQrStore } from '../../stores/useQrStore'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

export function PhoneUploadModal() {
  const { session, modalOpen, creating, deciding, syncing, error, retryAt, connection,
    close, approve, reject, regenerate, expire, syncWorksheet } = useQrStore()
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!modalOpen) return
    const immediate = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(immediate)
      window.clearInterval(timer)
    }
  }, [modalOpen])

  useEffect(() => {
    if (!session || !['pending', 'scanned'].includes(session.phase)) return
    const remaining = new Date(session.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(expire, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [session, expire])

  if (!modalOpen) return null
  const phase = session?.phase
  const seconds = session ? Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - now) / 1000)) : 0
  const coolingDown = now < retryAt
  const waiting = phase === 'approved' || phase === 'linked'
  const expired = phase === 'expired' || phase === 'rejected'

  return (
    <Modal className="w-[min(400px,calc(100vw-32px))] text-center" labelledBy="phone-upload-title" onClose={close}>
      <p className="mb-2 text-[10px] font-extrabold text-[#5968df]">휴대폰으로 사진 업로드</p>
      <h2 className="pr-2 text-[20px] leading-snug tracking-[-0.7px]" id="phone-upload-title">
        {phase === 'scanned' ? '이 기기에서 로그인 요청을 허용할까요?' : waiting ? '휴대폰에서 사진을 올려주세요' : expired ? '새 QR을 생성해주세요' : phase === 'receiving' ? '사진을 불러오고 있어요' : '휴대폰으로 QR을 스캔해주세요'}
      </h2>

      {creating && <p className="py-12 text-[12px] text-[#8a8fa0]" role="status">{connection === 'connected' ? 'QR을 만들고 있어요…' : '안전하게 연결을 준비하고 있어요…'}</p>}

      {session && phase === 'pending' && (
        <>
          <p className="mt-3 text-[12px] leading-relaxed text-[#8a8fa0]">휴대폰 카메라로 QR을 찍으면<br />학습지 사진을 촬영해 올릴 수 있어요.</p>
          <div className="mx-auto my-5 grid size-[220px] place-items-center rounded-[18px] border border-line bg-white p-3">
            <img alt="휴대폰 사진 업로드 연결 QR 코드" className="size-full object-contain" src={session.qrImage} />
          </div>
          <p className="text-[12px] font-bold text-[#5968df]">남은 시간 {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
          <p className="mt-3 text-[11px] text-[#9b9fac]">QR 하나로 사진 한 장을 올릴 수 있어요.</p>
        </>
      )}

      {phase === 'scanned' && (
        <>
          <div className="my-5 rounded-xl bg-[#f4f5fa] px-4 py-5 text-[13px] font-bold break-words text-[#555d79]">{session?.deviceInfo}</div>
          <p className="mb-5 text-[12px] leading-relaxed text-[#8a8fa0]">허용하면 휴대폰이 같은 계정으로 로그인해요.<br />직접 스캔한 기기인지 확인해주세요.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={deciding || coolingDown} onClick={() => void reject()}>거절</Button>
            <Button disabled={deciding || coolingDown || connection !== 'connected'} onClick={() => void approve()} variant="primary">{deciding ? '처리 중…' : '허용'}</Button>
          </div>
        </>
      )}

      {waiting && <div className="mt-5 rounded-xl bg-[#eefaf5] px-4 py-6 text-[13px] leading-relaxed text-[#14725f]" role="status">{phase === 'linked' ? '휴대폰이 연결되었어요.' : '로그인을 허용했어요.'}<br />사진을 올리면 이 화면에 자동으로 표시돼요.</div>}
      {expired && <p className="py-6 text-[12px] leading-relaxed text-[#8a8fa0]">{phase === 'rejected' ? '로그인 요청을 거절했어요.' : 'QR의 유효 시간이 지났어요.'}<br />다시 연결하려면 새 QR을 생성해주세요.</p>}
      {phase === 'receiving' && !error && <p className="py-8 text-[12px] text-[#8a8fa0]" role="status">학습지 미리보기를 준비하고 있어요…</p>}
      {connection !== 'connected' && !creating && session && <p className="mt-4 text-[12px] leading-relaxed text-[#a66b30]" role="status">연결을 다시 시도하고 있어요. 연결이 복구되면 진행해주세요.</p>}
      {error && <p className="mt-4 rounded-xl bg-[#fff5f7] p-3 text-[12px] leading-relaxed text-[#c53843]" role="alert">{error}</p>}
      {coolingDown && <p className="mt-3 text-[11px] text-[#8a8fa0]">{Math.max(1, Math.ceil((retryAt - now) / 1000))}초 후 다시 시도할 수 있어요.</p>}
      {phase === 'receiving' && error && <Button className="mt-4 w-full" disabled={syncing || coolingDown} onClick={() => void syncWorksheet()} variant="primary">사진 다시 불러오기</Button>}
      {(expired || (!session && !creating)) && <Button className="mt-4 w-full" disabled={coolingDown} onClick={() => void regenerate()} variant="primary">새 QR 생성하기</Button>}
      {(waiting || (phase === 'scanned' && error)) && <Button className="mt-4 w-full" disabled={coolingDown || deciding} onClick={() => void regenerate()}>연결을 다시 하려면 새 QR 생성하기</Button>}
      {(waiting || phase === 'pending') && <Button className="mt-5 w-full" onClick={close}>닫기</Button>}
    </Modal>
  )
}
