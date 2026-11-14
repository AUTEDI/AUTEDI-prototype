import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let placeAiNoteAbove
let layoutAiNotesAbove

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ placeAiNoteAbove, layoutAiNotesAbove } = await server.ssrLoadModule('/src/utils/annotation.ts'))
})

after(async () => { await server?.close() })

const photo = { x: 0, y: 0, width: 1000, height: 1000 }
const size = { width: 80, height: 20 }
const intersects = (a, b) => a.x < b.x + size.width && b.x < a.x + size.width && a.y < b.y + size.height && b.y < a.y + size.height

test('노트는 표시 위쪽에서 박스 높이의 35%만큼 내려 줄 사이에 놓인다', () => {
  // 표시 위쪽 300px, 높이 40px → 노트 아래쪽은 314px
  const point = placeAiNoteAbove(photo, size, { left: 10, top: 30, width: 10, height: 4 })
  assert.equal(point.y + size.height, 314)
  assert.equal(point.x, 150 - size.width / 2)
})

test('바로 위아래 줄의 노트가 겹치면 옆으로 비켜 놓는다', () => {
  const notes = [
    { id: 'a', size, mark: { left: 40, top: 10, width: 10, height: 2 }, anchor: 'center' },
    { id: 'b', size, mark: { left: 40, top: 11.5, width: 10, height: 2 }, anchor: 'center' },
  ]
  const positions = layoutAiNotesAbove(photo, notes)
  assert.ok(!intersects(positions.a, positions.b))
  // 먼저 놓인 위쪽 노트는 기본 자리 그대로다.
  assert.deepEqual(positions.a, placeAiNoteAbove(photo, size, notes[0].mark, 'center'))
})

test('겹치지 않으면 모두 기본 자리에 둔다', () => {
  const notes = [
    { id: 'a', size, mark: { left: 10, top: 10, width: 10, height: 2 }, anchor: 'center' },
    { id: 'b', size, mark: { left: 60, top: 10, width: 10, height: 2 }, anchor: 'center' },
  ]
  const positions = layoutAiNotesAbove(photo, notes)
  for (const note of notes) assert.deepEqual(positions[note.id], placeAiNoteAbove(photo, size, note.mark, 'center'))
})

test('삽입 표시 코멘트는 꺾쇠가 열린 쪽인 아래, 꺾쇠 위치 가운데에 놓인다', () => {
  // 표시 아래쪽 340px → 코멘트 위쪽은 6px 아래인 346px. 앞(BEFORE) 삽입이면 표시 왼쪽 끝(100px)이 가운데
  const point = placeAiNoteAbove(photo, size, { left: 10, top: 30, width: 10, height: 4 }, 'start')
  assert.equal(point.y, 346)
  assert.equal(point.x, 100 - size.width / 2)
  const after = placeAiNoteAbove(photo, size, { left: 10, top: 30, width: 10, height: 4 }, 'end')
  assert.equal(after.x, 200 - size.width / 2)
})
