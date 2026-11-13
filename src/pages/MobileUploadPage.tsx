import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type SVGProps } from 'react'
import { getErrorMessage, isApiError } from '../apis/errors'
import { uploadMobilePhoto } from '../apis/qrLoginService'
import { Button } from '../components/common/Button'
import { UploadIcon } from '../components/layout/icons'
import autediIcon from '../images/pavicon.ico'
import { useMobileQrLogin } from '../hooks/useMobileQrLogin'

type SelectedPhoto = { file: File; url: string }

function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" {...props}>
      <path d="M8 6.5 9.5 4h5L16 6.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function MobileUploadPage() {
  const connection = useMobileQrLogin()
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [requiresNewQr, setRequiresNewQr] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now)
  const uploadRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url)
    }
  }, [photo])

  useEffect(() => () => uploadRequest.current?.abort(), [])
  useEffect(() => {
    if (!retryAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (uploadRequest.current || uploaded) return
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('JPG 또는 PNG 사진을 선택해주세요.')
      return
    }
    if (file.size === 0) {
      setError('비어 있는 파일이에요. 다른 사진을 선택해주세요.')
      return
    }
    setError(null)
    setPhoto({ file, url: URL.createObjectURL(file) })
  }

  const upload = async () => {
    if (!photo || connection.status !== 'ready' || uploadRequest.current || uploaded || requiresNewQr || Date.now() < retryAt) return
    const controller = new AbortController()
    uploadRequest.current = controller
    setUploading(true)
    setError(null)
    try {
      await uploadMobilePhoto(connection.worksheetId, photo.file, controller.signal)
      if (!controller.signal.aborted) setUploaded(true)
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(getErrorMessage(caught, '사진을 올리지 못했어요. 잠시 후 다시 시도해주세요.'))
      if (isApiError(caught)) {
        if (['QR_001', 'QR_002', 'QR_003', 'QR_004', 'QR_006'].includes(caught.code) || caught.status === 401) setRequiresNewQr(true)
        if (caught.status === 429) {
          setNow(Date.now())
          setRetryAt(Date.now() + (caught.retryAfterMs ?? 2000))
        }
      }
    } finally {
      if (!controller.signal.aborted) setUploading(false)
      uploadRequest.current = null
    }
  }

  if (connection.status !== 'ready') {
    return (
      <MobileUploadFrame>
        <section className="rounded-[22px] border border-line bg-white px-6 py-10 text-center shadow-card" aria-live="polite">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-[20px] bg-[#eef0ff] text-[#5d6de4]"><CameraIcon className="size-8" /></div>
          <h1 className="text-[22px] tracking-[-0.7px]">{connection.status === 'error' ? 'QR 연결을 확인해주세요' : connection.status === 'waiting' ? '노트북에서 허용해주세요' : '노트북과 연결하고 있어요'}</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[#8a8fa0]" role={connection.status === 'error' ? 'alert' : 'status'}>{connection.status === 'error' ? connection.message : connection.status === 'waiting' ? '노트북 화면에 표시된 로그인 요청을 허용하면 사진을 올릴 수 있어요.' : '잠시만 기다려주세요.'}</p>
        </section>
      </MobileUploadFrame>
    )
  }

  if (uploaded) {
    return (
      <MobileUploadFrame>
        <section className="rounded-[22px] border border-line bg-white px-6 py-10 text-center shadow-card" role="status">
          <div aria-hidden="true" className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-[#eefaf5] text-[30px] text-[#18ae84]">✓</div>
          <h1 className="text-[24px] tracking-[-0.9px]">사진을 올렸어요</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#8a8fa0]">노트북에서 사진을 확인하고<br />첨삭을 시작해주세요.</p>
          {photo && <img alt="업로드한 학습지 사진" className="mt-6 h-[220px] w-full rounded-xl bg-canvas object-contain p-3" src={photo.url} />}
          <p className="mt-6 text-[12px] leading-relaxed text-[#9b9fac]">다른 사진을 올리려면<br />노트북에서 새 QR을 생성해 스캔해주세요.</p>
        </section>
      </MobileUploadFrame>
    )
  }

  return (
    <MobileUploadFrame>
        <section aria-labelledby="mobile-upload-title" className="rounded-[22px] border border-line bg-white p-5 shadow-card min-[390px]:p-6">
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-extrabold text-[#5968df]">AI 영어 첨삭</p>
            <h1 className="text-[24px] leading-[1.4] tracking-[-0.9px]" id="mobile-upload-title">학습지 사진을 올려주세요</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8a8fa0]">직접 촬영하거나 앨범에서 사진을 선택하세요.</p>
          </div>

          <fieldset disabled={uploading || requiresNewQr} className="min-w-0 disabled:opacity-60">
          <input ref={cameraRef} accept="image/jpeg,image/png" aria-label="카메라로 학습지 촬영" capture="environment" className="hidden" onChange={selectPhoto} type="file" />
          <input ref={albumRef} accept="image/jpeg,image/png" aria-label="앨범에서 학습지 사진 선택" className="hidden" onChange={selectPhoto} type="file" />

          {photo ? (
            <div className="animate-fade-step">
              <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
                <h2 className="text-[13px] text-[#555d79]">선택한 사진 <span className="ml-1 text-[#5968df]">1장</span></h2>
                <button className="min-h-11 rounded-lg px-3 text-[12px] font-bold text-[#8a8fa0] hover:bg-[#fff5f7] hover:text-[#c53843] focus-visible:outline-2 focus-visible:outline-[#6976e8]" onClick={() => { setPhoto(null); setError(null) }} type="button">선택 취소</button>
              </div>
              <div className="grid h-[min(42dvh,360px)] min-h-[200px] place-items-center overflow-hidden rounded-[15px] border border-line bg-[#f6f7fb] p-3">
                <img alt="선택한 학습지 사진 미리보기" className="size-full min-h-0 object-contain" onError={() => { setPhoto(null); setError('사진을 불러오지 못했어요. 다른 사진을 선택해주세요.') }} src={photo.url} />
              </div>
              <p className="mt-3 truncate text-[12px] font-bold text-[#555d79]" title={photo.file.name}>{photo.file.name}</p>
              <p className="mt-1 text-[11px] text-[#8a8fa0]">{(photo.file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div className="flex min-h-[235px] flex-col items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-[#bfc5ec] bg-[linear-gradient(145deg,#fbfbff,#f1f3ff)] px-4 py-8 text-center">
              <div className="mb-5 grid size-16 place-items-center rounded-[20px] bg-white text-[#5d6de4] shadow-[0_12px_30px_rgba(52,65,152,0.12)]"><CameraIcon className="size-8" /></div>
              <h2 className="text-[16px] tracking-[-0.4px]">한 장에 학습지 전체가 보이게</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8a8fa0]">글자가 선명하게 보이도록 찍어주세요.</p>
              <span className="mt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#a0a4b3]">JPG · PNG</span>
            </div>
          )}

          {error && <p className="mt-4 rounded-[10px] bg-[#fff5f7] px-3 py-3 text-[12px] leading-relaxed text-[#c53843]" role="alert">{error}</p>}

          <div className="mt-5 grid gap-3">
            <Button className="flex h-12 items-center justify-center gap-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6976e8]" onClick={() => cameraRef.current?.click()} variant={photo ? 'secondary' : 'primary'}><CameraIcon className="size-5" />{photo ? '다시 촬영하기' : '사진 촬영하기'}</Button>
            <Button className="flex h-12 items-center justify-center gap-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6976e8]" onClick={() => albumRef.current?.click()}><UploadIcon className="size-5 fill-none stroke-current stroke-[1.7]" />{photo ? '다른 사진 선택하기' : '앨범에서 선택하기'}</Button>
          </div>
          </fieldset>

          <aside className="mt-5 rounded-xl bg-[#f6f7fb] px-4 py-3.5">
            <h2 className="text-[12px] text-[#666c80]">촬영 전 확인해주세요</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-[#8a8fa0]">
              <li>학습지를 평평하게 펴고 밝은 곳에서 촬영해주세요.</li>
              <li>그림자와 빛 반사가 글자를 가리지 않게 해주세요.</li>
            </ul>
          </aside>

          <div className="mt-6 border-t border-line pt-5">
            <Button className="flex h-[52px] w-full items-center justify-center gap-2 text-[14px] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none" disabled={!photo || uploading || requiresNewQr || now < retryAt} onClick={() => void upload()} variant="primary"><UploadIcon className="size-5 fill-none stroke-current stroke-[1.7]" />{uploading ? '사진을 올리고 있어요…' : '사진 업로드'}</Button>
            <p aria-live="polite" className="mt-3 text-center text-[12px] leading-relaxed text-[#8a8fa0]">{requiresNewQr ? '노트북에서 새 QR을 생성해 다시 스캔해주세요.' : now < retryAt ? `${Math.max(1, Math.ceil((retryAt - now) / 1000))}초 후 다시 시도해주세요.` : uploading ? '완료될 때까지 이 화면을 유지해주세요.' : photo ? '사진을 올리면 노트북에서 확인할 수 있어요.' : '업로드할 학습지 사진 한 장을 선택해주세요.'}</p>
          </div>
        </section>
    </MobileUploadFrame>
  )
}

function MobileUploadFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] sm:py-12">
      <div className="mx-auto w-full max-w-[440px] animate-fade-page">
        <header className="mb-8 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <img alt="" className="size-8 object-contain" src={autediIcon} />
            <span className="text-[16px] font-extrabold tracking-[2px] text-navy">AUTEDI</span>
          </div>
          <span className="rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-bold text-[#70768a]">사진 업로드</span>
        </header>
        {children}
        <p className="mt-5 text-center text-[11px] leading-relaxed text-[#9b9fac]">첨삭은 노트북 화면에서 시작할 수 있어요.</p>
      </div>
    </main>
  )
}
