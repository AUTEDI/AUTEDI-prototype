# AUTEDI Frontend

영어 도서관·교육기관의 학생 글쓰기 첨삭을 돕는 AI 첨삭 서비스 **AUTEDI**의 프론트엔드입니다.
교사가 학생의 손글씨 과제 이미지를 올리면 AI가 첨삭하고, 교사는 결과를 검토·수정하며 직접 코멘트를 남길 수 있습니다.

## 주요 기능

- **휴대폰 사진 업로드**: AI 첨삭 화면에서 QR 생성 → 휴대폰 스캔 → PC 승인(이미 로그인된 같은 계정은 바로 연결) → 사진 한 장 업로드 → PC 미리보기 자동 반영. 첨삭은 PC에서 시작 버튼으로 실행
- **여러 파일 검토**: 업로드한 파일을 원본 목록에서 선택해 이미지와 첨삭 결과를 전환. 처음 선택할 때 첨삭을 생성하고, 업로드 응답에 완료된 결과가 있으면 추가 요청 없이 사용. 이후에는 파일별 수정 내용·코멘트·작성 초안을 이번 접속 동안 유지
- **첨삭 설정**: 영역(문법·철자 / 어휘·표현 / 문장 구성 / 내용·요약)과 수준(Standard·Advanced)을 영역별로 선택
- **AI 첨삭 검토**: 원본 이미지 위에 첨삭을 겹쳐 보고, 우측 패널에서 항목별로 유지·수정·삭제
- **교사 코멘트**: 이미지에서 영역을 드래그해 밑줄·화살표·네모·삽입 표시와 코멘트를 추가 (AI 첨삭과 구분 표시)

## 기술 스택

React 19 · TypeScript · Vite · Tailwind CSS 4 · Zustand · ESLint · Vercel

## 실행

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173`에서 열립니다. 포트가 이미 사용 중이면 다른 포트로 바꾸지 않고 실행을 멈추니, 기존 서버를 끄고 다시 실행하세요.

모바일은 서버가 생성한 QR의 `/qr-login?token=...` 링크로 진입합니다. PC 승인 후 사진 한 장의 촬영·선택·미리보기·업로드를 지원하며, 토큰 없이 접속하면 QR 스캔 안내를 표시합니다. 실제 휴대폰 테스트에는 QR 링크의 프런트 도메인이 이 코드가 배포된 주소를 가리켜야 합니다. QR과 SSE는 실제 API 모드에서만 동작합니다.

기본 API 주소는 프로젝트 루트의 `.env`에 적습니다. 현재 로컬 개발에서도 이 값을 사용합니다. 다른 개발용 서버를 테스트할 때는 `.env.development.local`에 `VITE_API_BASE_URL`을 지정하면 `.env`보다 우선합니다. 두 파일은 Git에서 제외됩니다. 새 환경에서는 `.env.example`을 `.env`로 복사해 만들 수 있습니다.

```bash
VITE_API_BASE_URL=https://autedi-mvp-dev.duckdns.org
```

- 값이 있으면 실제 백엔드(`{주소}/api/v1`)를 호출하고 로그인 화면부터 시작합니다.
- 비워 두면 백엔드 없이 예시 데이터로 동작합니다(로그인 없음, 시연용).
- REST와 SSE 모두 이 주소를 사용합니다. 백엔드는 프런트 주소 `http://localhost:5173`의 CORS 요청을 허용해야 합니다.
- `.env.development.local`은 `npm run dev`에서 `.env`보다 우선하며, 기본 `npm run build`에는 적용되지 않습니다. 배포용 주소는 `.env` 또는 배포 환경 변수로 설정합니다.
- 환경 변수 변경 후에는 개발 서버를 재시작하세요. 휴대폰에서 로컬 백엔드를 사용하려면 `localhost` 대신 휴대폰에서도 접근할 수 있는 PC의 LAN 주소나 터널 주소가 필요합니다.
- Vercel에서는 Settings → Environment Variables에 같은 이름으로 넣고 다시 배포해야 적용됩니다.

## API 연동 범위

[API 명세서 v1](https://www.notion.so/API-v1-4070cb0f06a680cc8eafe24c6c60cf21) 기준입니다.

| 화면 동작 | API |
| --- | --- |
| 로그인·로그아웃·새로고침 후 복원 | `POST /auth/login`, `POST /auth/logout`, `GET /users/me` |
| 초대 링크(`/signup?token=`)로 회원가입 | `GET /invitations/validate?token=` → `POST /auth/signup` (로그인 없이 호출, 성공 시 로그인 화면으로 이동) |
| 선생님 초대 메일 발송 (원장 계정만 사이드바에 메뉴 표시) | `POST /invitations` (`{ email }`, 메일은 서버가 발송) |
| 토큰 만료 시 자동 재발급 후 재요청 | `POST /auth/refresh` |
| 학습지 업로드 | `POST /worksheets` |
| QR 생성·승인·거절 | `POST /auth/qr-sessions` (첫 사진은 `{}`), `POST .../{sessionId}/approve`, `POST .../{sessionId}/reject` |
| 휴대폰 QR 로그인 | `POST .../link` 또는 `POST .../scan` → `POST .../status` (2초 간격) → `POST .../token` |
| 휴대폰 사진 업로드 | 첫 사진은 `POST /worksheets`, 교체용 QR은 `PUT /worksheets/{id}/file` (최신 `If-Match`) |
| PC 실시간 반영 | `GET /events`에서 `qr.scanned`, `qr.linked`, `worksheet.created`, `worksheet.file_replaced` 수신 후 작업·페이지 이미지 재조회 |
| 첨삭 시작 | `PUT /worksheets/{id}/settings` → `POST .../generations` → `GET .../generations/{genId}` 반복 |
| 검토 화면의 원본·교사 코멘트 | `GET /worksheets/{id}/review` |
| AI 첨삭 목록 | `GET /worksheets/{id}/corrections?status=ACTIVE&pageId={pageId}` |
| 추천 문장 수정 / 삭제 / 삭제 되돌리기 | `PATCH` / `DELETE` / `POST .../restore` (`If-Match` 사용) |
| 교사 코멘트 저장 / 삭제 | `POST /worksheets/{id}/comments` / `DELETE .../comments/{id}` |

아직 API가 없어 화면에서만 동작하는 기능(새로고침하면 사라짐): 피드백 반영 표시, AI 표시·코멘트 위치 이동과 크기 조절, 교사 표시 중 화살표·네모·삽입 표시, 교사 표시 색.

서버 응답의 `isApplied`는 초기 반영 상태에 적용합니다. 이후 반영 버튼으로 바꾼 상태는 아직 서버로 보내지 않습니다.

`worksheetApi.getCorrections(worksheetId, filters, signal)`은 선택적 필터 `status`, `pageId`, `area`, `feedbackType`, `isApplied`를 지원합니다. 화면 조회 시에는 활성 상태와 현재 페이지를 전달하며, 필터가 없으면 해당 쿼리를 생략합니다. `isApplied=false`도 전송하고, 문법 영역 코드는 `GRAMMAR_SPELLING`과 `GRAMMAR_MECHANICS` 모두 지원합니다. 목록 응답의 `result`는 `{ items: [...], total: 숫자 }` 형식을 사용하며, 요청 함수는 목록을 `data`, 전체 건수를 `total`로 반환합니다. 기존 배열과 `{ corrections: [...] }` 형식도 지원합니다.

업로드 응답은 학습지 정보만 있는 형식과 `worksheet`, `generation`, `corrections`, `comments`가 함께 있는 형식을 지원합니다. 첨삭 좌표는 `NORMALIZED_0_1`을 퍼센트로 변환하고, 단일 페이지에서는 영역의 `pageId`가 생략되어도 표시합니다. 다중 페이지에서 페이지를 식별할 수 없는 첨삭은 피드백 목록에만 표시합니다.

각 파일은 첫 페이지만 표시합니다. 한 PDF 파일 안의 여러 페이지를 전환하는 기능은 아직 지원하지 않습니다.

응답 변환, 중복 분석 방지, 파일별 첨삭 상태와 저장 중 파일 전환 방지는 `npm run test:review`로 검증할 수 있습니다. 테스트는 통신을 대체하며 실제 서버에 요청하지 않습니다.

생성 화면은 생성 요청과 3초 간격 상태 조회 응답의 `status`·`stage`로 표시합니다. `RUNNING/OCR`은 이미지 인식, `RUNNING/AI_CORRECTION`은 AI 첨삭 생성, `SUCCEEDED/COMPLETED`는 완료된 결과를 불러오는 상태입니다. 대기 중에는 단계를 완료로 표시하지 않으며, 시간에 따른 진행률은 사용하지 않습니다. 기존 생성 작업을 이어서 조회하거나 실패한 작업을 재시도할 때도 같은 표시를 사용합니다.

QR 테스트도 같은 명령에 포함됩니다. 승인·기존 계정 연결·첫 사진 및 교체 업로드·중복 이벤트·미리보기 갱신·SSE 재연결과 토큰 재발급을 검증합니다. PC는 탭당 SSE 연결 하나를 유지하고, 연결 종료 시 최대 30초 간격까지 백오프하며 최신 토큰으로 다시 연결합니다. 이미 수신한 작업 ID의 조회 실패는 재시도할 수 있습니다. 다만 최초 `worksheet.created` 이벤트 자체를 단절 중 놓친 경우에는 새 작업 ID를 복구할 세션 조회/이벤트 재전송 API가 아직 명세에 없어 자동 복구하지 못합니다. 첨삭 생성 완료 확인은 기존 폴링을 유지합니다.

## 폴더 구조

```text
src/
  apis/         API 클라이언트(/api/v1, 토큰 재발급, ETag), 에러 코드, 엔드포인트,
                응답 변환(mappers), 화면용 서비스(reviewService: 실제/예시 구현)
  components/   common(버튼·모달 등) · layout · home · review-flow(업로드~생성) · review(검토 화면)
  constants/    첨삭 설정, 단계 문구, 예시 첨삭 데이터
  hooks/        드래그 같은 공통 훅
  pages/        LoginPage, SignupPage, HomePage, ReviewPage, MobileUploadPage
  stores/       Zustand 상태 (인증, 앱 전체, 검토 화면, PC QR 세션)
  types/        도메인 타입
  utils/        좌표 계산, className 도우미
```

## 협업 규칙

**작업 순서**: 이슈 생성 → 브랜치 생성 → 커밋 → PR → `main` 병합 (`main`에 직접 push 금지)
PR 전에 `npm run lint`, `npm run build`가 통과해야 합니다.

**브랜치**: `<type>/<issue-number>-<short-description>` 예) `feature/114-add-typescript`

**커밋**: `<type>: 내용` 예) `feat: 첨삭 결과 패널 추가`

| type       | 용도                             |
| ---------- | -------------------------------- |
| `feat`     | 기능 추가                        |
| `fix`      | 버그 수정                        |
| `refactor` | 동작 변화 없는 구조 개선         |
| `style`    | CSS·UI 스타일 수정               |
| `docs`     | 문서 수정                        |
| `test`     | 테스트 추가·수정                 |
| `chore`    | 설정, 라이브러리, 빌드 관련 작업 |

**코딩 컨벤션**

- 컴포넌트·파일·타입명은 PascalCase, 함수·변수명은 camelCase
- 스타일은 Tailwind 유틸리티 클래스로 작성하고, 공통 색·그림자·기준점은 `src/index.css`의 `@theme` 토큰을 쓴다
- `any` 사용을 피하고 필요한 타입을 명시
- 재사용 UI는 `components`, 화면은 `pages`, API 요청 코드는 `apis` 폴더에서 관리

## 배포

`main`에 병합되면 Vercel이 자동 배포하고, PR마다 미리보기 주소가 만들어집니다.
