import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../apis/errors'
import { GenerationFailedError, fetchUploadedWorksheet, reviewService, type GenerationProgress } from '../apis/reviewService'
import { GenerationStep } from '../components/review-flow/GenerationStep'
import { UploadStep } from '../components/review-flow/UploadStep'
import { WorkflowHeader } from '../components/review-flow/WorkflowHeader'
import { ReviewStep } from '../components/review/ReviewStep'
import { useAppStore, type UploadedFile } from '../stores/useAppStore'
import { useReviewStore } from '../stores/useReviewStore'
import type { FeedbackSetting, ReviewData } from '../types/review'

export function ReviewPage() {
  const step = useAppStore((state) => state.step)
  const setStep = useAppStore((state) => state.setStep)
  const showToast = useAppStore((state) => state.showToast)
  const markWorksheetReady = useAppStore((state) => state.markWorksheetReady)
  const startReview = useReviewStore((state) => state.startReview)
  const activeReviewId = useReviewStore((state) => state.activeUploadId)
  // 화면을 벗어나면 진행 중인 생성 확인(폴링)을 멈춘다.
  const generation = useRef<AbortController | null>(null)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)

  useEffect(() => () => generation.current?.abort(), [])

  // 새로고침으로 주소(/review/{id})에서 다시 열 때: 학습지를 불러와 결과를 열거나, 생성 중이면 이어서 기다린다.
  const resumeWorksheetId = useAppStore((state) => state.resumeWorksheetId)
  const resumeRef = useRef<(worksheetId: number, signal: AbortSignal) => Promise<void>>(null)
  resumeRef.current = async (worksheetId, signal) => {
    try {
      const file = await fetchUploadedWorksheet(worksheetId, signal)
      if (signal.aborted) return
      const uploadId = useAppStore.getState().receiveWorksheet(file)
      const { status } = file.worksheet
      if (status === 'READY') {
        // 이미 끝난 첨삭은 생성 화면을 거치지 않고 결과만 불러와 바로 검토 화면을 연다.
        const review = await reviewService.generateReview({
          worksheet: file.worksheet,
          settings: useAppStore.getState().sessionSettings,
          signal,
        })
        if (signal.aborted) return
        startReview(uploadId, review)
        useAppStore.getState().selectUpload(uploadId)
        useAppStore.getState().finishResume()
        setStep('review')
        return
      }
      useAppStore.getState().finishResume()
      if (status === 'PROCESSING') {
        // 생성 중이었다면 생성 화면에서 이어서 기다린다.
        await runGeneration(useAppStore.getState().sessionSettings, uploadId)
      } else {
        // 아직 생성하지 않았거나 실패한 학습지는 업로드 화면에서 다시 시작한다.
        setStep('upload')
      }
    } catch (error) {
      if (signal.aborted) return
      useAppStore.getState().finishResume()
      showToast(getErrorMessage(error, '학습지를 다시 불러오지 못했어요. 새 첨삭을 시작해주세요.'))
      setStep('upload')
    }
  }

  useEffect(() => {
    if (resumeWorksheetId === null) return
    const controller = new AbortController()
    void resumeRef.current?.(resumeWorksheetId, controller.signal)
    return () => controller.abort()
  }, [resumeWorksheetId])

  const runGeneration = async (settings: FeedbackSetting[], uploadId?: string) => {
    const { uploads, activeUploadId, uploading } = useAppStore.getState()
    const upload = uploads.find((file) => file.id === (uploadId ?? activeUploadId))
    if (!upload || uploading || useReviewStore.getState().pendingMutations) return
    // 이미 검토한 파일은 화면에서 수정한 내용까지 복원한다.
    if (useReviewStore.getState().selectReview(upload.id)) {
      useAppStore.getState().selectUpload(upload.id)
      setStep('review')
      return
    }
    // 업로드 때 이미 분석이 끝났다면 생성 화면이나 추가 API 요청 없이 바로 연다.
    if (upload.worksheet.completedReview) {
      startReview(upload.id, upload.worksheet.completedReview)
      useAppStore.getState().selectUpload(upload.id)
      setStep('review')
      return
    }
    if (!settings.some((setting) => setting.selected)) {
      showToast('첨삭 영역을 한 가지 이상 선택해주세요')
      return
    }
    await generate(upload, (signal, onProgress) => reviewService.generateReview({ worksheet: upload.worksheet, settings, signal, onProgress }))
  }

  /** 생성 화면을 띄우고 결과가 나오면 검토 화면으로 넘어간다. 재시도할 수 있는 실패면 토스트에 버튼을 단다. */
  const generate = async (upload: UploadedFile, request: (signal: AbortSignal, onProgress: (progress: GenerationProgress) => void) => Promise<ReviewData>) => {
    generation.current?.abort()
    const controller = new AbortController()
    generation.current = controller
    const previousStep = useAppStore.getState().step
    setGenerationProgress(null)
    setStep('generation')
    try {
      const review = await request(controller.signal, (progress) => {
        if (!controller.signal.aborted && generation.current === controller && useAppStore.getState().step === 'generation') {
          setGenerationProgress(progress)
        }
      })
      if (controller.signal.aborted || useAppStore.getState().step !== 'generation') return
      markWorksheetReady(upload.id)
      startReview(upload.id, review)
      useAppStore.getState().selectUpload(upload.id)
      setStep('review')
    } catch (error) {
      if (controller.signal.aborted) return
      const retry = error instanceof GenerationFailedError && error.retryable
        ? {
            label: '다시 시도',
            onClick: () => void generate(upload, (signal, onProgress) =>
              reviewService.retryReview({ worksheet: upload.worksheet, generationId: error.generationId, signal, onProgress })),
          }
        : undefined
      showToast(getErrorMessage(error, '첨삭을 생성하지 못했어요. 잠시 후 다시 시도해주세요.'), retry)
      setStep(previousStep === 'review' ? 'review' : 'upload')
    }
  }

  return (
    <section className="mx-auto max-w-[1500px] animate-fade-page px-[42px] pt-9 pb-6 max-sm:px-[14px] max-sm:py-[25px]">
      <WorkflowHeader step={step} />
      {resumeWorksheetId !== null && (
        <div className="grid min-h-[360px] place-items-center text-[10px] text-[#8a8fa0]">첨삭 결과를 불러오고 있어요…</div>
      )}
      {resumeWorksheetId === null && step === 'upload' && <UploadStep onStart={() => void runGeneration(useAppStore.getState().sessionSettings)} />}
      {resumeWorksheetId === null && step === 'generation' && <GenerationStep generation={generationProgress} />}
      {resumeWorksheetId === null && step === 'review' && (
        <ReviewStep
          key={activeReviewId}
          onSelectFile={(uploadId) => void runGeneration(useAppStore.getState().sessionSettings, uploadId)}
        />
      )}
    </section>
  )
}
