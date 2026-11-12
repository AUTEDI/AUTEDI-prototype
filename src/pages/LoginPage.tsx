import { useState, type FormEvent } from 'react'
import { AUTH_INPUT, AUTH_LABEL, AuthAlert, AuthLayout } from '../components/auth/AuthLayout'
import { Button } from '../components/common/Button'
import { useAuthStore } from '../stores/useAuthStore'

type LoginPageProps = {
  /** 회원가입 직후처럼 미리 채울 이메일 */
  initialEmail?: string
  /** 폼 위에 보여줄 안내 (예: 가입 완료) */
  notice?: string
  onLoggedIn?: () => void
}

export function LoginPage({ initialEmail = '', notice, onLoggedIn }: LoginPageProps) {
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }
    setSubmitting(true)
    const message = await login(email.trim(), password)
    setError(message)
    setSubmitting(false)
    if (!message) onLoggedIn?.()
  }

  return (
    <AuthLayout>
      <form noValidate onSubmit={submit}>
        <h1 className="mb-1.5 text-[21px] tracking-[-0.8px]">선생님 로그인</h1>
        <p className="mb-5 text-[9px] text-[#8a8fa0]">학원에서 받은 계정으로 로그인하세요.</p>
        {notice && <AuthAlert tone="success">{notice}</AuthAlert>}
        <label className="mb-3 block">
          <span className={AUTH_LABEL}>이메일</span>
          <input
            autoComplete="email"
            className={AUTH_INPUT}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="mb-4 block">
          <span className={AUTH_LABEL}>비밀번호</span>
          <input
            autoComplete="current-password"
            autoFocus={Boolean(initialEmail)}
            className={AUTH_INPUT}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error && <AuthAlert>{error}</AuthAlert>}
        <Button className="w-full disabled:opacity-60" disabled={submitting} type="submit" variant="primary">
          {submitting ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </AuthLayout>
  )
}
