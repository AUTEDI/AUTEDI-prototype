import type { AiFeedback, AnnotationStyle, SelectionBox } from '../types/review'

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = Point & Size

const AI_NOTE_OUTSIDE_LIMIT = 200
const AI_NOTE_IMAGE_GAP = 16
const AI_NOTE_CANVAS_PADDING = 8

/** 문장 전체를 캔버스 안에 두고, 이미지 양옆으로 나가는 거리는 최대 200px로 제한한다. */
export function clampAiNotePosition(position: Point, photo: Rect, board: Rect, note: Size): Point {
  const minX = Math.max(board.x + AI_NOTE_CANVAS_PADDING, photo.x - AI_NOTE_OUTSIDE_LIMIT)
  const maxX = Math.min(
    board.x + board.width - AI_NOTE_CANVAS_PADDING - note.width,
    photo.x + photo.width + AI_NOTE_OUTSIDE_LIMIT - note.width,
  )
  const minY = board.y + AI_NOTE_CANVAS_PADDING
  const maxY = board.y + board.height - AI_NOTE_CANVAS_PADDING - note.height
  return {
    x: clamp(position.x, minX, Math.max(minX, maxX)),
    y: clamp(position.y, minY, Math.max(minY, maxY)),
  }
}

/** 첫 문장은 이미지에서 16px 떨어뜨리고, 여백이 모자라면 반대편을 먼저 확인한다. */
export function placeAiNote(photo: Rect, board: Rect, note: Size, side: 'left' | 'right', top: number): Point {
  const left = photo.x - AI_NOTE_IMAGE_GAP - note.width
  const right = photo.x + photo.width + AI_NOTE_IMAGE_GAP
  const fits = (x: number) => x >= board.x + AI_NOTE_CANVAS_PADDING
    && x >= photo.x - AI_NOTE_OUTSIDE_LIMIT
    && x + note.width <= board.x + board.width - AI_NOTE_CANVAS_PADDING
    && x + note.width <= photo.x + photo.width + AI_NOTE_OUTSIDE_LIMIT
  const preferred = side === 'left' ? left : right
  const opposite = side === 'left' ? right : left
  return clampAiNotePosition({
    x: fits(preferred) ? preferred : fits(opposite) ? opposite : preferred,
    y: photo.y + (top / 100) * photo.height,
  }, photo, board, note)
}

/** 서버 표시 박스는 글자 높이 전체를 덮으므로, 노트 아래쪽을 박스 위쪽에서 이만큼(박스 높이 비율) 내려 줄 사이에 둔다. */
const AI_NOTE_LINE_OVERLAP = 0.35
/** 노트끼리 붙지 않게 두는 간격(px) */
const AI_NOTE_GAP = 4

type NoteMark = { left: number; top: number; width: number; height?: number }
export type NoteAnchor = 'start' | 'end' | 'center'

/** 삽입은 ∧ 기호 위(앞이면 왼쪽 끝, 뒤면 오른쪽 끝), 나머지는 표시 가운데 위에 노트를 둔다. */
export function aiNoteAnchor(item: Pick<AiFeedback, 'edit'>): NoteAnchor {
  if (item.edit?.operation !== 'INSERT') return 'center'
  return item.edit.position === 'AFTER' ? 'end' : 'start'
}

/**
 * 손글씨 첨삭처럼 표시 바로 위(줄 사이)에 문장을 둔다.
 * 기준점은 삽입 앞이면 표시 왼쪽 끝, 삽입 뒤면 오른쪽 끝, 나머지는 가운데다.
 * 사진 밖으로 나가지 않게 사진 안쪽으로 맞춘다. mark는 사진 기준 퍼센트(0~100)다.
 */
export function placeAiNoteAbove(photo: Rect, note: Size, mark: NoteMark, anchor: NoteAnchor = 'center'): Point {
  const ratio = anchor === 'start' ? mark.left : anchor === 'end' ? mark.left + mark.width : mark.left + mark.width / 2
  const anchorX = photo.x + (ratio / 100) * photo.width
  const markTop = photo.y + (mark.top / 100) * photo.height
  const overlap = (((mark.height ?? 0) / 100) * photo.height) * AI_NOTE_LINE_OVERLAP
  return {
    x: clampToPhotoX(photo, note, anchorX - note.width / 2),
    y: Math.max(photo.y, markTop + overlap - note.height),
  }
}

function clampToPhotoX(photo: Rect, note: Size, x: number) {
  return clamp(x, photo.x, Math.max(photo.x, photo.x + photo.width - note.width))
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + AI_NOTE_GAP && b.x < a.x + a.width + AI_NOTE_GAP
  && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * 글자 위에 올리는 노트 여러 개를 겹치지 않게 배치한다.
 * 위에서 아래, 왼쪽에서 오른쪽 순서로 놓고, 앞서 놓은 노트와 겹치면
 * 오른쪽 → 왼쪽으로 비켜 보고, 그래도 겹치면 한 칸 위로 올린다. 다 안 되면 기본 자리에 둔다.
 */
export function layoutAiNotesAbove(
  photo: Rect,
  notes: { id: string; size: Size; mark: NoteMark; anchor: NoteAnchor }[],
): Record<string, Point> {
  const placed: Rect[] = []
  const result: Record<string, Point> = {}
  const ordered = [...notes].sort((a, b) => a.mark.top - b.mark.top || a.mark.left - b.mark.left)
  for (const note of ordered) {
    const base = placeAiNoteAbove(photo, note.size, note.mark, note.anchor)
    const rect = (point: Point): Rect => ({ ...point, ...note.size })
    const fits = (point: Point) =>
      point.x >= photo.x - 0.5 && point.x + note.size.width <= photo.x + photo.width + 0.5 && point.y >= photo.y - 0.5
      && !placed.some((other) => overlaps(rect(point), other))
    const candidates: Point[] = [base]
    const blockers = placed.filter((other) => overlaps(rect(base), other))
    for (const other of blockers) {
      candidates.push({ x: other.x + other.width + AI_NOTE_GAP, y: base.y })
      candidates.push({ x: other.x - AI_NOTE_GAP - note.size.width, y: base.y })
    }
    for (const other of blockers) {
      candidates.push({ x: base.x, y: other.y - AI_NOTE_GAP - note.size.height })
    }
    const chosen = candidates.find(fits) ?? base
    placed.push(rect(chosen))
    result[note.id] = chosen
  }
  return result
}

/** 원본 비율을 유지하면서 주어진 영역 안에 이미지 전체가 들어가는 크기를 계산한다. */
export function fitImageSize(image: Size, bounds: Size): Size | null {
  if (![image.width, image.height, bounds.width, bounds.height].every((value) => Number.isFinite(value) && value > 0)) {
    return null
  }
  const scale = Math.min(bounds.width / image.width, bounds.height / image.height)
  return { width: image.width * scale, height: image.height * scale }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 화면 좌표를 사진 기준 퍼센트(0~100) 좌표로 바꾼다. */
export function pointInRect(clientX: number, clientY: number, rect: DOMRect): Point {
  return {
    x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
  }
}

/** 드래그 시작점과 현재 점으로 표시 영역을 만든다. 표시 종류마다 최소 크기가 다르다. */
export function selectionFromPoints(start: Point, end: Point, style: AnnotationStyle): SelectionBox {
  const horizontal = style === 'arrow'
  const minWidth = ['arrow', 'box', 'caret'].includes(style) ? 4 : 1
  const minHeight = style === 'underline' ? 1 : ['box', 'caret'].includes(style) ? 3 : 1.8
  return {
    left: Math.min(start.x, end.x),
    top: horizontal ? start.y : Math.min(start.y, end.y),
    width: Math.max(minWidth, Math.abs(end.x - start.x)),
    height: horizontal ? 1.4 : Math.max(minHeight, Math.abs(end.y - start.y)),
    reverse: horizontal && end.x < start.x,
  }
}

/**
 * 교사 코멘트를 사진 옆 여백에 배치한다.
 * 오른쪽 여백이 부족하면 왼쪽에 두고, 이미 있는 코멘트와 겹치면 아래로 내린다.
 */
export function placeTeacherNote({
  board,
  photo,
  selection,
  occupiedTops,
}: {
  board: DOMRect
  photo: DOMRect
  selection: { top: number }
  occupiedTops: number[]
}) {
  const sideSpace = Math.max(52, photo.left - board.left - 10)
  const width = board.width < 500 ? Math.min(76, sideSpace) : Math.min(190, Math.max(118, board.width * 0.22))
  let left = photo.right - board.left + 8
  if (left + width > board.width - 6) left = Math.max(4, photo.left - board.left - width - 6)
  let top = Math.max(6, Math.min(board.height - 82, selection.top - board.top - 6))
  while (occupiedTops.some((y) => Math.abs(y - top) < 58) && top < board.height - 94) top += 62
  return { left, top, width }
}
