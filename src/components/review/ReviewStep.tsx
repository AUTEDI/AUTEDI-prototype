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

  // 학습지 사진과 그 위·옆의 첨삭만 잘라 PDF 파일로 내려받는다.
  const exportPdf = async () => {
    const board = boardRef.current
    const photo = photoRef.current
    if (!board || !photo) return
    try {
      const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
      const boardRect = board.getBoundingClientRect()
      // 사진, 사진 안의 표시·AI 노트, 교사 코멘트 레이어를 모두 감싸는 영역
      const parts = [photo, ...photo.querySelectorAll('*'), ...board.querySelectorAll('[aria-live] *')]
        .filter((el) => !el.closest('[data-pdf-hide]'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
      const PAD = 12
      const left = Math.max(0, Math.min(...parts.map((r) => r.left)) - boardRect.left - PAD)
      const top = Math.max(0, Math.min(...parts.map((r) => r.top)) - boardRect.top - PAD)
      const right = Math.min(boardRect.width, Math.max(...parts.map((r) => r.right)) - boardRect.left + PAD)
      const bottom = Math.min(boardRect.height, Math.max(...parts.map((r) => r.bottom)) - boardRect.top + PAD)
      const width = right - left
      const height = bottom - top

      const RATIO = 2
      const full = await toCanvas(board, {
        pixelRatio: RATIO,
        style: { backgroundImage: 'none', backgroundColor: '#ffffff' },
        filter: (node) => !(node instanceof HTMLElement && 'pdfHide' in node.dataset),
      })
      const cropped = document.createElement('canvas')
      cropped.width = width * RATIO
      cropped.height = height * RATIO
      cropped.getContext('2d')!.drawImage(full, left * RATIO, top * RATIO, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)

      const pdf = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'px', format: [width, height] })
      pdf.addImage(cropped, 'PNG', 0, 0, width, height)
      pdf.save('autedi-첨삭.pdf')
      setCompleteOpen(true)
    } catch {
      showToast('PDF를 만들지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <CanvasRefsContext value={canvasRefs}>
      <div className="animate-fade-step">
        <StudioTitlebar onFinish={exportPdf} onSave={() => showToast('현재 첨삭 내용을 저장했어요')} />
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
