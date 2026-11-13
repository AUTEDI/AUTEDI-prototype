import type { FeedbackSetting } from '../../types/review'
import { cn } from '../../utils/cn'
import { LevelToggle } from './LevelToggle'

type SettingCardProps = {
  setting: FeedbackSetting
  compact?: boolean
  onChange: (setting: FeedbackSetting) => void
}

export function SettingCard({ setting, compact = false, onChange }: SettingCardProps) {
  return (
    <article
      className={cn(
        'rounded-[14px] border-[1.5px] bg-white transition duration-200',
        compact ? 'p-[13px]' : 'p-4',
        setting.selected
          ? 'border-[#7d86e8] shadow-[0_8px_24px_rgba(65,78,172,0.08)]'
          : 'border-line opacity-55 shadow-card',
      )}
    >
      <div className="flex items-center gap-[10px]">
        <button
          aria-label={`${setting.name} 선택`}
          aria-pressed={setting.selected}
          className={cn(
            'size-[21px] shrink-0 rounded-md border text-white',
            setting.selected ? 'border-[#6270e3] bg-[#6270e3]' : 'border-[#cfd2df] bg-white',
          )}
          onClick={() => onChange({ ...setting, selected: !setting.selected })}
          type="button"
        >
          {setting.selected ? '✓' : ''}
        </button>
        <span className="grid size-[37px] shrink-0 place-items-center rounded-[10px] bg-[#eeefff] font-serif text-[12px] font-bold text-[#5965d5]">
          {setting.icon}
        </span>
        <div>
          <h3 className="mb-[3px] text-[12px]">{setting.name}</h3>
          <small className="text-[7px] text-[#9499aa]">{setting.en}</small>
        </div>
      </div>
      <p className="my-3 text-[8px] leading-normal text-[#7f8496]">{setting.desc}</p>
      <LevelToggle
        label={setting.name}
        onChange={(level) => onChange({ ...setting, selected: true, level })}
        value={setting.level}
      />
    </article>
  )
}
