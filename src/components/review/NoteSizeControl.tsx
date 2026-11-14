import { cn } from '../../utils/cn'

export const NOTE_SCALE_MIN = 0.6
export const NOTE_SCALE_MAX = 2
const STEP = 0.15

const round = (value: number) => Math.round(value * 100) / 100

/** 선택한 코멘트 위에 뜨는 글자 크기 조절 버튼. 누를 때 코멘트 드래그·선택이 일어나지 않게 막는다. */
export function NoteSizeControl({ scale, onChange, className }: {
  scale: number
  onChange: (scale: number) => void
  className?: string
}) {
  const change = (delta: number) => onChange(round(Math.min(NOTE_SCALE_MAX, Math.max(NOTE_SCALE_MIN, scale + delta))))
  const button = 'grid size-[22px] place-items-center rounded-full text-[11px] font-black text-[#3c4a9e] hover:bg-[#eef0ff] disabled:opacity-35'

  return (
    <div
      aria-label="코멘트 글자 크기"
      className={cn(
        'absolute bottom-full left-1/2 z-[12] mb-1 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[#d8dcf3] bg-white px-1 py-0.5 font-sans whitespace-nowrap shadow-[0_4px_12px_rgba(36,44,99,0.14)]',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      role="group"
    >
      <button aria-label="글자 작게" className={button} disabled={scale <= NOTE_SCALE_MIN} onClick={() => change(-STEP)} type="button">
        가−
      </button>
      <button
        aria-label="글자 크기 원래대로"
        className="min-w-[34px] rounded-full px-1 text-[9px] font-bold text-[#6d7389] hover:bg-[#eef0ff]"
        onClick={() => onChange(1)}
        title="원래 크기로"
        type="button"
      >
        {Math.round(scale * 100)}%
      </button>
      <button aria-label="글자 크게" className={button} disabled={scale >= NOTE_SCALE_MAX} onClick={() => change(STEP)} type="button">
        가+
      </button>
    </div>
  )
}
