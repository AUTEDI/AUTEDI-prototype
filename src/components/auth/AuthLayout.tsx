import type { ReactNode } from 'react'
import autediIcon from '../../images/pavicon.ico'

export const AUTH_INPUT =
  'h-10 w-full rounded-[10px] border border-[#dfe1ea] bg-white px-3 text-[11px] outline-none focus:border-[#7684e8] focus:shadow-[0_0_0_3px_#eef0ff]'

export const AUTH_LABEL = 'mb-1.5 block text-[8px] font-extrabold text-[#70768a]'

/** 로그인·회원가입 화면의 공통 배경과 카드 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#181b2f_0%,#111423_62%,#18234e_100%)] px-4 py-8">
      <div className="w-[min(380px,100%)] animate-fade-page rounded-[20px] bg-white p-7 shadow-modal">
        <div className="mb-6 flex items-center gap-[10px]">
          <img alt="" className="size-8 shrink-0 object-contain" src={autediIcon} />
          <b className="font-[850] tracking-[1.8px]">AUTEDI</b>
        </div>
        {children}
      </div>
    </main>
  )
}

export function AuthAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  return (
    <p
      className={
        tone === 'error'
          ? 'mb-3 rounded-lg bg-[#fff5f7] px-3 py-2 text-[9px] text-[#c53843]'
          : 'mb-4 rounded-lg bg-[#eefaf5] px-3 py-2 text-[9px] text-[#14725f]'
      }
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}
