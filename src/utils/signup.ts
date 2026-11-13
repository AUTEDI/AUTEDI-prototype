import { isApiError } from '../apis/errors'

export const NAME_MAX_LENGTH = 50
export const PASSWORD_MIN_LENGTH = 8

export type SignupField = 'name' | 'password'
export type SignupFieldErrors = Partial<Record<SignupField, string>>

/**
 * 서버 규칙(이름 필수·50자 이내, 비밀번호 필수·8자 이상)을 먼저 검사한다.
 * 길이는 서버(Java)와 같은 기준이 되도록 문자열 length로 센다.
 */
export function validateSignup({ name, password }: { name: string; password: string }): SignupFieldErrors {
  const errors: SignupFieldErrors = {}
  const trimmed = name.trim()
  if (!trimmed) errors.name = '이름을 입력해주세요.'
  else if (trimmed.length > NAME_MAX_LENGTH) errors.name = `이름은 ${NAME_MAX_LENGTH}자 이내로 입력해주세요.`
  if (!password) errors.password = '비밀번호를 입력해주세요.'
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해주세요.`
  return errors
}

/** 초대할 선생님 이메일을 검사한다. 문제가 없으면 null이다. */
export function validateInviteEmail(email: string) {
  const trimmed = email.trim()
  if (!trimmed) return '이메일을 입력해주세요.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '올바른 이메일 형식이 아니에요.'
  return null
}

/** 초대 만료 일시를 "2026년 11월 13일 오후 6:00" 형식으로 바꾼다. 값이 없거나 잘못되면 null이다. */
export function formatExpiresAt(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

/** 폼 대신 안내 화면을 보여줘야 하는 초대 링크 상태 */
export type InvitationProblem = 'missing' | 'invalid' | 'expired' | 'used' | 'registered'

/** 초대 검증·가입 에러 중 폼을 더 쓸 수 없는 경우를 고른다. 나머지는 폼 안에서 문구로 보여준다. */
export function toInvitationProblem(error: unknown): InvitationProblem | null {
  if (!isApiError(error)) return null
  switch (error.code) {
    case 'INVITATION_001':
      return 'invalid'
    case 'INVITATION_002':
      return 'expired'
    case 'INVITATION_003':
      return 'used'
    case 'AUTH_009':
      return 'registered'
    default:
      return null
  }
}

/** URL의 ?token= 값. 없거나 비어 있으면 null이다. 서버에 그대로 보내야 하므로 가공하지 않는다. */
export function readInvitationToken(search: string) {
  const token = new URLSearchParams(search).get('token')
  return token ? token : null
}
