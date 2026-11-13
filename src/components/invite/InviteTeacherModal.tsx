import { useState, type FormEvent } from 'react'
import { authApi } from '../../apis/authApi'
import { getErrorMessage, isApiError } from '../../apis/errors'
import type { InvitationDto } from '../../apis/types'
import { formatExpiresAt, validateInviteEmail } from '../../utils/signup'
import { cn } from '../../utils/cn'
import { AUTH_INPUT, AUTH_LABEL, AuthAlert } from '../auth/AuthLayout'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

/** 원장이 선생님 이메일로 초대 메일을 보내는 창. 메일 발송은 서버가 한다. */
export function InviteTeacherModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState<InvitationDto | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const invalid = validateInviteEmail(email)
    setFieldError(invalid)
    setError(null)
    if (invalid) return

    setSubmitting(true)
    try {
      const { data } = await authApi.sendInvitation(email.trim())
      setSent(data)
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'COMMON_001' && caught.fieldErrors.email) {
        setFieldError(caught.fieldErrors.email)
      } else {
        setError(getErrorMessage(caught, '초대 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inviteAnother = () => {
    setSent(null)
    setEmail('')
  }

  const expiresAt = formatExpiresAt(sent?.expiresAt)

  return (
    <Modal className="w-[min(400px,92vw)]" labelledBy="invite-teacher-title" onClose={onClose}>
      <h2 className="my-[7px] text-[21px] tracking-[-0.8px]" id="invite-teacher-title">
        선생님 초대
      </h2>

      {sent ? (
        <>
          <AuthAlert tone="success">
            <b className="font-extrabold">{sent.email}</b>로 초대 메일을 보냈어요.
            {expiresAt && (
              <>
                <br />
                초대 링크는 {expiresAt}까지 사용할 수 있어요.
              </>
            )}
          </AuthAlert>
          <footer className="flex justify-end gap-[7px]">
            <Button onClick={inviteAnother}>다른 선생님 초대</Button>
            <Button onClick={onClose} variant="primary">
              닫기
            </Button>
          </footer>
        </>
      ) : (
        <form noValidate onSubmit={submit}>
          <p className="mt-[9px] mb-5 text-[9px] leading-relaxed text-[#868b9d]">
            입력한 이메일로 가입 링크를 보내요. 링크는 24시간 동안 사용할 수 있고,
            <br />
            같은 이메일로 다시 보내면 이전 링크는 사용할 수 없게 돼요.
          </p>
          <label className="mb-4 block">
            <span className={AUTH_LABEL}>선생님 이메일</span>
            <input
              aria-describedby={fieldError ? 'invite-email-error' : undefined}
              aria-invalid={Boolean(fieldError)}
              autoComplete="off"
              autoFocus
              className={cn(AUTH_INPUT, fieldError && 'border-[#e58a96]')}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldError(null)
              }}
              placeholder="teacher@example.com"
              type="email"
              value={email}
            />
            {fieldError && (
              <span className="mt-1 block text-[8px] font-semibold text-[#c53843]" id="invite-email-error">
                {fieldError}
              </span>
            )}
          </label>

          {error && <AuthAlert>{error}</AuthAlert>}

          <footer className="flex justify-end gap-[7px]">
            <Button onClick={onClose}>취소</Button>
            <Button className="disabled:opacity-60" disabled={submitting} type="submit" variant="primary">
              {submitting ? '보내는 중…' : '초대 메일 보내기'}
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  )
}
