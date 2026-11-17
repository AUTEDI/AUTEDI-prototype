import { useRef, useState } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useReviewStore } from '../../stores/useReviewStore'
import { captureWorksheet } from '../../utils/captureWorksheet'
import { cn } from '../../utils/cn'
import { printWorksheet } from '../../utils/printWorksheet'
import { CanvasBoard } from './CanvasBoard'
import { CanvasRefsContext } from './canvasRefs'
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
  const [printing, setPrinting] = useState(false)

  // 학습지 사진 안쪽만 인쇄하고, 용지 비율과 방향은 사진 크기를 기준으로 정한다.
  const printReview = async () => {
    const board = boardRef.current
    const photo = photoRef.current
    if (!board || !photo || printing) return
    setPrinting(true)
    try {
      const { canvas, size } = await captureWorksheet(board, photo)
      await printWorksheet(canvas, size)
    } catch {
      showToast('인쇄를 준비하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <CanvasRefsContext value={canvasRefs}>
      <div className="animate-fade-step">
        <StudioTitlebar onFinish={printReview} printing={printing} onSave={() => showToast('현재 첨삭 내용을 저장했어요')} />
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
    </CanvasRefsContext>
  )
}
