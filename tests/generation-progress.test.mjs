import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { response } from './fixtures/review-response.mjs'

let server, service, worksheetApi, originalApi, ApiError, GenerationStep
let activeGeneration, updates, calls
const worksheet = { worksheetId: 16, pageId: 16, status: 'DRAFT', settingsEtag: null }
const settings = [{ id: 'grammar', selected: true, level: 'Standard' }]
const result = (data) => ({ data })
const flush = () => new Promise(setImmediate)

before(async () => {
  server = await createServer({
    configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_API_BASE_URL': '"https://api.example.test"' },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  service = (await server.ssrLoadModule('/src/apis/reviewService.ts')).reviewService
  worksheetApi = (await server.ssrLoadModule('/src/apis/worksheetApi.ts')).worksheetApi
  originalApi = { ...worksheetApi }
  ApiError = (await server.ssrLoadModule('/src/apis/errors.ts')).ApiError
  GenerationStep = (await server.ssrLoadModule('/src/components/review-flow/GenerationStep.tsx')).GenerationStep
})

beforeEach(() => {
  calls = []
  activeGeneration = { ...response.result.generation, id: 82, status: 'RUNNING', stage: 'OCR' }
  updates = [{ status: 'RUNNING', stage: 'AI_CORRECTION' }, { status: 'SUCCEEDED', stage: 'COMPLETED' }]
  Object.assign(worksheetApi, originalApi, {
    saveSettings: async () => result(null),
    startGeneration: async () => { calls.push('start'); return result(activeGeneration) },
    getGeneration: async (_worksheetId, id) => {
      calls.push(`poll:${id}`)
      assert.equal(id, activeGeneration.id)
      const update = updates.shift()
      assert.ok(update, '예상보다 많은 상태 조회')
      activeGeneration = { ...activeGeneration, ...update }
      return result(activeGeneration)
    },
    get: async () => result({ ...response.result.worksheet, latestGenerationId: activeGeneration.id }),
    retryGeneration: async (_worksheetId, id) => { calls.push(`retry:${id}`); return result(activeGeneration) },
    getReview: async () => { calls.push('review'); return result(response.result) },
    getCorrections: async () => result(response.result.corrections),
    getPageImage: async () => { throw new Error('이미지 URL 대체 경로 사용') },
  })
})

after(async () => {
  if (worksheetApi) Object.assign(worksheetApi, originalApi)
  await server?.close()
})

test('생성 응답부터 동일 작업을 3초 간격으로 조회하고 성공 뒤에만 결과를 연다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  updates.unshift({ status: 'RUNNING', stage: 'OCR' })
  const progress = []
  const pending = service.generateReview({ worksheet, settings, onProgress: value => progress.push(value) })
  await flush()
  assert.deepEqual(progress, [{ id: 82, status: 'RUNNING', stage: 'OCR' }])
  t.mock.timers.tick(2999)
  await flush()
  assert.deepEqual(calls, ['start'])
  t.mock.timers.tick(1)
  await flush()
  assert.equal(progress.at(-1).stage, 'OCR')
  t.mock.timers.tick(3000)
  await flush()
  assert.equal(progress.at(-1).stage, 'AI_CORRECTION')
  assert.ok(!calls.includes('review'))
  t.mock.timers.tick(3000)
  const review = await pending
  assert.deepEqual(progress.at(-1), { id: 82, status: 'SUCCEEDED', stage: 'COMPLETED' })
  assert.equal(review.worksheetId, 16)
  assert.deepEqual(calls, ['start', 'poll:82', 'poll:82', 'poll:82', 'review'])
})

test('이미 실행 중인 작업을 이어 조회할 때도 현재 서버 단계를 전달한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  worksheetApi.startGeneration = async () => { throw new ApiError({ status: 409, code: 'GENERATION_001' }) }
  const progress = []
  const pending = service.generateReview({ worksheet: { ...worksheet, status: 'PROCESSING' }, settings, onProgress: value => progress.push(value) })
  await flush()
  assert.deepEqual(progress, [{ id: 82, status: 'RUNNING', stage: 'AI_CORRECTION' }])
  t.mock.timers.tick(3000)
  await pending
  assert.deepEqual(progress.at(-1), { id: 82, status: 'SUCCEEDED', stage: 'COMPLETED' })
  assert.deepEqual(calls, ['poll:82', 'poll:82', 'review'])
})

test('최초 생성 응답이 이미 완료 상태면 완료를 알리고 추가 조회 없이 결과를 가져온다', async () => {
  activeGeneration.status = 'SUCCEEDED'
  activeGeneration.stage = 'COMPLETED'
  const progress = []
  await service.generateReview({ worksheet, settings, onProgress: value => progress.push(value) })
  assert.deepEqual(progress, [{ id: 82, status: 'SUCCEEDED', stage: 'COMPLETED' }])
  assert.deepEqual(calls, ['start', 'review'])
})

test('재시도 응답의 새 작업 ID와 단계로 조회한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  activeGeneration.id = 83
  const progress = []
  const pending = service.retryReview({ worksheet, generationId: 82, onProgress: value => progress.push(value) })
  await flush()
  assert.deepEqual(progress, [{ id: 83, status: 'RUNNING', stage: 'OCR' }])
  t.mock.timers.tick(3000)
  await flush()
  assert.equal(progress.at(-1).stage, 'AI_CORRECTION')
  t.mock.timers.tick(3000)
  await pending
  assert.deepEqual(calls, ['retry:82', 'poll:83', 'poll:83', 'review'])
})

test('실패 상태를 전달하고 결과 조회 없이 기존 재시도 정보를 보존한다', async () => {
  activeGeneration.status = 'FAILED'
  activeGeneration.error = { code: 'OCR_FAILED', message: '글자를 인식하지 못했어요.', retryable: true }
  const progress = []
  await assert.rejects(service.generateReview({ worksheet, settings, onProgress: value => progress.push(value) }), error => {
    assert.equal(error.generationId, 82)
    assert.equal(error.retryable, true)
    return true
  })
  assert.equal(progress[0].status, 'FAILED')
  assert.deepEqual(calls, ['start'])
})

test('취소한 생성 작업은 추가 단계 알림이나 결과 조회를 하지 않는다', async () => {
  const controller = new AbortController()
  const progress = []
  await assert.rejects(service.generateReview({ worksheet, settings, signal: controller.signal, onProgress: value => {
    progress.push(value)
    controller.abort()
  } }), { name: 'AbortError' })
  assert.equal(progress.length, 1)
  assert.deepEqual(calls, ['start'])
})

test('화면은 서버 단계만 표시하고 대기 중이나 완료 확인 전에는 전체 완료로 표시하지 않는다', () => {
  for (const [generation, current, completed] of [
    [null, -1, 0],
    [{ id: 82, status: 'PENDING', stage: 'QUEUED' }, -1, 0],
    [{ id: 82, status: 'RUNNING', stage: 'OCR' }, 0, 0],
    [{ id: 82, status: 'RUNNING', stage: 'AI_CORRECTION' }, 1, 1],
    [{ id: 82, status: 'RUNNING', stage: 'COMPLETED' }, 2, 2],
    [{ id: 82, status: 'SUCCEEDED', stage: 'COMPLETED' }, -1, 3],
  ]) {
    const html = renderToStaticMarkup(createElement(GenerationStep, { generation }))
    const items = [...html.matchAll(/<li\b[^>]*>.*?<\/li>/g)].map(match => match[0])
    assert.equal(items.length, 3)
    assert.equal(items.filter(item => /aria-hidden="true">✓/.test(item)).length, completed)
    assert.equal(items.findIndex(item => item.includes('aria-current="step"')), current)
    assert.ok(!html.replace(/<[^>]*>/g, '').includes('%'))
    assert.ok(!html.includes('선택 영역 분석'))
    assert.equal(html.includes('AI 첨삭이 완료됐어요'), generation?.status === 'SUCCEEDED')
  }
})
