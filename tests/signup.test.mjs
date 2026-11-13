import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let server
let authApi
let signup
let errors
let calls
let reply
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const envelope = (result) => ({ isSuccess: true, code: 'COMMON_200', message: 'OK', result, error: null })
const failure = (code, message, error = null) => ({ isSuccess: false, code, message, result: null, error })

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    define: { 'import.meta.env.VITE_API_BASE_URL': '"https://api.example.test"' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  authApi = (await server.ssrLoadModule('/src/apis/authApi.ts')).authApi
  signup = await server.ssrLoadModule('/src/utils/signup.ts')
  errors = await server.ssrLoadModule('/src/apis/errors.ts')
})

beforeEach(() => {
  calls = []
  reply = () => Response.json(envelope(null))
  // 다른 계정으로 로그인된 브라우저를 흉내 낸다. 초대·가입 요청에는 이 토큰이 붙으면 안 된다.
  const stored = JSON.stringify({ accessToken: 'director-access', refreshToken: 'director-refresh' })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => stored, setItem: () => {}, removeItem: () => {} },
  })
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url)
    calls.push({ path: parsed.pathname, query: parsed.searchParams, ...init })
    return reply(parsed, init)
  }
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
  await server?.close()
})

test('초대 토큰 검증은 인증 없이 토큰을 그대로 쿼리로 보낸다', async () => {
  const invitation = { valid: true, email: 'teacher@example.com', academyName: '세오스 영어학원', expiresAt: '2026-11-13T09:00:00' }
  reply = () => Response.json(envelope(invitation))
  const { data } = await authApi.validateInvitation('a+b/c=')
  assert.deepEqual(data, invitation)
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].path, '/api/v1/invitations/validate')
  assert.equal(calls[0].query.get('token'), 'a+b/c=')
  assert.equal(calls[0].headers.has('Authorization'), false)
})

test('회원가입은 인증 없이 토큰·이메일·이름·비밀번호를 JSON으로 보낸다', async () => {
  reply = () => Response.json(envelope({ userId: 3, email: 'teacher@example.com', name: '김선생', role: 'TEACHER' }), { status: 201 })
  const body = { token: 'invite-token', email: 'teacher@example.com', name: '김선생', password: 'password1' }
  const { data } = await authApi.signup(body)
  assert.equal(data.role, 'TEACHER')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, '/api/v1/auth/signup')
  assert.deepEqual(JSON.parse(calls[0].body), body)
  assert.equal(calls[0].headers.has('Authorization'), false)
})

test('초대·가입 에러 코드를 안내 화면 종류로 구분한다', async () => {
  const cases = [
    [404, 'INVITATION_001', 'invalid'],
    [410, 'INVITATION_002', 'expired'],
    [400, 'INVITATION_003', 'used'],
    [409, 'AUTH_009', 'registered'],
    [400, 'INVITATION_004', null],
    [400, 'COMMON_001', null],
  ]
  for (const [status, code, problem] of cases) {
    reply = () => Response.json(failure(code, '서버 메시지'), { status })
    const error = await authApi.validateInvitation('token').catch((caught) => caught)
    assert.equal(error.code, code)
    assert.equal(signup.toInvitationProblem(error), problem, code)
  }
  assert.equal(signup.toInvitationProblem(new Error('network')), null)
})

test('입력값 오류의 필드별 사유를 보존한다', () => {
  const error = errors.toApiError(400, failure('COMMON_001', '요청 값이 올바르지 않습니다.', [
    'password: 비밀번호는 최소 8자 이상이어야 합니다.',
    'email: 올바른 이메일 형식이 아닙니다.',
    'name: 이름은 필수 입력값입니다.',
    'name: 두 번째 사유',
  ]))
  assert.equal(error.code, 'COMMON_001')
  assert.deepEqual(error.fieldErrors, {
    password: '비밀번호는 최소 8자 이상이어야 합니다.',
    email: '올바른 이메일 형식이 아닙니다.',
    name: '이름은 필수 입력값입니다.',
  })
  assert.deepEqual(errors.toApiError(400, failure('COMMON_001', '요청 값이 올바르지 않습니다.')).fieldErrors, {})
})

test('이름은 필수·50자 이내, 비밀번호는 필수·8자 이상으로 검사한다', () => {
  const { validateSignup } = signup
  assert.deepEqual(validateSignup({ name: '김선생', password: '12345678' }), {})
  assert.deepEqual(Object.keys(validateSignup({ name: '   ', password: '' })), ['name', 'password'])
  assert.ok(validateSignup({ name: '가'.repeat(51), password: '12345678' }).name)
  assert.deepEqual(validateSignup({ name: ` ${'가'.repeat(50)} `, password: '12345678' }), {})
  assert.ok(validateSignup({ name: '김선생', password: '1234567' }).password)
})

test('주소에 토큰이 없거나 비어 있으면 잘못된 접근으로 본다', () => {
  const { readInvitationToken } = signup
  assert.equal(readInvitationToken(''), null)
  assert.equal(readInvitationToken('?token='), null)
  assert.equal(readInvitationToken('?other=1'), null)
  assert.equal(readInvitationToken('?token=abc123'), 'abc123')
})

test('선생님 초대는 로그인 토큰을 붙여 이메일만 보낸다', async () => {
  const invitation = { invitationId: 12, email: 'teacher@example.com', status: 'PENDING', expiresAt: '2026-11-14T18:00:00' }
  reply = () => Response.json(envelope(invitation))
  const { data } = await authApi.sendInvitation('teacher@example.com')
  assert.deepEqual(data, invitation)
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].path, '/api/v1/invitations')
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'teacher@example.com' })
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer director-access')
})

test('초대 이메일은 비었거나 형식이 틀리면 막는다', () => {
  const { validateInviteEmail } = signup
  assert.equal(validateInviteEmail(' teacher@example.com '), null)
  assert.ok(validateInviteEmail('   '))
  assert.ok(validateInviteEmail('teacher'))
  assert.ok(validateInviteEmail('teacher@example'))
  assert.ok(validateInviteEmail('a b@example.com'))
})
