import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MobileUploadPage } from './pages/MobileUploadPage'
import { ReviewPage } from './pages/ReviewPage'
import { SignupPage } from './pages/SignupPage'
import { screenPath, useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'

const readPathname = () => window.location.pathname.replace(/\/+$/, '') || '/'

function App() {
  const page = useAppStore((state) => state.page)
  const authStatus = useAuthStore((state) => state.status)
  const currentEmail = useAuthStore((state) => state.user?.email ?? null)
  const restore = useAuthStore((state) => state.restore)
  const [pathname, setPathname] = useState(readPathname)
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)

  useEffect(() => {
    // 모바일 업로드 UI는 QR 인증 연동 전에도 독립적으로 확인할 수 있다.
    if (pathname === '/qr-login') return
    void restore()
  }, [pathname, restore])

  useEffect(() => {
    // 화면이 바뀔 때마다 주소를 맞춘다. 기록은 쌓지 않고 현재 주소만 바꾼다.
    const syncAddress = () => {
      const current = readPathname()
      if (current === '/qr-login' || current === '/signup') return
      const next = screenPath(useAppStore.getState())
      if (next !== current) window.history.replaceState(null, '', next)
    }
    syncAddress()
    return useAppStore.subscribe(syncAddress)
  }, [pathname])

  useEffect(() => {
    const syncPath = () => setPathname(readPathname())
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  if (pathname === '/qr-login') return <MobileUploadPage />

  if (pathname === '/signup') {
    return (
      <SignupPage
        onGoLogin={(email) => {
          // 1회용 토큰이 주소에 남지 않도록 기록을 바꾼다.
          window.history.replaceState(null, '', '/')
          setSignedUpEmail(email ?? null)
          setPathname('/')
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
