/** 백엔드 주소 (끝의 / 제외). 로컬 개발 예: http://localhost:8080 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

/**
 * 백엔드 주소가 있으면 실제 API를 호출한다.
 * 비어 있으면 예시 데이터로 동작해 백엔드 없이도 시연할 수 있다.
 */
export const USE_LIVE_API = API_BASE_URL !== ''
