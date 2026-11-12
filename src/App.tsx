import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ReviewPage } from './pages/ReviewPage'
import { SignupPage } from './pages/SignupPage'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'

/** 초대 메일의 링크(/signup?token=...)로 들어온 경우 */
const isSignupPath = () => window.location.pathname.replace(/\/+$/, '') === '/signup'

function App() {
  const page = useAppStore((state) => state.page)
  const authStatus = useAuthStore((state) => state.status)
  const currentEmail = useAuthStore((state) => state.user?.email ?? null)
  const restore = useAuthStore((state) => state.restore)
  const [signup, setSignup] = useState(isSignupPath)
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)

  useEffect(() => {
    void restore()
  }, [restore])

  useEffect(() => {
    const syncPath = () => setSignup(isSignupPath())
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  if (signup) {
    return (
      <SignupPage
        onGoLogin={(email) => {
          // 1회용 토큰이 주소에 남지 않도록 기록을 바꾼다.
          window.history.replaceState(null, '', '/')
          setSignedUpEmail(email ?? null)
          setSignup(false)
        }}
      />
    )
  }

  if (authStatus === 'checking') {
    return <div className="grid min-h-screen place-items-center text-[10px] text-[#8a8fa0]">로그인 정보를 확인하고 있어요…</div>
  }
  // 가입 직후에는 이 브라우저에 다른 계정이 로그인되어 있어도 새 계정으로 로그인하게 한다.
  if (signedUpEmail && currentEmail !== signedUpEmail) {
    return (
      <LoginPage
        initialEmail={signedUpEmail}
        notice="가입이 완료되었어요. 방금 만든 비밀번호로 로그인해주세요."
        onLoggedIn={() => setSignedUpEmail(null)}
      />
    )
  }
  if (authStatus === 'guest') return <LoginPage />

  return <AppShell>{page === 'home' ? <HomePage /> : <ReviewPage />}</AppShell>
}

export default App
