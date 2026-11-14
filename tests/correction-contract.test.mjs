import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let toAiFeedback

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ toAiFeedback } = await server.ssrLoadModule('/src/apis/mappers.ts'))
})

after(async () => { await server?.close() })

const base = {
  id: 1,
  etag: 'W/"1"',
  generationId: 9,
  source: 'AI',
  area: 'GRAMMAR_SPELLING',
  feedbackType: 'CORRECTION',
  originalText: 'line one\nline two\nline three',
  aiInitialContent: 'AI text',
  content: 'AI text',
  explanation: 'why',
  regions: [],
  editedByTeacher: false,
  explanationStale: false,
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
}

const region = (pageId, y) => ({ pageId, x: 0.1, y, width: 0.5, height: 0.03 })

test('v1.1 여러 줄 첨삭은 anchor가 null이어도 모든 줄을 표시한다', () => {
  const regions = [region(7, 0.2), region(7, 0.25), region(7, 0.3)]
  const [item] = toAiFeedback([{ ...base, anchor: null, anchors: [{}, {}, {}], regions, targetRegions: regions }], 7, 1)
  assert.equal(item.mark.top, 20)
  assert.deepEqual(item.extraMarks.map((box) => box.top), [25, 30])
})

test('여러 페이지면 현재 페이지 줄만 그린다', () => {
  const regions = [region(7, 0.9), region(8, 0.05)]
  const [item] = toAiFeedback([{ ...base, regions }], 8, 2)
  assert.equal(item.mark.top, 5)
  assert.equal(item.extraMarks.length, 0)
})

test('edit와 확인 필드를 변환하고, edit=null이면 content로 표시한다', () => {
  const [insert, plain] = toAiFeedback([
    { ...base, edit: { operation: 'INSERT', text: 'a', position: 'BEFORE' }, requiresReview: true, locationUncertain: true },
    { ...base, id: 2, edit: null, content: 'teacher', editedByTeacher: true },
  ], null, 1)
  assert.deepEqual(insert.edit, { operation: 'INSERT', text: 'a', position: 'BEFORE' })
  assert.equal(insert.requiresReview, true)
  assert.equal(insert.locationUncertain, true)
  assert.equal(plain.edit, null)
  assert.equal(plain.noteText, 'teacher')
  assert.equal(plain.aiSuggestion, 'AI text')
  assert.equal(plain.editedByTeacher, true)
})

test('알 수 없는 동작·경고 코드·추가 필드가 와도 깨지지 않는다', () => {
  const [item] = toAiFeedback([
    { ...base, edit: { operation: 'MOVE', text: 'x', position: null }, warnings: ['NEW_CODE', { code: 'X' }], somethingNew: 1 },
  ], null, 1)
  assert.equal(item.edit, null)
})

test('삭제된 첨삭은 content가 비어 있어도 화면에 그리지 않는다', () => {
  assert.equal(toAiFeedback([{ ...base, status: 'DELETED', content: '' }], null, 1).length, 0)
})

test('내용이 빈 삭제 동작은 노트에 삭제라고 적는다', () => {
  const [item] = toAiFeedback([{ ...base, content: '', edit: { operation: 'DELETE', text: 'the', position: null } }], null, 1)
  assert.equal(item.noteText, '삭제')
})
