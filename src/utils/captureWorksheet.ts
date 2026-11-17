/** 학습지 사진 경계 안쪽만 캡처한다. 바깥 객체와 편집 상태는 출력 크기에 영향을 주지 않는다. */
export async function captureWorksheet(board: HTMLElement, photo: HTMLElement, pixelRatio = 2) {
  const { toCanvas } = await import('html-to-image')
  const photoRect = photo.getBoundingClientRect()
  const photoStyle = getComputedStyle(photo)
  const photoWidth = parseFloat(photoStyle.width)
  const photoHeight = parseFloat(photoStyle.height)
  if (![photoRect.width, photoRect.height, photoWidth, photoHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('학습지 사진이 아직 준비되지 않았습니다.')
  }
  const size = { width: photoRect.width, height: photoRect.height }
  const snapshot = document.createElement('div')
  snapshot.style.position = 'relative'
  snapshot.style.width = `${size.width}px`
  snapshot.style.height = `${size.height}px`
  snapshot.style.overflow = 'hidden'

  // 사진을 출력 영역의 원점에 놓고, 화면의 확대율을 유지한다.
  // 화면에서 사진 일부가 캔버스 밖으로 나가 있어도 사진 전체를 출력한다.
  const photoCopy = photo.cloneNode(true) as HTMLElement
  Object.assign(photoCopy.style, {
    left: '0', top: '0', transformOrigin: '0 0',
    transform: `scale(${size.width / photoWidth}, ${size.height / photoHeight})`,
    transition: 'none', overflow: 'hidden', boxShadow: 'none',
  })
  snapshot.append(photoCopy)

  // 교사 코멘트는 사진과 별도의 레이어에 있으므로 사진 기준 좌표로 옮긴다.
  // 사진 경계에 걸친 객체는 안쪽 부분만 남고 바깥 부분은 잘린다.
  board.querySelectorAll<HTMLElement>('[data-teacher-note]').forEach((note) => {
    const rect = note.getBoundingClientRect()
    const copy = note.cloneNode(true) as HTMLElement
    copy.style.left = `${rect.left - photoRect.left}px`
    copy.style.top = `${rect.top - photoRect.top}px`
    snapshot.append(copy)
  })

  snapshot.querySelectorAll('[data-pdf-hide]').forEach((node) => node.remove())
  snapshot.querySelectorAll<HTMLElement>('[data-pdf-class]').forEach((node) => {
    node.className = node.dataset.pdfClass!
    node.removeAttribute('data-pdf-class')
  })

  const host = document.createElement('div')
  host.dataset.pdfSnapshot = ''
  host.setAttribute('aria-hidden', 'true')
  host.inert = true
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${size.width}px;height:${size.height}px;pointer-events:none;`
  host.append(snapshot)
  document.body.append(host)
  try {
    const canvas = await toCanvas(snapshot, {
      ...size,
      pixelRatio,
      style: { backgroundImage: 'none', backgroundColor: '#ffffff' },
    })
    return { canvas, size }
  } finally {
    host.remove()
  }
}
