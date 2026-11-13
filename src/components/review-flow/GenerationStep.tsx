import type { GenerationProgress } from '../../apis/reviewService'
import { cn } from '../../utils/cn'

const STAGES = ['이미지 인식', 'AI 첨삭 생성', '완료']

function SymbolVisual() {
  return (
    <div aria-hidden="true" className="relative grid h-[210px] place-items-center">
      <div className="absolute bottom-[27px] h-2 w-20 rounded-full bg-[#4c6be0]/15 blur-sm" />
      <img
        alt=""
        className="relative size-[128px] select-none object-contain motion-safe:animate-bounce"
        draggable={false}
        src={`${import.meta.env.BASE_URL}assets/Symbol.svg`}
      />
    </div>
  )
}

export function GenerationStep({ generation }: { generation: GenerationProgress | null }) {
  const succeeded = generation?.status === 'SUCCEEDED'
  const running = generation?.status === 'RUNNING'
  // COMPLETED 단계여도 최종 status가 SUCCEEDED일 때만 전체 완료로 표시한다.
  const stageIndex = succeeded ? STAGES.length : running
    ? ({ OCR: 0, AI_CORRECTION: 1, COMPLETED: 2, QUEUED: -1 }[generation.stage] ?? -1)
    : -1
  const title = succeeded ? 'AI 첨삭이 완료됐어요'
    : stageIndex === 0 ? '사진 속 글자를 읽고 있어요'
    : stageIndex === 1 ? 'AI 첨삭을 생성하고 있어요'
    : generation?.status === 'FAILED' ? '첨삭 생성을 완료하지 못했어요'
    : '첨삭 생성 상태를 확인하고 있어요'
  const copy = succeeded ? '완료된 첨삭 결과를 불러오고 있어요.'
    : stageIndex === 0 ? '사진 속 글자와 위치를 인식하고 있어요.'
    : stageIndex === 1 ? '선택한 영역과 수준에 맞춰 문법과 표현을 분석하고 있어요.'
    : stageIndex === 2 ? '생성 작업의 최종 완료 상태를 확인하고 있어요.'
    : generation?.status === 'FAILED' ? '생성에 실패했어요. 안내 메시지를 확인해주세요.'
    : generation?.status === 'PENDING' ? '생성 작업이 시작되기를 기다리고 있어요.'
    : '첨삭 설정과 생성 상태를 확인하고 있어요.'

  return (
    <div className="animate-fade-step pt-[5px] text-center">
      <SymbolVisual />
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2 className="my-[9px] text-[25px] tracking-[-1px]">{title}</h2>
        <p className="my-[10px] text-[10px] text-[#7d8294]">{copy}</p>
      </div>
      <ol aria-label="첨삭 생성 단계" className="mx-auto mt-[23px] mb-[14px] grid w-[370px] max-w-[85vw] list-none grid-cols-3 gap-3 p-0">
        {STAGES.map((label, index) => {
          const done = index < stageIndex
          const current = index === stageIndex
          return (
            <li aria-current={current ? 'step' : undefined} key={label}>
              <div aria-hidden="true" className={cn('mb-[14px] h-[5px] rounded-[10px]', done ? 'bg-[#5363d6]' : current ? 'animate-pulse bg-[#8994ed]' : 'bg-[#e1e4ef]')} />
              <span className={cn('text-[8px]', done || current ? 'text-[#5363d6]' : 'text-[#999eae]')}>
                <span aria-hidden="true">{done ? '✓' : current ? '●' : '○'} </span>{label}
                <span className="sr-only"> {done ? '완료' : current ? '진행 중' : '대기'}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <small className="mt-[18px] block text-[7px] text-[#a0a4b2]">원본 사진의 픽셀은 변경하지 않아요.</small>
    </div>
  )
}
