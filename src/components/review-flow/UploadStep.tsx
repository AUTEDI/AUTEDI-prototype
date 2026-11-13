import { useRef } from 'react'
import { SAMPLE_WORKSHEET_URL } from '../../constants/sampleReview'
import { useAppStore } from '../../stores/useAppStore'
import { useQrStore } from '../../stores/useQrStore'
import type { FeedbackSetting } from '../../types/review'
import { cn } from '../../utils/cn'
import { Button } from '../common/Button'
import { LevelToggle } from '../common/LevelToggle'
import { UploadIcon } from '../layout/icons'
import { FlowActions } from './FlowActions'
import { UploadPreview } from './UploadPreview'

const ACCEPT_IMAGES = 'image/jpeg,image/png'

/** 보조 업로드 수단. 컴퓨터에 있는 사진 파일을 직접 고른다. */
function ComputerUploadButton({ disabled, onFiles }: { disabled: boolean; onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        className="flex items-center gap-[10px] rounded-xl border border-line bg-white px-3 py-[10px] text-left transition hover:bg-[#f6f7ff] disabled:opacity-60"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <span className="grid size-[43px] flex-none place-items-center rounded-lg bg-[#eef0ff]">
          <UploadIcon className="size-[19px] fill-none stroke-[#5d6de4] stroke-[1.7]" />
        </span>
        <div className="grid gap-[3px]">
          <b className="text-[9px]">컴퓨터에서 파일 올리기</b>
          <small className="text-[7px] text-[#9b9fac]">JPG · PNG 파일을 고르거나 이 영역에 끌어다 놓으세요.</small>
        </div>
      </button>
      <input
        accept={ACCEPT_IMAGES}
        aria-label="컴퓨터에서 파일 선택"
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) onFiles(files)
          // 같은 파일을 다시 골라도 change가 일어나도록 비운다.
          event.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
    </>
  )
}

function SampleUploadButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-[10px] rounded-xl bg-navy px-3 py-[10px] text-left text-white disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="size-[43px] flex-none overflow-hidden rounded-lg bg-white">
        <img alt="예시 손글씨 학습지" className="size-full bg-white object-contain" src={SAMPLE_WORKSHEET_URL} />
      </span>
      <div className="grid gap-[3px]">
        <b className="text-[9px]">예시 학습지로 바로 체험하기</b>
        <small className="text-[7px] text-[#aeb4ca]">실제 손글씨 사진 위 첨삭 흐름을 확인해보세요.</small>
      </div>
      <em className="ml-auto text-[8px] text-[#aab2ff]">사용하기 →</em>
    </button>
  )
}

const sameSettings = (a: FeedbackSetting[], b: FeedbackSetting[]) =>
  a.every((setting, index) => setting.selected === b[index]?.selected && setting.level === b[index]?.level)

/** 이번 첨삭의 영역과 정도를 이 화면에서 바로 바꾼다. 기본 설정은 바뀌지 않는다. */
function SessionSettingsCard() {
  const settings = useAppStore((state) => state.sessionSettings)
  const defaults = useAppStore((state) => state.defaults)
  const updateSessionSetting = useAppStore((state) => state.updateSessionSetting)
  const isDefault = sameSettings(settings, defaults)

  return (
    <aside className="rounded-[18px] border border-line bg-white p-6 shadow-card max-sm:mt-3">
      <div className="flex items-start justify-between">
        <h2 className="my-1.5 text-[18px]">첨삭 영역</h2>
        <span className="rounded-md bg-[#eceaff] px-[7px] py-[5px] text-[7px] text-[#5b58c8]">
          {isDefault ? '기본 설정' : '이번 첨삭만'}
        </span>
      </div>
      <p className="mt-px mb-5 text-[9px] text-[#8a8fa0]">저장된 기본 설정이 자동으로 적용돼요. 여기서 바꾸면 이번 첨삭에만 적용돼요.</p>
      <div className="grid gap-[10px]">
        {settings.map((setting) => (
          <div className="flex items-center gap-2" key={setting.id}>
            <label className="flex w-[92px] shrink-0 cursor-pointer items-center gap-[7px] text-[10px] font-bold">
              <input
                checked={setting.selected}
                className="size-[13px] accent-[#4f5fd2]"
                onChange={() => updateSessionSetting({ ...setting, selected: !setting.selected })}
                type="checkbox"
              />
              {setting.name}
            </label>
            <LevelToggle
              className="flex-1"
              label={setting.name}
              muted={!setting.selected}
              onChange={(level) => updateSessionSetting({ ...setting, selected: true, level })}
              value={setting.level}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-[7px] text-[#9b9fac]">
        학생 실력 등급이 아닌, AI가 원문에 개입하는 정도입니다.
      </div>
    </aside>
  )
}

export function UploadStep({ onStart }: { onStart: () => void }) {
  const uploads = useAppStore((state) => state.uploads)
  const activeUploadId = useAppStore((state) => state.activeUploadId)
  const selectUpload = useAppStore((state) => state.selectUpload)
  const uploading = useAppStore((state) => state.uploading)
  const openSession = useQrStore((state) => state.openSession)
  const creatingQr = useQrStore((state) => state.creating)
  const syncingPhoto = useQrStore((state) => state.syncing)
  const loadSample = useAppStore((state) => state.loadSample)
  const loadFiles = useAppStore((state) => state.loadFiles)
  const removeFile = useAppStore((state) => state.removeFile)
  const navigate = useAppStore((state) => state.navigate)

  return (
    <div className="grid animate-fade-step grid-cols-[minmax(0,1fr)_355px] gap-[18px] max-md:grid-cols-[minmax(0,1fr)_310px] max-sm:block">
      <div
        className={cn(
          'grid min-h-[515px] min-w-0 gap-3 rounded-[18px] border border-line bg-white p-5 shadow-card max-sm:min-h-[420px]',
          uploads.length ? 'grid-rows-[1fr]' : 'grid-rows-[1fr_auto]',
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          if (files.length && !uploading) void loadFiles(files)
        }}
      >
        {uploads.length ? (
          <UploadPreview
            uploads={uploads}
            activeUploadId={activeUploadId}
            uploading={uploading}
            onSelect={selectUpload}
            onRemove={removeFile}
            onPhoneUpload={() => void openSession()}
            onComputerUpload={(files) => void loadFiles(files)}
          />
        ) : (
          <>
            <button
              className="flex min-h-[330px] flex-col items-center justify-center rounded-[15px] border-[1.5px] border-dashed border-[#bfc5ec] bg-[linear-gradient(145deg,#fbfbff,#f1f3ff)] px-5 text-center transition hover:border-[#6976e8] hover:bg-[#eef0ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6976e8] disabled:opacity-50"
              disabled={uploading || creatingQr || syncingPhoto}
              onClick={() => void openSession()}
              type="button"
            >
              <span className="mb-[17px] grid size-[58px] place-items-center rounded-[18px] bg-white shadow-[0_12px_30px_rgba(52,65,152,0.12)]"><UploadIcon className="size-[25px] fill-none stroke-[#5d6de4] stroke-[1.7]" /></span>
              <span className="mb-2 text-[16px] font-bold">핸드폰으로 사진 찍어 업로드하기</span>
              <span className="text-[11px] leading-relaxed text-[#8a8fa0]">QR을 스캔하고 학습지를 촬영하면<br />이 화면에 사진이 자동으로 표시돼요.</span>
              <span className="mt-5 text-[9px] font-extrabold tracking-[1px] text-[#a0a4b3]">JPG · PNG · 사진 한 장</span>
            </button>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <ComputerUploadButton disabled={uploading} onFiles={(files) => void loadFiles(files)} />
              <SampleUploadButton disabled={uploading} onClick={() => void loadSample()} />
            </div>
          </>
        )}
      </div>
      <SessionSettingsCard />
      {uploads.length > 1 && <p className="col-span-full text-[10px] text-[#8a8fa0]">현재 파일부터 첨삭을 시작합니다. 다른 파일은 첨삭 화면의 원본 목록에서 선택할 수 있어요.</p>}
      <FlowActions>
        <Button onClick={() => navigate('home')}>취소</Button>
        <Button disabled={!uploads.length || uploading || syncingPhoto} onClick={onStart} variant="primary">
          {uploads.length > 1 ? '선택한 파일 첨삭 시작' : '이 설정으로 첨삭 시작'} <b className="ml-2">✦</b>
        </Button>
      </FlowActions>
    </div>
  )
}
