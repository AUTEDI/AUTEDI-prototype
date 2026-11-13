/** API 명세 '표준 에러 코드 일람'의 코드와 기본 메시지 */
export const API_ERROR_MESSAGES = {
  COMMON_001: '요청 값이 올바르지 않습니다.',
  FILE_001: '업로드할 파일이 비어 있습니다.',
  GENERATION_004: '첨삭 영역을 최소 한 개 선택해 주세요.',
  COMMENT_002: '코멘트 영역의 페이지가 대상 페이지와 일치하지 않습니다.',
  AUTH_001: '인증이 필요합니다.',
  ACADEMY_002: '학원 유료 구독이 활성 상태가 아닙니다.',
  WORKSHEET_001: '학습지를 찾을 수 없거나 접근 권한이 없습니다.',
  GENERATION_003: '생성 작업을 찾을 수 없습니다.',
  CORRECTION_001: '첨삭 항목을 찾을 수 없습니다.',
  COMMENT_001: '코멘트를 찾을 수 없거나 이미 삭제되었습니다.',
  PAGE_001: '해당 페이지를 찾을 수 없습니다.',
  WORKSHEET_002: '현재 학습지 상태에서는 요청한 작업을 수행할 수 없습니다.',
  CORRECTION_002: '삭제된 첨삭 항목은 수정할 수 없습니다.',
  GENERATION_001: '이미 생성 작업이 진행 중입니다.',
  GENERATION_002: '이미 생성이 완료된 학습지입니다.',
  GENERATION_005: '재시도할 수 없는 작업 상태이거나 파일/설정이 변경되었습니다.',
  COMMON_412: '데이터 버전이 변경되었습니다. 최신 데이터를 조회한 후 다시 시도해 주세요.',
  FILE_002: '지원하지 않는 파일 형식입니다. JPG, PNG, PDF 파일만 허용됩니다.',
  COMMON_003: '서버 내부 오류가 발생했습니다.',
  // 아래는 표에는 없지만 각 API 상세 페이지에 나오는 코드
  COMMON_INVALID_INPUT: '입력값을 확인해주세요.',
  FILE_003: '파일을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
  AUTH_INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  AUTH_ACCOUNT_LOCKED: '계정이 잠금 처리되었습니다. 관리자에게 문의하세요.',
  AUTH_TOKEN_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  AUTH_TOKEN_REVOKED: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  AUTH_UNAUTHORIZED: '인증이 필요합니다.',
  USER_NOT_FOUND: '회원 정보를 찾을 수 없습니다.',
  // 초대 기반 회원가입
  INVITATION_001: '유효하지 않은 초대 토큰입니다.',
  INVITATION_002: '만료된 초대 링크입니다.',
  INVITATION_003: '이미 사용되었거나 취소된 초대 링크입니다.',
  INVITATION_004: '초대받은 이메일과 가입 요청 이메일이 일치하지 않습니다.',
  AUTH_009: '이미 가입된 이메일입니다.',
  QR_001: '유효하지 않은 QR이에요. 노트북에서 새 QR을 생성해주세요.',
  QR_002: 'QR이 만료되었어요. 노트북에서 새 QR을 생성해주세요.',
  QR_003: '이미 사용되었거나 처리할 수 없는 QR이에요. 새 QR을 생성해주세요.',
  QR_004: '이 QR로 업로드할 수 있는 작업이 아니에요.',
  QR_005: '다른 계정으로 로그인되어 있어요. 노트북에서 로그인을 허용해주세요.',
  QR_006: '이미 사진을 올린 QR이에요. 노트북에서 새 QR을 생성해주세요.',
  QR_007: '사진은 한 장만 올릴 수 있어요.',
  COMMON_429: '요청이 많아요. 잠시 후 다시 시도해주세요.',
} as const

export type ApiErrorCode = keyof typeof API_ERROR_MESSAGES

/** 서버 응답 없이 프론트에서 만드는 에러 코드 */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNKNOWN_ERROR'

const CLIENT_ERROR_MESSAGES: Record<ClientErrorCode, string> = {
  NETWORK_ERROR: '서버에 연결하지 못했어요. 네트워크 상태를 확인해주세요.',
  UNKNOWN_ERROR: '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.',
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | ClientErrorCode
  /** 명세에 없는 코드가 오면 원래 값을 보관한다. */
  readonly rawCode: string | null
  /** 입력값 검증 실패의 필드별 사유. 예) { password: '비밀번호는 최소 8자 이상이어야 합니다.' } */
  readonly fieldErrors: Record<string, string>
  readonly retryAfterMs: number | null

  constructor({
    status,
    code,
    message,
    rawCode = null,
    fieldErrors = {},
    retryAfterMs = null,
  }: {
    status: number
    code: ApiErrorCode | ClientErrorCode
    message?: string
    rawCode?: string | null
    fieldErrors?: Record<string, string>
    retryAfterMs?: number | null
  }) {
    super(message ?? getDefaultMessage(code))
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.rawCode = rawCode
    this.fieldErrors = fieldErrors
    this.retryAfterMs = retryAfterMs
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function isApiErrorCode(code: unknown): code is ApiErrorCode {
  return typeof code === 'string' && code in API_ERROR_MESSAGES
}

function getDefaultMessage(code: ApiErrorCode | ClientErrorCode) {
  return isApiErrorCode(code) ? API_ERROR_MESSAGES[code] : CLIENT_ERROR_MESSAGES[code]
}

/**
 * 에러 응답 본문에서 code와 message를 꺼낸다.
 * 최상위 값을 먼저 보고, 없으면 error 객체 안을 본다.
 * 입력값 검증 실패는 error에 ["areas: 최소 한 개 이상..."] 같은 상세 사유 배열이 온다.
 */
function readErrorBody(body: unknown): { code?: unknown; message?: unknown; details: string[] } {
  if (typeof body !== 'object' || body === null) return { details: [] }
  const record = body as Record<string, unknown>
  const { error } = record
  const details = Array.isArray(error) ? error.filter((item): item is string => typeof item === 'string') : []
  const nested = typeof error === 'object' && error !== null && !Array.isArray(error) ? (error as Record<string, unknown>) : {}
  return { code: record.code ?? nested.code, message: record.message ?? nested.message, details }
}

/** "areas: 메시지" 형식에서 필드 이름을 떼고 사용자에게 보여줄 문장만 남긴다. */
function detailMessage(detail: string) {
  const separator = detail.indexOf(': ')
  return separator >= 0 ? detail.slice(separator + 2) : detail
}

/** "password: 메시지" 목록을 필드별 첫 사유로 묶는다. 필드 이름이 없는 사유는 제외한다. */
function toFieldErrors(details: string[]) {
  const fieldErrors: Record<string, string> = {}
  for (const detail of details) {
    const separator = detail.indexOf(': ')
    if (separator <= 0) continue
    const field = detail.slice(0, separator)
    fieldErrors[field] ??= detail.slice(separator + 2)
  }
  return fieldErrors
}

export function toApiError(status: number, body: unknown, retryAfter: string | null = null) {
  const { code, message, details } = readErrorBody(body)
  const knownCode = isApiErrorCode(code) ? code : null
  return new ApiError({
    status,
    code: knownCode ?? 'UNKNOWN_ERROR',
    // 상세 사유가 있으면 "요청 값이 올바르지 않습니다"보다 구체적인 사유를 보여준다.
    message: details[0] ? detailMessage(details[0]) : typeof message === 'string' && message ? message : undefined,
    rawCode: typeof code === 'string' && !knownCode ? code : null,
    fieldErrors: toFieldErrors(details),
    retryAfterMs: retryAfter !== null && Number.isFinite(Number(retryAfter))
      ? Math.max(0, Number(retryAfter) * 1000)
      : null,
  })
}

/** 사용자에게 보여줄 메시지. API 에러가 아니면 fallback을 쓴다. */
export function getErrorMessage(error: unknown, fallback = CLIENT_ERROR_MESSAGES.UNKNOWN_ERROR) {
  return isApiError(error) ? error.message : fallback
}
