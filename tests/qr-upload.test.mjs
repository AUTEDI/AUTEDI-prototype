import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let server, qrApi, loginService, events, qr, app, auth, review, tokens
let calls, respond, stored
const globals = Object.fromEntries(['fetch', 'localStorage', 'window', 'document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const envelope = (result) => ({ isSuccess: true, code: 'COMMON_200', result, error: null })
const success = (result, options) => Response.json(envelope(result), options)
const failure = (status, code, headers) => Response.json({ isSuccess: false, code, result: null }, { status, headers })
const user = { email: 'teacher@example.test', name: '선생님', role: 'TEACHER', academyName: '학원', subscriptionStatus: 'ACTIVE' }
const login = (worksheetId = null) => ({ accessToken: 'qr-access', refreshToken: 'qr-refresh', user, worksheetId })
const photo = () => new File(['image'], 'writing.png', { type: 'image/png' })
const session = (worksheetId = null) => ({ sessionId: 'this-tab', qrImage: 'data:image/png;base64,example', expiresAt: new Date(Date.now() + 180_000).toISOString(), worksheetId, phase: 'pending', deviceInfo: '' })
const worksheet = () => ({
  id: 12, etag: '"ws_12-v2"', status: 'DRAFT',
  file: { name: 'writing.png', sizeBytes: 100, originalUrl: '/original' },
  pages: [{ id: 20, pageNumber: 1, imageUrl: '/image' }],
  settings: { etag: '"settings_12-v1"', areas: [] }, latestGenerationId: null,
})
const qrEvent = (type, extra = {}) => ({ type, eventId: 'event-1', sessionId: 'this-tab', ...extra })
const paths = () => calls.map((call) => `${call.method} ${call.path}`)

before(async () => {
  server = await createServer({
    configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_API_BASE_URL': '"https://api.example.test"' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  qrApi = (await server.ssrLoadModule('/src/apis/qrApi.ts')).qrApi
  loginService = await server.ssrLoadModule('/src/apis/qrLoginService.ts')
  events = await server.ssrLoadModule('/src/apis/eventStream.ts')
  qr = (await server.ssrLoadModule('/src/stores/useQrStore.ts')).useQrStore
  app = (await server.ssrLoadModule('/src/stores/useAppStore.ts')).useAppStore
  auth = (await server.ssrLoadModule('/src/stores/useAuthStore.ts')).useAuthStore
  review = (await server.ssrLoadModule('/src/stores/useReviewStore.ts')).useReviewStore
  tokens = (await server.ssrLoadModule('/src/apis/tokenStorage.ts')).tokenStorage
})

beforeEach(() => {
  calls = []
  stored = null
  respond = () => success(null)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => key === 'autedi-auth-tokens' ? stored : null,
    setItem: (key, value) => { if (key === 'autedi-auth-tokens') stored = value },
    removeItem: () => { stored = null },
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { removeEventListener() {} } })
  globalThis.fetch = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const call = { ...init, method: init.method ?? 'GET', path: new URL(url).pathname, headers: new Headers(init.headers) }
    calls.push(call)
    return respond(call)
  }
  qr.getState().reset()
  app.setState(app.getInitialState(), true)
  review.setState(review.getInitialState(), true)
  auth.setState(auth.getInitialState(), true)
})

after(async () => {
  qr?.getState().reset()
  for (const [key, descriptor] of Object.entries(globals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
  await server?.close()
})

test('첫 사진 QR은 작업 ID 없이 생성하고 교체용에만 ID를 보낸다', async () => {
  tokens.set({ accessToken: 'pc-access', refreshToken: 'pc-refresh' })
  respond = () => success(session(), { status: 201 })
  await qrApi.create()
  await qrApi.create(12)
  assert.deepEqual(JSON.parse(calls[0].body), {})
  assert.deepEqual(JSON.parse(calls[1].body), { worksheetId: 12 })
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer pc-access')
})

test('SSE 연결 전에 QR을 만들지 않고 연속 클릭에도 한 세션만 생성한다', async () => {
  respond = () => success(session(), { status: 201 })
  qr.setState({ connection: 'connecting' })
  const first = qr.getState().openSession()
  const second = qr.getState().openSession()
  assert.equal(calls.length, 0)
  qr.setState({ connection: 'connected' })
  await Promise.all([first, second])
  assert.equal(calls.length, 1)
  assert.equal(qr.getState().session.phase, 'pending')
})

test('로그아웃으로 대기를 취소하면 뒤늦게 QR을 생성하지 않는다', async () => {
  const pending = qr.getState().openSession()
  qr.getState().reset()
  qr.setState({ connection: 'connected' })
  await pending
  assert.equal(calls.length, 0)
  assert.equal(qr.getState().session, null)
})

test('휴대폰 연결 후에도 업로드하지 못했다면 새 QR로 다시 연결할 수 있다', async () => {
  qr.setState({ connection: 'connected', session: { ...session(), phase: 'linked' } })
  respond = () => success({ ...session(), sessionId: 'new-session' }, { status: 201 })
  await qr.getState().regenerate()
  assert.equal(qr.getState().session.sessionId, 'new-session')
  assert.equal(qr.getState().session.phase, 'pending')
  assert.equal(calls.length, 1)
})

test('첫 휴대폰은 scan → 승인 조회 → token을 각각 한 번 호출하며 인증 헤더를 보내지 않는다', async () => {
  respond = ({ path }) => success(path.endsWith('/status') ? { status: 'APPROVED' } : path.endsWith('/token') ? login() : null)
  let waiting = 0
  const result = await loginService.connectMobileQr('qr-token', new AbortController().signal, () => { waiting++ })
  assert.equal(result.worksheetId, null)
  assert.equal(waiting, 1)
  assert.deepEqual(paths(), ['POST /api/v1/auth/qr-sessions/scan', 'POST /api/v1/auth/qr-sessions/status', 'POST /api/v1/auth/qr-sessions/token'])
  assert.ok(calls.every((call) => !call.headers.has('Authorization')))
  assert.ok(calls.every((call) => JSON.parse(call.body).qrToken === 'qr-token'))
})

test('같은 계정의 휴대폰은 link만 호출하고 응답의 새 토큰으로 교체한다', async () => {
  tokens.set({ accessToken: 'old-access', refreshToken: 'old-refresh' })
  respond = () => success(login(12))
  const result = await loginService.connectMobileQr('qr-token', new AbortController().signal, () => assert.fail('승인 대기가 필요하지 않다'))
  auth.getState().acceptLogin(result)
  assert.deepEqual(paths(), ['POST /api/v1/auth/qr-sessions/link'])
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer old-access')
  assert.deepEqual(tokens.get(), { accessToken: 'qr-access', refreshToken: 'qr-refresh' })
  assert.equal(result.worksheetId, 12)
})

test('다른 계정의 QR_005만 승인 방식으로 전환하며 익명 요청에 기존 토큰을 넣지 않는다', async () => {
  tokens.set({ accessToken: 'other-account', refreshToken: 'refresh' })
  respond = ({ path }) => path.endsWith('/link') ? failure(403, 'QR_005')
    : success(path.endsWith('/status') ? { status: 'APPROVED' } : path.endsWith('/token') ? login() : null)
  await loginService.connectMobileQr('qr-token', new AbortController().signal, () => {})
  assert.equal(calls.length, 4)
  assert.ok(calls.slice(1).every((call) => !call.headers.has('Authorization')))
})

test('link 인증 실패는 refresh 후 scan으로 전환하고 만료된 QR은 다시 scan하지 않는다', async () => {
  tokens.set({ accessToken: 'expired', refreshToken: 'invalid-refresh' })
  respond = ({ path }) => path.endsWith('/link') || path.endsWith('/refresh') ? failure(401, 'AUTH_001')
    : success(path.endsWith('/status') ? { status: 'APPROVED' } : path.endsWith('/token') ? login() : null)
  await loginService.connectMobileQr('qr-token', new AbortController().signal, () => {})
  assert.deepEqual(paths().slice(0, 3), ['POST /api/v1/auth/qr-sessions/link', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/qr-sessions/scan'])
  calls = []
  tokens.set({ accessToken: 'valid', refreshToken: 'refresh' })
  respond = () => failure(410, 'QR_002')
  await assert.rejects(loginService.connectMobileQr('expired-qr', new AbortController().signal, () => {}), { code: 'QR_002' })
  assert.equal(calls.length, 1)
})

test('PC에서 거절하면 토큰을 발급하지 않고, 화면을 벗어나면 폴링을 중단한다', async () => {
  respond = ({ path }) => success(path.endsWith('/status') ? { status: 'REJECTED' } : null)
  await assert.rejects(loginService.connectMobileQr('qr', new AbortController().signal, () => {}), /거절/)
  assert.equal(calls.some((call) => call.path.endsWith('/token')), false)
  calls = []
  const controller = new AbortController()
  await assert.rejects(loginService.connectMobileQr('qr', controller.signal, () => controller.abort()), { name: 'AbortError' })
  assert.equal(calls.length, 1)
})

test('첫 사진은 한 장의 multipart로 새 작업을 만들고 첨삭을 자동 시작하지 않는다', async () => {
  respond = () => success(worksheet(), { status: 201 })
  assert.equal(await loginService.uploadMobilePhoto(null, photo()), 12)
  assert.deepEqual(paths(), ['POST /api/v1/worksheets'])
  assert.equal([...calls[0].body.entries()].length, 1)
  assert.equal(calls[0].body.get('file').name, 'writing.png')
})

test('교체용 QR은 최신 ETag로 해당 작업의 파일만 교체한다', async () => {
  respond = () => success(worksheet())
  assert.equal(await loginService.uploadMobilePhoto(12, photo()), 12)
  assert.deepEqual(paths(), ['GET /api/v1/worksheets/12', 'PUT /api/v1/worksheets/12/file'])
  assert.equal(calls[1].headers.get('If-Match'), '"ws_12-v2"')
})

test('이미 업로드한 QR_006과 Retry-After 값을 보존하고 업로드를 자동 재전송하지 않는다', async () => {
  respond = () => failure(409, 'QR_006')
  await assert.rejects(loginService.uploadMobilePhoto(null, photo()), { code: 'QR_006' })
  assert.equal(calls.length, 1)
  respond = () => failure(429, 'COMMON_429', { 'Retry-After': '7' })
  await assert.rejects(qrApi.status('qr'), (error) => error.retryAfterMs === 7000)
})

test('다른 탭의 스캔은 무시하고 현재 세션만 허용한다', async () => {
  qr.setState({ session: session() })
  await qr.getState().receiveEvent(qrEvent('qr.scanned', { sessionId: 'another-tab', deviceInfo: 'iPhone' }))
  assert.equal(qr.getState().session.phase, 'pending')
  await qr.getState().receiveEvent(qrEvent('qr.scanned', { deviceInfo: 'iPhone' }))
  assert.equal(qr.getState().session.phase, 'scanned')
  assert.equal(qr.getState().modalOpen, true)
  await qr.getState().approve()
  assert.equal(qr.getState().session.phase, 'approved')
  assert.deepEqual(paths(), ['POST /api/v1/auth/qr-sessions/this-tab/approve'])
})

test('업로드 이벤트를 받은 뒤 미리보기 목록에 한 번 추가하고 자동 첨삭하지 않는다', async () => {
  qr.setState({ session: session(), modalOpen: true })
  respond = ({ path }) => path.endsWith('/image') ? new Response('png', { headers: { 'Content-Type': 'image/png' } }) : success(worksheet())
  await qr.getState().receiveEvent(qrEvent('worksheet.created', { worksheetId: 12 }))
  assert.equal(qr.getState().session.phase, 'uploaded')
  assert.equal(qr.getState().modalOpen, false)
  assert.equal(app.getState().uploads.length, 1)
  assert.equal(app.getState().uploads[0].worksheet.worksheetId, 12)
  assert.match(app.getState().uploads[0].worksheet.imageUrl, /^blob:/)
  assert.equal(app.getState().activeUploadId, app.getState().uploads[0].id)
  await qr.getState().receiveEvent(qrEvent('worksheet.created', { worksheetId: 12 }))
  assert.equal(calls.length, 2)
})

test('사진 교체는 같은 목록 항목을 갱신하고 이전 이미지·첨삭 캐시를 비운다', async () => {
  respond = ({ path }) => path.endsWith('/image') ? new Response('png', { headers: { 'Content-Type': 'image/png' } }) : success(worksheet())
  qr.setState({ session: session() })
  await qr.getState().receiveEvent(qrEvent('worksheet.created', { worksheetId: 12 }))
  const old = app.getState().uploads[0]
  review.getState().startReview(old.id, { worksheetId: 12, pageId: 20, imageUrl: old.worksheet.imageUrl, feedback: [], teacherComments: [] })
  qr.setState({ session: session(12) })
  await qr.getState().receiveEvent(qrEvent('worksheet.file_replaced', { worksheetId: 12 }))
  assert.equal(app.getState().uploads.length, 1)
  assert.equal(app.getState().uploads[0].id, old.id)
  assert.notEqual(app.getState().uploads[0].worksheet.imageUrl, old.worksheet.imageUrl)
  assert.equal(review.getState().reviewsByUploadId[old.id], undefined)
  assert.equal(review.getState().activeUploadId, null)
  assert.equal(calls.filter((call) => call.path.endsWith('/image')).length, 2)
})

test('이벤트 후 조회가 실패해도 작업 ID를 보관하여 다시 불러올 수 있다', async () => {
  qr.setState({ session: session() })
  respond = () => failure(500, 'COMMON_003')
  await qr.getState().receiveEvent(qrEvent('worksheet.created', { worksheetId: 12 }))
  assert.equal(qr.getState().pendingWorksheetId, 12)
  assert.equal(qr.getState().syncing, false)
  respond = ({ path }) => path.endsWith('/image') ? new Response('png', { headers: { 'Content-Type': 'image/png' } }) : success(worksheet())
  await qr.getState().syncWorksheet()
  assert.equal(qr.getState().session.phase, 'uploaded')
})

test('SSE는 잘못된 이벤트와 중복을 무시하고 종료 시 재연결에 최신 토큰을 사용한다', { timeout: 5000 }, async () => {
  tokens.set({ accessToken: 'before-reconnect', refreshToken: 'refresh' })
  const controller = new AbortController()
  const received = []
  let reconnects = 0
  respond = () => {
    if (calls.length === 1) return new Response('', { headers: { 'Content-Type': 'text/event-stream' } })
    const payload = JSON.stringify({ eventId: 'event-1', sessionId: 'this-tab', worksheetId: 12 })
    return new Response(`: ping\n\nevent: worksheet.created\ndata: invalid-json\n\nevent: worksheet.created\ndata: ${payload}\n\nevent: worksheet.created\ndata: ${payload}\n\nevent: qr.linked\ndata: {"eventId":"event-2","sessionId":"this-tab"}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
  }
  await events.connectEventStream({
    signal: controller.signal,
    onStatus: (status) => { if (status === 'reconnecting') tokens.set({ accessToken: 'after-reconnect', refreshToken: 'refresh' }) },
    onReconnect: () => { reconnects++ },
    onEvent: (event) => { received.push(event); if (received.length === 2) controller.abort() },
  })
  assert.equal(reconnects, 1)
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer before-reconnect')
  assert.equal(calls[1].headers.get('Authorization'), 'Bearer after-reconnect')
  assert.deepEqual(received.map((event) => event.type), ['worksheet.created', 'qr.linked'])
})

test('SSE의 401은 공유 refresh 후 새 토큰으로 재요청한다', { timeout: 5000 }, async () => {
  tokens.set({ accessToken: 'expired', refreshToken: 'refresh' })
  const controller = new AbortController()
  respond = ({ path }) => path.endsWith('/refresh') ? success({ accessToken: 'renewed', refreshToken: 'renewed-refresh' })
    : calls.length === 1 ? failure(401, 'AUTH_001')
    : new Response('event: qr.linked\ndata: {"eventId":"e","sessionId":"this-tab"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
  await events.connectEventStream({ signal: controller.signal, onStatus() {}, onReconnect() {}, onEvent: () => controller.abort() })
  assert.deepEqual(paths(), ['GET /api/v1/events', 'POST /api/v1/auth/refresh', 'GET /api/v1/events'])
  assert.equal(calls[2].headers.get('Authorization'), 'Bearer renewed')
})
