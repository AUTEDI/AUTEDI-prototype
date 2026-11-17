import { useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useReviewStore } from '../../stores/useReviewStore'
import { cn } from '../../utils/cn'
import { CanvasBoard } from './CanvasBoard'
import { CanvasRefsContext } from './canvasRefs'
import { CompleteModal } from './CompleteModal'
import { FeedbackPanel } from './FeedbackPanel'
import { PageRail } from './PageRail'
import { StudioTitlebar } from './StudioTitlebar'
import { StudioToolbar } from './StudioToolbar'

export function ReviewStep({ onSelectFile }: { onSelectFile: (uploadId: string) => void }) {
  const photoRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [canvasRefs] = useState(() => ({ photoRef, boardRef }))
  const panelOpen = useReviewStore((state) => state.panelOpen)
  const showToast = useAppStore((state) => state.showToast)
  const [completeOpen, setCompleteOpen] = useState(false)

  // shortcut: 브라우저 인쇄의 "PDF로 저장"을 쓴다. 버튼 한 번에 파일이 바로 받아져야 하면 jsPDF 등으로 바꾼다.
  const exportPdf = () => {
    const board = boardRef.current
    if (!board) return
    const { width, height } = board.getBoundingClientRect()
    // 인쇄 때 레이아웃이 다시 계산되면 px로 놓인 코멘트가 어긋나므로, 화면 크기를 고정한 채 A4 가로(여백 8mm)에 맞춰 줄인다.
    board.style.width = `${width}px`
    board.style.height = `${height}px`
    board.style.setProperty('--print-scale', String(Math.min(1, 1060 / width, 730 / height)))
    window.addEventListener(
      'afterprint',
      () => {
        board.style.removeProperty('width')
        board.style.removeProperty('height')
        setCompleteOpen(true)
      },
      { once: true },
    )
    window.print()
  }

  return (
    <CanvasRefsContext value={canvasRefs}>
      <div className="animate-fade-step">
        <StudioTitlebar onFinish={exportPdf}onSave={() => showToast('현재 첨삭 내용을 저장했어요')} />
        <div
          className={cn(
            'grid h-[calc(100vh-220px)] min-h-[650px] overflow-hidden rounded-[15px] border border-[#d9ddeb] bg-white shadow-[0_18px_48px_rgba(27,35,85,0.09)] max-sm:block max-sm:h-auto max-sm:min-h-0',
            panelOpen
              ? 'grid-cols-[88px_minmax(620px,1fr)_320px] max-lg:grid-cols-[70px_minmax(520px,1fr)_280px]'
              : 'grid-cols-[88px_minmax(620px,1fr)] max-lg:grid-cols-[70px_minmax(520px,1fr)]',
          )}
        >
          <PageRail onSelect={onSelectFile} />
          <section className="grid min-w-0 grid-rows-[48px_1fr] max-sm:h-[740px]">
            <StudioToolbar />
            <CanvasBoard />
          </section>
          <FeedbackPanel />
        </div>
      </div>
      {completeOpen && <CompleteModal onClose={() => setCompleteOpen(false)} />}
    </CanvasRefsContext>
  )
}
