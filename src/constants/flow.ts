import type { FlowStep } from '../types/review'

export const FLOW_META: Record<FlowStep, { title: string; subtitle: string; step: number }> = {
  upload: {
    title: '학생의 학습지를 올려주세요',
    subtitle: '글이 적힌 실제 사진이나 스캔 파일을 업로드하세요. 원본 이미지는 수정되지 않아요.',
    step: 1,
  },
  generation: {
    title: 'AI 첨삭을 생성하고 있어요',
    subtitle: '사진 속 글의 위치를 분석해 원본 위에 별도 첨삭 레이어를 만들어요.',
    step: 2,
  },
  review: {
    title: '사진 위 첨삭 결과를 확인해주세요',
    subtitle: '원본 사진 위 표시를 선택하면 오른쪽에서 수정하거나 삭제할 수 있어요.',
    step: 3,
  },
}

/** 단계 표시 아래에 붙는 이름 */
export const FLOW_STEP_LABELS = ['파일 업로드', 'AI 첨삭 생성', '첨삭 검토']

export const FLOW_STEP_COUNT = FLOW_STEP_LABELS.length
