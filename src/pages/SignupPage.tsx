import { useEffect, useState, type FormEvent } from 'react'
import { authApi } from '../apis/authApi'
import { USE_LIVE_API } from '../apis/config'
import { getErrorMessage, isApiError } from '../apis/errors'
import type { InvitationValidateDto } from '../apis/types'
import { AUTH_INPUT, AUTH_LABEL, AuthAlert, AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/common/Button'
import { cn } from '../utils/cn'
import {
  formatExpiresAt,
  PASSWORD_MIN_LENGTH,
  readInvitationToken,
  toInvitationProblem,
  validateSignup,
  type InvitationProblem,
  type SignupField,
  type SignupFieldErrors,
} from '../utils/signup'

type Invitation = Pick<InvitationValidateDto, 'email' | 'academyName' | 'expiresAt'>

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; invitation: Invitation }
  | { status: 'problem'; problem: InvitationProblem }
  /** 네트워크 오류처럼 다시 시도하면 될 수 있는 실패 */
  | { status: 'error'; message: string }

const PROBLEM_COPY: Record<InvitationProblem, { title: string; body: string; login?: boolean }> = {
  missing: {
    title: '잘못된 접근이에요',
    body: '초대 메일에 있는 링크를 눌러 다시 들어와주세요.',
  },
  invalid: {
    title: '유효하지 않은 초대 링크예요',
    body: '링크 주소가 정확한지 확인해주세요. 여러 번 초대받았다면 가장 최근 메일의 링크만 사용할 수 있어요.',
  },
  expired: {
    title: '초대 링크가 만료되었어요',
    body: '초대 링크는 24시간 동안만 사용할 수 있어요. 원장님께 재초대를 요청하세요.',
  },
  used: {
    title: '이미 사용된 초대 링크예요',
    body: '이미 가입했다면 로그인해주세요. 가입한 적이 없다면 원장님께 재초대를 요청하세요.',
    login: true,
  },
  registered: {
    title: '이미 가입된 이메일이에요',
    body: '초대받은 이메일로 로그인해주세요.',
    login: true,
  },
}

type SignupPageProps = {
  /** 가입을 마쳤거나 로그인하러 갈 때. 가입한 이메일이 있으면 로그인 화면에 채운다. */
  onGoLogin: (signedUpEmail?: string) => void
}

export function SignupPage({ onGoLogin }: SignupPageProps) {
  const [token] = useState(() => readInvitationToken(window.location.search))
  const [state, setState] = useState<PageState>(() => {
    if (!token) return { status: 'problem', problem: 'missing' }
    if (!USE_LIVE_API) return { status: 'error', message: '회원가입은 서버에 연결된 환경에서만 할 수 있어요.' }
    return { status: 'loading' }
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // 토큰이 없으면 API를 부르지 않는다.
    if (!token || !USE_LIVE_API) return
    const controller = new AbortController()
    authApi
      .validateInvitation(token, controller.signal)
      .then(({ data }) => {
        if (!data.valid) {
          setState({ status: 'problem', problem: 'invalid' })
          return
        }
        setState({
          status: 'ready',
          invitation: { email: data.email, academyName: data.academyName, expiresAt: data.expiresAt ?? null },
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const problem = toInvitationProblem(error)
        if (problem) setState({ status: 'problem', problem })
        else setState({ status: 'error', message: getErrorMessage(error, '초대 정보를 확인하지 못했어요.') })
      })
    return () => controller.abort()
  }, [token, attempt])

  return (
    <AuthLayout>
      {state.status === 'loading' && (
        <p className="py-6 text-center text-[10px] text-[#8a8fa0]" role="status">
          초대 정보를 확인하고 있어요…
        </p>
      )}
      {state.status === 'problem' && <ProblemNotice onGoLogin={() => onGoLogin()} problem={state.problem} />}
      {state.status === 'error' && (
        <>
          <h1 className="mb-1.5 text-[21px] tracking-[-0.8px]">초대 정보를 불러오지 못했어요</h1>
          <p className="mb-5 text-[9px] leading-relaxed text-[#8a8fa0]">{state.message}</p>
          {USE_LIVE_API && (
            <Button
              className="w-full"
              onClick={() => {
                setState({ status: 'loading' })
                setAttempt((count) => count + 1)
              }}
              variant="primary"
            >
              다시 시도
            </Button>
          )}
        </>
      )}
      {state.status === 'ready' && token && (
        <SignupForm
          invitation={state.invitation}
          onProblem={(problem) => setState({ status: 'problem', problem })}
          onSignedUp={onGoLogin}
          token={token}
        />
      )}
    </AuthLayout>
  )
}

function ProblemNotice({ problem, onGoLogin }: { problem: InvitationProblem; onGoLogin: () => void }) {
  const copy = PROBLEM_COPY[problem]
  return (
    <>
      <h1 className="mb-1.5 text-[21px] tracking-[-0.8px]">{copy.title}</h1>
      <p className={cn('text-[9px] leading-relaxed text-[#8a8fa0]', copy.login && 'mb-5')}>{copy.body}</p>
      {copy.login && (
        <Button className="w-full" onClick={onGoLogin} variant="primary">
          로그인하러 가기
        </Button>
      )}
    </>
  )
}

type SignupFormProps = {
  token: string
  invitation: Invitation
  onSignedUp: (email: string) => void
  onProblem: (problem: InvitationProblem) => void
}

function SignupForm({ token, invitation, onSignedUp, onProblem }: SignupFormProps) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const expiresAt = formatExpiresAt(invitation.expiresAt)

  const clearFieldError = (field: SignupField) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const errors = validateSignup({ name, password })
    setFieldErrors(errors)
    setError(null)
    if (errors.name || errors.password) return

    setSubmitting(true)
    try {
      await authApi.signup({ token, email: invitation.email, name: name.trim(), password })
      onSignedUp(invitation.email)
    } catch (caught) {
      const problem = toInvitationProblem(caught)
      if (problem) {
        onProblem(problem)
        return
      }
      if (isApiError(caught) && caught.code === 'COMMON_001') {
        const { name: nameError, password: passwordError, ...rest } = caught.fieldErrors
        setFieldErrors({ name: nameError, password: passwordError })
        // 이름·비밀번호 외의 사유(이메일·토큰 등)는 폼 위에 보여준다.
        const other = Object.values(rest)[0]
        if (other || (!nameError && !passwordError)) setError(other ?? caught.message)
      } else {
        setError(getErrorMessage(caught, '가입하지 못했어요. 잠시 후 다시 시도해주세요.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={submit}>
      <h1 className="mb-1.5 text-[21px] tracking-[-0.8px]">선생님 회원가입</h1>
      <p className="mb-5 text-[9px] leading-relaxed text-[#8a8fa0]">
        <b className="font-extrabold text-ink">{invitation.academyName}</b>에 초대되었습니다.
        {expiresAt && (
          <>
            <br />
            초대 링크는 {expiresAt}까지 사용할 수 있어요.
          </>
        )}
      </p>

      <label className="mb-3 block">
        <span className={AUTH_LABEL}>이메일</span>
        <input
          aria-readonly
          autoComplete="username"
          className={cn(AUTH_INPUT, 'cursor-default bg-[#f4f5fa] text-[#666c80] focus:border-[#dfe1ea] focus:shadow-none')}
          readOnly
          type="email"
          value={invitation.email}
        />
      </label>

      <label className="mb-3 block">
        <span className={AUTH_LABEL}>이름</span>
        <input
          aria-describedby={fieldErrors.name ? 'signup-name-error' : undefined}
          aria-invalid={Boolean(fieldErrors.name)}
          autoComplete="name"
          className={cn(AUTH_INPUT, fieldErrors.name && 'border-[#e58a96]')}
          onChange={(event) => {
            setName(event.target.value)
            clearFieldError('name')
          }}
          placeholder="김선생"
          value={name}
        />
        {fieldErrors.name && <FieldError id="signup-name-error">{fieldErrors.name}</FieldError>}
      </label>

      <label className="mb-4 block">
        <span className={AUTH_LABEL}>비밀번호</span>
        <input
          aria-describedby={fieldErrors.password ? 'signup-password-error' : 'signup-password-hint'}
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="new-password"
          className={cn(AUTH_INPUT, fieldErrors.password && 'border-[#e58a96]')}
          onChange={(event) => {
            setPassword(event.target.value)
            clearFieldError('password')
          }}
          type="password"
          value={password}
        />
        {fieldErrors.password ? (
          <FieldError id="signup-password-error">{fieldErrors.password}</FieldError>
        ) : (
          <span className="mt-1 block text-[8px] text-[#a0a4b3]" id="signup-password-hint">
            {PASSWORD_MIN_LENGTH}자 이상 입력해주세요.
          </span>
        )}
      </label>

      {error && <AuthAlert>{error}</AuthAlert>}

      <Button className="w-full disabled:opacity-60" disabled={submitting} type="submit" variant="primary">
        {submitting ? '가입 중…' : '가입하기'}
      </Button>
    </form>
  )
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <span className="mt-1 block text-[8px] font-semibold text-[#c53843]" id={id}>
      {children}
    </span>
  )
}
