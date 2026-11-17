import { fitImageSize, type Size } from './annotation'

/** PDF 용지 안쪽 여백에 맞춰 비율을 유지하고 가로·세로 중앙에 배치한다. 단위는 mm. */
export function fitPdfContent(content: Size, page: Size, margin = 10) {
  const size = fitImageSize(content, {
    width: page.width - margin * 2,
    height: page.height - margin * 2,
  })
  if (!size) throw new Error('PDF에 배치할 수 없는 크기입니다.')

  return {
    ...size,
    x: (page.width - size.width) / 2,
    y: (page.height - size.height) / 2,
  }
}
