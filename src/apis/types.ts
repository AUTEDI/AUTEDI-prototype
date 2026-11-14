/** 백엔드 API 명세서 v1의 요청·응답 타입 */

/** 학습지·첨삭 API의 공통 응답 포장 */
export type ApiEnvelope<T> = {
  isSuccess: boolean
  code: string
  message: string
  result: T
  error: unknown
}

export type AreaCode = 'GRAMMAR_SPELLING' | 'GRAMMAR_MECHANICS' | 'VOCABULARY_EXPRESSION' | 'SENTENCE_STRUCTURE' | 'CONTENT_SUMMARY'
export type LevelCode = 'STANDARD' | 'ADVANCED'

export type AreaSetting = { area: AreaCode; level: LevelCode }

/** 학습지 상태: 업로드 직후 DRAFT, 생성 중 PROCESSING, 완료 READY, 실패 FAILED */
export type WorksheetStatus = 'DRAFT' | 'PROCESSING' | 'READY' | 'FAILED'

/** 페이지 이미지 기준 0~1 좌표 */
export type RegionDto = {
  /** 단일 페이지 응답에서는 생략될 수 있다. */
  pageId?: number | null
  x: number
  y: number
  width: number
  height: number
  polygon?: unknown
}

export type WorksheetPageDto = {
  id: number
  pageNumber: number
  width: number
  height: number
  imageUrl: string
  urlExpiresAt: string | null
}

export type WorksheetDto = {
  id: number
  etag: string
  status: WorksheetStatus
  file: {
    name: string
    mediaType: string
    sizeBytes: number
    originalUrl: string
    urlExpiresAt: string | null
  }
  pages: WorksheetPageDto[]
  settings: { etag: string; areas: AreaSetting[] }
  latestGenerationId: number | null
  createdAt: string
  updatedAt: string
}

/** 생성 작업 상태. PENDING·RUNNING이면 계속 조회하고, SUCCEEDED·FAILED면 멈춘다. */
export type GenerationStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

/** 생성 세부 단계 */
export type GenerationStage = 'QUEUED' | 'OCR' | 'AI_CORRECTION' | 'COMPLETED'

export type GenerationDto = {
  id: number
  worksheetId: number
  status: GenerationStatus
  stage: GenerationStage
  attempt: number
  retryOfGenerationId: number | null
  settingsSnapshot: AreaSetting[]
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  /** 실패 시 원인. code 예: AI_TIMEOUT, AI_MODEL_ERROR, OCR_FAILED */
  error: { code: string; message: string; retryable: boolean } | null
}

export type CorrectionStatus = 'ACTIVE' | 'DELETED'
export type CorrectionFeedbackType = 'CORRECTION' | 'SUGGESTION'

/** GET /worksheets/{worksheetId}/corrections의 선택적 쿼리 파라미터 */
export type CorrectionFilters = {
  status?: CorrectionStatus
  pageId?: number
  area?: AreaCode
  feedbackType?: CorrectionFeedbackType
  isApplied?: boolean
}

export type CorrectionDto = {
  id: number
  etag: string
  generationId: number
  source: 'AI' | (string & {})
  area: AreaCode
  originalText: string
  aiInitialContent: string
  content: string
  explanation: string
  regions: RegionDto[]
  editedByTeacher: boolean
  explanationStale: boolean
  status: CorrectionStatus
  createdAt: string
  updatedAt: string
  /** 없으면 기존 영역 기준으로 오류 수정/개선 제안을 구분한다. */
  feedbackType?: CorrectionFeedbackType | null
  isApplied?: boolean | null
  regionCoordinateUnit?: 'NORMALIZED_0_1' | (string & {}) | null
  requiresReview?: boolean | null
  locationUncertain?: boolean | null
  /** 일반 카드는 REPLACE 또는 GUIDANCE. 과거 미분류 자료는 null */
  action?: 'REPLACE' | 'GUIDANCE' | (string & {}) | null
  /** 한 줄 첨삭의 원문 연결. v1.1 여러 줄 첨삭에서는 null이고 anchors를 쓴다. */
  anchor?: CorrectionAnchorDto | null
  issueKinds?: string[] | null
  /** 검증 경고. 새 코드가 추가될 수 있어 문자열·객체 모두 허용한다. */
  warnings?: unknown[] | null
  // ---- AI 계약 v1.1에서 추가된 필드 ----
  /** AUTEDI-AI-CONTRACT-v1 또는 AUTEDI-AI-CONTRACT-v1.1 */
  contractVersion?: string | null
  /** 원문 연결 전체. 여러 줄이면 줄마다 하나씩 들어온다. */
  anchors?: CorrectionAnchorDto[] | null
  revisionScope?: RevisionScope | null
  /** AI가 처음 제안한 수정 동작. 교사가 편집해도 유지된다. GUIDANCE는 null */
  aiInitialEdit?: CorrectionEditDto | null
  /** 현재 content에 유효한 수정 동작. 교사가 content를 바꾸면 null */
  edit?: CorrectionEditDto | null
  /** 현재 원문 좌표. regions와 같은 값이다. */
  targetRegions?: RegionDto[] | null
}

export type RevisionScope = 'WORD' | 'PHRASE' | 'CLAUSE' | 'SENTENCE' | 'SENTENCE_GROUP'

export type EditOperation = 'INSERT' | 'DELETE' | 'REPLACE' | 'RESTRUCTURE'

export type CorrectionEditDto = {
  operation: EditOperation | (string & {})
  text: string
  /** INSERT일 때만 BEFORE/AFTER, 다른 동작은 null */
  position: 'BEFORE' | 'AFTER' | null
}

/** 확정 전사 기준 원문 위치. start/end는 줄 안의 0 기반 UTF-16 범위(end 미포함) */
export type CorrectionAnchorDto = {
  transcriptionId: number
  lineId: number
  occurrence: number
  start: number
  end: number
}

/** 페이지·영역별 첨삭 개수 집계. v1.1은 recommendedCount=0(권장 개수 없음), maximumCount=7 */
export type CorrectionSummaryDto = {
  generationId: number
  pageId: number
  pageNumber: number
  area: AreaCode
  level: string
  recommendedCount: number
  maximumCount: number
  validatedCount: number
  displayedCount: number
  omittedCount: number
}

/** GET /worksheets/{id}/comments 응답. 첨삭 목록과 같은 형식들을 받는다. */
export type CommentListDto = { items: CommentDto[]; total?: number } | CommentDto[] | { comments: CommentDto[] }

export type CorrectionListDto =
  | { items: CorrectionDto[]; total: number }
  | CorrectionDto[]
  | { corrections: CorrectionDto[] }

/** 교사 표시 종류 (Swagger CommentCreateRequest 기준) */
export type HighlightType = 'HIGHLIGHT' | 'UNDERLINE' | 'STRIKETHROUGH' | 'ARROW' | 'TEXTBOX' | 'CARET'
export type CommentColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN'

export type CommentDto = {
  /** 생성 응답에서 비어 오는 경우가 있어 null도 받는다. */
  id: number | null
  /** 서버가 id 대신 이 이름으로 보낼 때를 대비한다. */
  commentId?: number | null
  etag: string
  source: 'TEACHER' | (string & {})
  pageId: number
  highlightType: HighlightType
  color?: CommentColor | null
  regions: RegionDto[]
  content: string
  createdAt: string
  updatedAt: string
}

export type ReviewDto = {
  worksheet: WorksheetDto
  generation: GenerationDto | null
  corrections: CorrectionDto[]
  comments: CommentDto[]
  aiResults?: unknown[]
  /** 확인이 필요한 AI 후보. 화면에 쓰지 않으므로 형식을 고정하지 않는다. */
  reviewIssues?: unknown[]
  summary?: CorrectionSummaryDto[]
}

/** 업로드는 학습지 정보만 반환하거나, 완료된 첨삭 결과까지 함께 반환할 수 있다. */
export type WorksheetUploadDto = WorksheetDto | ReviewDto

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'

export type AuthUserDto = {
  userId: number
  email: string
  name: string
  role: 'DIRECTOR' | 'TEACHER'
  academyId: number
  academyName: string
  subscriptionStatus: SubscriptionStatus
  planExpiresAt?: string | null
  lastLoginAt?: string
}

export type TokenPair = { accessToken: string; refreshToken: string }

export type LoginResponse = TokenPair & { user: AuthUserDto }

/** GET /invitations/validate 응답. 가입 폼을 자동으로 채우는 데 쓴다. */
export type InvitationValidateDto = {
  valid: boolean
  email: string
  academyName: string
  expiresAt: string | null
}

/** POST /invitations 응답. 같은 이메일의 이전 대기 초대는 서버가 무효화한다. */
export type InvitationDto = {
  invitationId: number
  email: string
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | (string & {})
  expiresAt: string | null
}

/** POST /auth/signup 요청. email은 초대 검증 응답의 값을 그대로 보낸다. */
export type SignupRequest = {
  token: string
  email: string
  name: string
  password: string
}

export type SignupResponseDto = {
  userId: number
  email: string
  name: string
  role: 'DIRECTOR' | 'TEACHER'
}
