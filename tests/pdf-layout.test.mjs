import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { jsPDF } from 'jspdf'

let server
let fitPdfContent

before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  ;({ fitPdfContent } = await server.ssrLoadModule('/src/utils/pdfLayout.ts'))
})

after(async () => { await server?.close() })

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`)

for (const [name, content] of [
  ['세로 학습지', { width: 600, height: 900 }],
  ['가로 학습지와 옆 코멘트', { width: 1200, height: 650 }],
  ['정사각형 사진', { width: 800, height: 800 }],
  ['길쭉한 사진', { width: 200, height: 1800 }],
  ['소수점 크기로 캡처된 사진', { width: 421.375, height: 583.625 }],
]) {
  test(`${name}는 A4 안에 비율을 유지하고 좌우·상하 여백을 같게 배치한다`, () => {
    const pdf = new jsPDF({ orientation: content.width > content.height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
    const page = { width: pdf.internal.pageSize.getWidth(), height: pdf.internal.pageSize.getHeight() }
    const image = fitPdfContent(content, page)

    close(image.width / image.height, content.width / content.height)
    close(image.x, page.width - image.x - image.width)
    close(image.y, page.height - image.y - image.height)
    assert.ok(image.x >= 10 - 1e-8 && image.y >= 10 - 1e-8)
    close(Math.min(image.x, image.y), 10)
    // 편집 화면의 확대율이 달라도 같은 출력 크기와 위치를 사용한다.
    const zoomed = fitPdfContent({ width: content.width * 0.6, height: content.height * 0.6 }, page)
    for (const key of ['x', 'y', 'width', 'height']) close(zoomed[key], image[key])
  })
}

test('사진이 로드되지 않았거나 용지 여백보다 작으면 빈 PDF를 만들지 않는다', () => {
  assert.throws(() => fitPdfContent({ width: 0, height: 900 }, { width: 210, height: 297 }))
  assert.throws(() => fitPdfContent({ width: 600, height: 900 }, { width: 10, height: 10 }))
})
