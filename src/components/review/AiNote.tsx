import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { movedEnough, usePointerDrag } from '../../hooks/usePointerDrag'
import { useAppStore } from '../../stores/useAppStore'
import { useReviewStore } from '../../stores/useReviewStore'
import type { AiFeedback } from '../../types/review'
import { aiNoteAnchor as noteAnchor, clampAiNotePosition, placeAiNote, placeAiNoteAbove, type Point, type Rect, type Size } from '../../utils/annotation'
import { cn } from '../../utils/cn'
import { getRect, useCanvasRefs } from './canvasRefs'

type DragState = { dx: number; dy: number; x: number; y: number; moved: boolean }

/** AI 추천 문장. 위치가 확실하면 표시 바로 위에, 불확실하면 사진 옆에 둔다. 교사가 끌어서 옮길 수 있다. */
export function AiNote({ item, dismissed, layout, autoPosition, onMeasure }: {
  item: AiFeedback
  dismissed: boolean
  layout: { board: Rect; photo: Rect; zoom: number }
  /** 다른 노트와 겹치지 않게 캔버스에서 계산한 글자 위 자리. 없으면 혼자 계산한다. */
  autoPosition?: Point
  /** 확대 전 노트 크기를 알려 겹침 계산에 쓰게 한다. */
  onMeasure?: (id: string, size: Size) => void
}) {
  const { photoRef, boardRef } = useCanvasRefs()
  const selectFeedback = useReviewStore((state) => state.selectFeedback)
  const moveAiNote = useReviewStore((state) => state.moveAiNote)
  const active = useReviewStore((state) => state.activeFeedbackId === item.id)
  const showToast = useAppStore((state) => state.showToast)
  const suppressClick = useRef(false)
  const noteRef = useRef<HTMLDivElement>(null)
  const [noteSize, setNoteSize] = useState<Size | null>(null)

  useLayoutEffect(() => {
    const note = noteRef.current
    if (!note) return
    const observer = new ResizeObserver(() => {
      const size = { width: note.offsetWidth, height: note.offsetHeight }
      setNoteSize(size)
      onMeasure?.(item.id, size)
    })
    observer.observe(note)
    return () => observer.disconnect()
  }, [item.id, onMeasure])

  const { dragging, handlers } = usePointerDrag<DragState>({
    start: (event) => {
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      return { dx: event.clientX - rect.left, dy: event.clientY - rect.top, x: event.clientX, y: event.clientY, moved: false }
    },
    move: (event, state) => {
      const photo = getRect(photoRef)
      const board = getRect(boardRef)
      const note = event.currentTarget.getBoundingClientRect()
      if (movedEnough(state.x, state.y, event)) state.moved = true
      const position = clampAiNotePosition(
        { x: event.clientX - state.dx, y: event.clientY - state.dy },
        { x: photo.left, y: photo.top, width: photo.width, height: photo.height },
        { x: board.left, y: board.top, width: board.width, height: board.height },
        note,
      )
      moveAiNote(item.id, {
        left: ((position.x - photo.left) / photo.width) * 100,
        top: ((position.y - photo.top) / photo.height) * 100,
      })
    },
    end: (state) => {
      suppressClick.current = state.moved
      if (state.moved) showToast('AI 첨삭 위치를 옮겼어요')
    },
  })

  const { board, photo, zoom } = layout
  // 위치가 확실한 첨삭은 글자 바로 위에, 불확실하면 손글씨를 가리지 않게 사진 옆에 둔다.
  const onText = !item.locationUncertain
  // 문장도 이미지와 함께 확대되므로 실제 화면에 표시되는 크기로 경계를 계산한다.
  const renderedSize = { width: (noteSize?.width ?? 0) * zoom, height: (noteSize?.height ?? 0) * zoom }
  const position = item.notePosition
    ? clampAiNotePosition({
        x: photo.x + (item.notePosition.left / 100) * photo.width,
        y: photo.y + (item.notePosition.top / 100) * photo.height,
      }, photo, board, renderedSize)
    : onText && item.mark
      ? autoPosition ?? placeAiNoteAbove(photo, renderedSize, noteAnchor(item) === 'end' ? (item.extraMarks.at(-1) ?? item.mark) : item.mark, noteAnchor(item))
      : placeAiNote(photo, board, renderedSize, item.notePlacement.side, item.notePlacement.top)
  const scale = item.noteScale ?? 1
  const style: CSSProperties & { '--note-scale': number } = {
    '--note-scale': scale,
    left: `${((position.x - photo.x) / photo.width) * 100}%`,
    top: `${((position.y - photo.y) / photo.height) * 100}%`,
    maxWidth: Math.max(0, board.width - 16) / zoom,
    maxHeight: Math.max(0, board.height - 16) / zoom,
    visibility: noteSize ? 'visible' : 'hidden',
  }

  const select = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    selectFeedback(item.id)
  }

  // 글자 크기 조절 버튼을 안에 넣어야 해서 button 대신 role="button"인 div를 쓴다.
  return (
    <div
      aria-label={`AI 코멘트: ${item.noteText}`}
      className={cn(
        'absolute z-[8] cursor-pointer touch-none overflow-visible text-left font-hand select-none',
        onText
          ? 'w-max max-w-[calc(136px*var(--note-scale))] px-[3px] py-0 sm:max-lg:max-w-[calc(106px*var(--note-scale))] max-sm:max-w-[calc(78px*var(--note-scale))]'
          : 'w-[calc(136px*var(--note-scale))] px-[5px] py-0.5 sm:max-lg:w-[calc(106px*var(--note-scale))] max-sm:w-[calc(78px*var(--note-scale))]',
        active && 'z-[11]',
        item.kind === 'correction' ? 'text-correction-ink' : 'text-improvement-ink',
        dragging && 'cursor-grabbing opacity-82',
        dismissed && 'hidden',
      )}
      onClick={(event) => {
        event.stopPropagation()
        select()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        selectFeedback(item.id)
      }}
      ref={noteRef}
      role="button"
      style={style}
      tabIndex={0}
      {...handlers}
    >
      <p className="m-0 text-[length:calc(13px*var(--note-scale))] leading-[1.28] font-semibold tracking-[0.1px] break-words whitespace-pre-line [text-shadow:0_0.35px_0_rgba(18,69,132,0.32)] sm:max-lg:text-[length:calc(11px*var(--note-scale))] max-sm:text-[length:calc(8px*var(--note-scale))]">
        {item.noteText}
      </p>
    </div>
  )
}
