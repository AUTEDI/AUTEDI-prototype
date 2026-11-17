import type { CSSProperties } from 'react'
import { movedEnough, usePointerDrag } from '../../hooks/usePointerDrag'
import { useAppStore } from '../../stores/useAppStore'
import { useReviewStore } from '../../stores/useReviewStore'
import type { TeacherComment } from '../../types/review'
import { cn } from '../../utils/cn'
import { noteInkClass } from './annotationStyles'
import { getRect, useCanvasRefs } from './canvasRefs'

/** 사진 옆 여백에 손글씨로 적힌 교사 코멘트 */
export function TeacherNote({
  comment,
  note,
  selected,
}: {
  comment: TeacherComment
  note: NonNullable<TeacherComment['note']>
  selected: boolean
}) {
  const { boardRef } = useCanvasRefs()
  const moveTeacherNote = useReviewStore((state) => state.moveTeacherNote)
  const selectTeacherComment = useReviewStore((state) => state.selectTeacherComment)
  const scale = comment.noteScale ?? 1
  const showToast = useAppStore((state) => state.showToast)

  const { dragging, handlers } = usePointerDrag<{ dx: number; dy: number; x: number; y: number; moved: boolean }>({
    start: (event) => {
      event.preventDefault()
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      return { dx: event.clientX - rect.left, dy: event.clientY - rect.top, x: event.clientX, y: event.clientY, moved: false }
    },
    move: (event, state) => {
      if (movedEnough(state.x, state.y, event)) state.moved = true
      const board = getRect(boardRef)
      const rect = event.currentTarget.getBoundingClientRect()
      moveTeacherNote(comment.id, {
        left: Math.max(6, Math.min(board.width - rect.width - 6, event.clientX - board.left - state.dx)),
        top: Math.max(6, Math.min(board.height - rect.height - 6, event.clientY - board.top - state.dy)),
      })
    },
    // 움직이지 않고 눌렀다 떼면 선택해서 글자 크기 조절 버튼을 보여준다.
    end: (state) => {
      if (state.moved) showToast('교사 코멘트 위치를 옮겼어요')
      else selectTeacherComment(comment.id)
    },
  })

  return (
    <article
      className={cn(
        'pointer-events-auto absolute z-[8] block cursor-pointer touch-none px-2 py-[3px] font-hand select-none',
        selected && 'z-[11] rounded-[3px] outline-1 outline-offset-1 outline-[#a58be6]/70 outline-dashed',
        selected
          ? 'text-[#5b35b8] drop-shadow-[0_2px_0_rgba(91,53,184,0.16)]'
          : noteInkClass(comment.color),
        dragging && 'cursor-grabbing opacity-88',
      )}
      data-teacher-note={comment.id}
      style={{ left: note.left, top: note.top, width: note.width * scale, '--note-scale': scale } as CSSProperties}
      {...handlers}
    >
      <p className="m-0 text-[length:calc(14px*var(--note-scale))] leading-[1.35] font-semibold tracking-[0.15px] break-words [text-shadow:0_0.4px_0_rgba(23,77,145,0.28)]">
        {comment.text}
      </p>
    </article>
  )
}
