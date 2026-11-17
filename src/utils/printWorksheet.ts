import type { Size } from './annotation'
import { fitPdfContent } from './pdfLayout'

/** 사진과 첨삭만 담은 A4 문서로 브라우저 인쇄 창을 연다. */
export async function printWorksheet(canvas: HTMLCanvasElement, content: Size) {
  const landscape = content.width > content.height
  const page = landscape ? { width: 297, height: 210 } : { width: 210, height: 297 }
  const placement = fitPdfContent(content, page)
  const frame = document.createElement('iframe')
  frame.title = '첨삭 인쇄'
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;border:0;'
  document.body.append(frame)

  try {
    const printWindow = frame.contentWindow
    const printDocument = frame.contentDocument
    if (!printWindow || !printDocument) throw new Error('인쇄 문서를 열 수 없습니다.')

    printDocument.title = 'autedi-첨삭'
    const style = printDocument.createElement('style')
    style.textContent = `
      @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { position: relative; width: ${page.width}mm; height: ${page.height}mm; }
      img {
        position: absolute; display: block;
        left: ${placement.x}mm; top: ${placement.y}mm;
        width: ${placement.width}mm; height: ${placement.height}mm;
        print-color-adjust: exact; -webkit-print-color-adjust: exact;
      }
    `
    printDocument.head.append(style)
    const image = printDocument.createElement('img')
    image.alt = '학습지 사진과 첨삭'
    image.src = canvas.toDataURL('image/png')
    printDocument.body.append(image)
    // 이미지가 준비되기 전에 인쇄하면 빈 페이지가 나올 수 있다.
    await image.decode()

    await new Promise<void>((resolve, reject) => {
      printWindow.addEventListener('afterprint', () => resolve(), { once: true })
      try {
        printWindow.focus()
        printWindow.print()
      } catch (error) {
        reject(error)
      }
    })
  } finally {
    // 인쇄 또는 취소로 창을 닫은 뒤에만 인쇄 문서를 제거한다.
    frame.remove()
  }
}
