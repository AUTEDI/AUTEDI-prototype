import { api } from './client'
import type { AuthUserDto, InvitationValidateDto, LoginResponse, SignupRequest, SignupResponseDto } from './types'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, { anonymous: true }),
  logout: (refreshToken: string) => api.post<null>('/auth/logout', { refreshToken }),
  me: () => api.get<AuthUserDto>('/users/me'),

  // 초대 검증·회원가입은 로그인 없이 호출한다. 다른 계정의 토큰이 남아 있어도 보내지 않는다.
  validateInvitation: (token: string, signal?: AbortSignal) =>
    api.get<InvitationValidateDto>(`/invitations/validate?${new URLSearchParams({ token })}`, {
      anonymous: true,
      signal,
    }),
  signup: (body: SignupRequest) => api.post<SignupResponseDto>('/auth/signup', body, { anonymous: true }),
}
