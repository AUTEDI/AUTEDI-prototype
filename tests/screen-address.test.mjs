import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let screenPath

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ screenPath } = await server.ssrLoadModule('/src/stores/useAppStore.ts'))
})

after(async () => { await server?.close() })

const upload = (id, worksheetId) => ({ id, name: 'a.jpg', meta: '', worksheet: { worksheetId, pageId: 1, imageUrl: '', status: 'READY', settingsEtag: null } })
const base = { page: 'ai', step: 'upload', uploads: [upload('u1', 105)], activeUploadId: 'u1', resumeWorksheetId: null }

test('홈은 /, 업로드 화면은 /ai 주소를 쓴다', () => {
  assert.equal(screenPath({ ...base, page: 'home' }), '/')
  assert.equal(screenPath(base), '/ai')
})

test('생성·검토 중에는 학습지 ID가 들어간 주소를 써서 새로고침해도 다시 연다', () => {
  assert.equal(screenPath({ ...base, step: 'generation' }), '/review/105')
  assert.equal(screenPath({ ...base, step: 'review' }), '/review/105')
})

test('다시 불러오는 중에는 주소의 학습지 ID를 유지한다', () => {
  assert.equal(screenPath({ ...base, step: 'generation', uploads: [], activeUploadId: null, resumeWorksheetId: 77 }), '/review/77')
})

test('서버 ID가 없는 예시 학습지는 검토 중이어도 /ai를 쓴다', () => {
  assert.equal(screenPath({ ...base, step: 'review', uploads: [upload('u1', null)] }), '/ai')
})
