import { useRef, type CSSProperties, type MouseEvent } from 'react'
import { BASE_SETTINGS } from '../../constants/settings'
import { movedEnough, usePointerDrag } from '../../hooks/usePointerDrag'
import { useReviewStore } from '../../stores/useReviewStore'
import type { AiFeedback, Box } from '../../types/review'
import { clamp } from '../../utils/annotation'
import { cn } from '../../utils/cn'
import { getRect, useCanvasRefs } from './canvasRefs'
import { ResizeHandle } from './ResizeHandle'

type Tone = 'correction' | 'improvement' | 'applied'

const BORDER: Record<Tone, string> = {
  correction: 'border-correction',
  improvement: 'border-improvement',
  applied: 'border-applied',
}
const TEXT: Record<Tone, string> = {
  correction: 'text-correction',
  improvement: 'text-improvement',
  applied: 'text-applied',
}

/** 반영한 첨삭은 선택하지 않았을 때 초록색이 된다. */
function toneOf(item: AiFeedback, active: boolean, applied: boolean): Tone {
  if (applied && !active) return 'applied'
  return item.kind === 'correction' ? 'correction' : 'improvement'
}

const boxStyle = (box: Box): CSSProperties => ({
  left: `${box.left}%`,
  top: `${box.top}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
})

/**
 * 한 줄 안의 표시 모양. 수정 동작에 따라 다르게 그린다.
 * - 삭제: 가운데 취소선
 * - 삽입: 앞(BEFORE)·뒤(AFTER) 끝에 ∧ 기호
 * - 교체·재구성·동작 없음: 밑줄
 * 위치가 불확실한 첨삭은 점선으로 그린다.
 */
function MarkStroke({ item, tone, active, line }: { item: AiFeedback; tone: Tone; active: boolean; line: number }) {
  const operation = item.edit?.operation
  const dashed = item.locationUncertain
  const thickness = active ? 'border-b-3' : 'border-b-2'

  if (operation === 'DELETE') {
    return (
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-b', BORDER[tone], thickness, dashed && 'border-dashed')}
      />
    )
  }
  // 삽입 기호는 여러 줄이면 앞은 첫 줄, 뒤는 마지막 줄에만 그린다(나머지 줄은 line이 -1).
  if (operation === 'INSERT') {
    if (line < 0) return null
    const after = item.edit?.position === 'AFTER'
    return (
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -bottom-[0.55em] font-hand text-[14px] leading-none font-bold select-none',
          TEXT[tone],
          after ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
        )}
      >
        ∧
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-x-0 bottom-0 border-b', BORDER[tone], thickness, dashed && 'border-dashed')}
    />
  )
}

type AiMarkProps = {
  item: AiFeedback
  active: boolean
  applied: boolean
  dismissed: boolean
  mark: Box
}

/**
 * 사진 위 AI 첨삭 표시. 한 줄 첨삭은 끌어서 옮기고 모서리로 크기를 바꾼다.
 * 여러 줄 첨삭은 줄마다 표시하고, 한 줄만 옮기면 나머지 줄과 어긋나므로 위치를 고정한다.
 */
export function AiMark({ item, mark, active, applied, dismissed }: AiMarkProps) {
  const { photoRef } = useCanvasRefs()
  const selectFeedback = useReviewStore((state) => state.selectFeedback)
  const moveAiMark = useReviewStore((state) => state.moveAiMark)
  const saveAiMark = useReviewStore((state) => state.saveAiMark)
  // 드래그나 크기 조절 직후의 클릭은 선택으로 보지 않는다.
  const suppressClick = useRef(false)
  const multiLine = item.extraMarks.length > 0
  const tone = toneOf(item, active, applied)
  const lines = [mark, ...item.extraMarks]
  const insertAfter = item.edit?.operation === 'INSERT' && item.edit.position === 'AFTER'
  // 삽입 기호를 그릴 줄: 앞에 넣으면 첫 줄, 뒤에 넣으면 마지막 줄
  const insertLine = insertAfter ? lines.length - 1 : 0

  const { dragging, handlers } = usePointerDrag<{ x: number; y: number; box: Box; moved: boolean }>({
    start: (event) => {
      event.preventDefault()
      event.stopPropagation()
      return { x: event.clientX, y: event.clientY, box: mark, moved: false }
    },
    move: (event, state) => {
      const photo = getRect(photoRef)
      if (movedEnough(state.x, state.y, event)) state.moved = true
      moveAiMark(item.id, {
        ...state.box,
        left: clamp(state.box.left + ((event.clientX - state.x) / photo.width) * 100, 0, 100 - state.box.width),
        top: clamp(state.box.top + ((event.clientY - state.y) / photo.height) * 100, 0, 100 - state.box.height),
      })
    },
    end: (state) => {
      suppressClick.current = state.moved
      if (state.moved) void saveAiMark(item.id, 'AI 표시 위치를 옮겼어요')
    },
  })

  const settingName = BASE_SETTINGS.find((setting) => setting.en === item.category)?.name ?? item.category
  const label = `${settingName} ${item.kind === 'correction' ? '오류 수정' : '개선 제안'}`

  const select = (event: MouseEvent) => {
    event.stopPropagation()
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    selectFeedback(item.id)
  }

  return (
    <>
      <button
        aria-label={multiLine ? `${label} (1/${lines.length}줄)` : label}
        className={cn(
          'absolute z-[6] block touch-none bg-transparent p-0',
          multiLine ? 'cursor-pointer' : dragging && 'cursor-grabbing opacity-82',
          dismissed && 'hidden',
        )}
        onClick={select}
        style={boxStyle(mark)}
        type="button"
        {...(multiLine ? {} : handlers)}
      >
        <MarkStroke active={active} item={item} line={insertLine === 0 ? 0 : -1} tone={tone} />
        {!multiLine && (
          <ResizeHandle
            box={mark}
            lockHeight
            onResize={(box) => moveAiMark(item.id, box)}
            onResizeEnd={() => {
              suppressClick.current = true
              void saveAiMark(item.id, 'AI 표시의 크기와 길이를 조정했어요')
            }}
            tone="ai"
            visible={active}
          />
        )}
      </button>
      {item.extraMarks.map((box, index) => (
        <button
          aria-label={`${label} (${index + 2}/${lines.length}줄)`}
          className={cn('absolute z-[6] block cursor-pointer bg-transparent p-0', dismissed && 'hidden')}
          key={index}
          onClick={select}
          style={boxStyle(box)}
          type="button"
        >
          <MarkStroke active={active} item={item} line={insertLine === index + 1 ? index + 1 : -1} tone={tone} />
        </button>
      ))}
    </>
  )
}
