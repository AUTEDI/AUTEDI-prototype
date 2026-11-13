import { LEVEL_DESCRIPTIONS } from '../../constants/settings'
import type { FeedbackLevel } from '../../types/review'
import { cn } from '../../utils/cn'

const LEVELS: FeedbackLevel[] = ['Standard', 'Advanced']

type LevelToggleProps = {
  label: string
  value: FeedbackLevel
  /** 영역을 빼둔 상태면 흐리게 보여준다. 누르면 다시 포함된다. */
  muted?: boolean
  className?: string
  onChange: (level: FeedbackLevel) => void
}

/** 첨삭 정도를 Standard/Advanced 중 하나로 고르는 토글. 설명은 마우스를 올리면 보여준다. */
export function LevelToggle({ label, value, muted = false, className, onChange }: LevelToggleProps) {
  return (
    <div
      aria-label={`${label} 첨삭 정도`}
      className={cn('flex gap-1 rounded-lg border border-[#d1d5e0] bg-[#f9fafc] p-1', muted && 'opacity-50', className)}
      role="group"
    >
      {LEVELS.map((level) => (
        <button
          aria-pressed={value === level}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-[9px] transition-colors duration-150',
            value === level ? 'bg-[#4f5fd2] font-bold text-white' : 'font-medium text-[#1c2130] hover:bg-[#eef0f6]',
          )}
          key={level}
          onClick={() => onChange(level)}
          title={LEVEL_DESCRIPTIONS[level]}
          type="button"
        >
          {level}
        </button>
      ))}
    </div>
  )
}
