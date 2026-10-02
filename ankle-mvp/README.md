# Ankle Studio — 발목 수동 작도 MVP

JPG/PNG 영상 위에 사용자가 직접 기준점을 지정하고, 코드가 각도·거리를 계산하는 웹 프로토타입입니다. ROM 운동제한율은 별도 입력값으로 계산합니다.

## 가장 빠른 실행 (설치 없이)

1. ZIP을 압축 해제합니다.
2. `ankle-mvp/index.html`을 Chrome 또는 Edge에서 엽니다.
3. **도형 연습**을 누르고 두 선의 양 끝을 순서대로 클릭합니다.
4. **미검수 또는 불확실한 결과임을 확인…**에 체크하고 **영상 측정값 계산**을 누릅니다.
5. ROM에 `10, 20, 10, 15`를 입력하면 총 55°, 제한율 50%, `6급 2항 8121 후보`가 표시됩니다.

파일을 직접 열어도 작도, 수정, 계산, PNG/JSON 내보내기가 됩니다. AI 및 법령 API 호출에는 아래의 로컬 서버가 필요합니다. 인터넷에 올리거나 계정을 연결할 필요는 없습니다.

## 로컬 서버 실행

Python 3.10 이상이 필요합니다. 외부 Python 패키지는 사용하지 않습니다.

Windows에서는 `start_windows.bat`을 더블클릭하세요. 또는 압축 해제한 `ankle-mvp` 폴더에서 터미널을 열고:

```bash
python server.py
```

브라우저에서 **http://127.0.0.1:8765**에 접속합니다. 종료하려면 터미널에서 `Ctrl+C`를 누릅니다. 포트가 사용 중이면 `python server.py --port 8766`으로 실행합니다.

## GitHub에 직접 업로드

기존 저장소 내용은 이 작업에서 읽거나 변경하지 못했습니다. 기존 `run_measure.py` 등과의 통합본이 아닌, 추가 가능한 독립 MVP입니다.

1. ZIP을 압축 해제합니다.
2. GitHub 저장소에서 **Add file → Upload files**를 엽니다.
3. 압축 파일 자체가 아니라 **압축 해제한 `ankle-mvp` 폴더**를 업로드합니다. 폴더 업로드가 안 되는 환경에서는 GitHub Desktop을 사용하세요.
4. 추가 파일 경로가 `ankle-mvp/index.html`, `ankle-mvp/web/app.js` 등인지 확인하고 커밋합니다.
5. 기존 저장소의 파일은 삭제하거나 덮어쓰지 않습니다.

실제 의료영상, 결과 JSON, `.env` 및 API 키는 GitHub에 올리지 마세요. 이 패키지에는 실제 환자 영상과 비밀키가 포함되어 있지 않습니다. 기본 GitHub Pages의 정적 호스팅은 Python 서버를 실행하지 않으므로 AI/법령 API를 사용할 수 없습니다. 정적 작도 기능만 필요하면 `index.html`과 `web/`를 동일한 상대 경로로 배포할 수 있습니다.

## 선택 기능 1: 국가법령정보 OPEN API

OC와 해당 API 이용권한이 있는 경우 서버 실행 전에 환경변수를 설정합니다. `.env.example`은 참고 템플릿이며 **자동 로드되지 않습니다**.

Windows PowerShell:

```powershell
$env:LAW_API_OC="본인의_OC"
python server.py
```

macOS/Linux:

```bash
export LAW_API_OC='본인의_OC'
python3 server.py
```

화면에서 **관련 법령·판례 검색**을 누르면 발목 검색어와 ROM 후보 검색어로 검색하고 판례 ID로 중복을 제거합니다. 목록에서 판례 원문을 조회할 수 있습니다. 자동으로 영상을 보내지 않으며 이 API에는 검색어와 문서 ID만 보냅니다.

- `law_api.py`: `search_law`, `get_law`, `search_precedents`, `get_precedent`, `search_related`
- OC 미설정, HTTP 오류, 통신 오류, 비정상 JSON은 상태값으로 반환합니다.
- OC는 브라우저에 반환하지 않습니다.
- 실 OC가 없어 인증된 실서비스 호출은 검증하지 못했습니다. API 이용승인·네트워크 허용 및 응답 정책에 따라 연결 조정이 필요할 수 있습니다.
- 판례 본문에서 압박률/ROM·법원 판단을 자동 추출하거나 현재 사례와 자동 비교하지 않습니다. 원문 조회까지 구현되었습니다.

## 선택 기능 2: AI 작도 검수

공식 OpenAI Chat Completions API로 원본과 작도 표시 PNG를 함께 전송하는 연결 코드가 포함됩니다. 실제 AI 해부학적 정확도를 임상 검증한 제품이 아닙니다.

서버 실행 전에 `OPENAI_API_KEY`와 `OPENAI_MODEL`을 환경변수로 설정합니다. 모델 ID는 본인 계정에서 사용할 수 있고 **이미지 입력, Chat Completions, JSON mode**를 지원하는 것을 사용하세요. 모델 ID와 키를 소스에 넣지 마세요.

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="본인의_API_키"
$env:OPENAI_MODEL="사용할_모델_ID"
python server.py
```

macOS/Linux:

```bash
export OPENAI_API_KEY='본인의_API_키'
export OPENAI_MODEL='사용할_모델_ID'
python3 server.py
```

화면의 외부 영상 전송 동의를 체크하고 **AI 검수 요청**을 눌러야 호출됩니다. 원본 크기의 최대 변을 1600 px로 축소한 원본·표시본을 전송하며 기하학 계산은 원본 좌표에서 합니다. 식별정보를 먼저 제거해야 합니다. API 서버는 영상과 응답을 디스크에 저장하지 않습니다.

- `PASS`: 모든 사용 점의 검수 상태가 PASS.
- `REVIEW_REQUIRED`: 한 점 이상 FAIL. 문제 점을 수정해야 계산을 진행할 수 있습니다.
- `UNCERTAIN`: 불명확한 점이 있거나 검수할 수 없음. 사용자의 확인 후 수동 계산 가능.
- 키/모델 미설정 및 API 오류: `performed=false`, `UNCERTAIN`. 검수된 것처럼 PASS로 표시하지 않습니다.
- 모델의 좌표 필드는 폐기합니다. AI는 점을 자동 이동하지 않습니다.
- 작도점/영상/촬영방향/측정 측이 바뀌면 이전 검수와 측정값은 무효화됩니다.
- 요청 도중 작도가 바뀌면 늦게 온 이전 응답을 적용하지 않습니다.
- 도형 연습 이미지는 AI 검수하지 않습니다.

키가 제공되지 않아 실제 모델 호출·해부학적 검수 성능은 검증하지 못했습니다. 자동 테스트의 PASS/FAIL 검증은 응답 처리 로직 테스트이며, 실제 의료영상 정확도 테스트가 아닙니다.

## 측정 방식

### AP / Mortise

P1–P2: 경골 원위 관절면의 방향. P3–P4: 거골 상부 관절면의 방향.

두 선의 방향 벡터를 A, B라 할 때 `acos(abs(dot(A,B))/(|A|×|B|))`를 도 단위로 계산하여 0~90°의 최소각을 표시합니다. P1/P2 등을 반대로 지정해도 같은 최소각입니다. 길이 0인 선은 계산하지 않습니다.

### Lateral

P5: 경골 원위 관절면 뒤쪽 끝. P6: 사용자가 선택한 가장 가까운 거골 관절면 지점. 원본 좌표상 두 점 사이의 픽셀 거리를 계산합니다. 이는 전체 관절면의 실제 최단거리임을 자동 보증하지 않습니다.

- 보정 없음: `anterior_translation_mm=null`, `physical_scale_available=false`.
- 보정 있음: 사용자가 입력한 `mm/원본 px`와 보정 근거가 모두 있어야 mm로 환산.
- DICOM PixelSpacing, 촬영 배율/기하 왜곡의 자동 보정은 제공하지 않습니다.

### ROM

입력은 배굴·척굴·외번·내번의 실제 운동범위입니다. 표준값은 20°·40°·20°·30°, 총 110°입니다.

`운동제한율 = max(0, (110 - 실제 ROM 합계) / 110 × 100)`

| 남은 총 ROM | ROM 기준 후보 |
|---|---|
| 82.5° 초과 | 해당 구간 없음 |
| 55° 초과 ~ 82.5° 이하 | 7급 8122 |
| 27.5° 초과 ~ 55° 이하 | 6급 2항 8121 |
| 27.5° 이하 | 6급 1항 8117 |

한쪽 발목 하나의 ROM 경로만 비교합니다. 입력값이 표준각도를 넘으면 경고하고 원값을 보존하며 제한율만 0% 하한을 적용합니다. 빈칸·음수·비유한 숫자·180° 초과는 거부합니다. 음수 고정각/강직 등은 이 단순 입력 모델로 평가할 수 없습니다. 분기는 반올림 전 총각도를 사용합니다.

## 저장

- JSON: 원본 크기·파일명·SHA-256(지원 브라우저), 정규화 좌표, 최초 좌표, 수정 이력, 검수 시점 좌표 및 결과, 영상 측정, ROM 및 기준 출처, 법령 검색.
- PNG: 원본 해상도 영상과 작도점·선. 원본을 대체하지 않습니다.
- JSON에 원본 이미지 바이너리는 포함하지 않습니다. 원본과 결과 파일을 함께 보관해야 재검토할 수 있습니다.
- 세션 종료/새 평가 전 내보내기를 하세요. 자동 보관·클라우드 업로드·JSON 재불러오기는 없습니다.
- 서버는 루프백에만 바인딩하고 지정 정적 파일만 제공합니다. 임의 `.env`/Python 파일을 웹에서 열 수 없습니다. 공개 서비스용 인증·접근제어를 갖춘 서버는 아닙니다.

## 근거와 범위

- [Noh et al. (2025), Automated radiography assessment of ankle joint instability using deep learning](https://doi.org/10.1038/s41598-025-99620-6)
- [국가유공자법 시행규칙 별표 3, 2021-09-27 개정본](https://www.law.go.kr/flDownload.do?bylClsCd=110201&flSeq=151144423&gubun=)
- [국가유공자법 시행규칙 별표 4, 2024-04-02 개정본](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=156423917&gubun=)
- [법령 OPEN API 안내](https://open.law.go.kr/LSO/openApi/openApiManual.do)
- [판례 목록 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide)
- [판례 상세 API](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide)
- [OpenAI Chat API reference](https://developers.openai.com/api/reference/resources/chat)

법령 원문은 2026-10-02에 위 특정 개정본을 확인했습니다. 현재 적용 법령이라는 자동 보증이 아니며 개별 사건 적용일과 현행성은 별도 검토해야 합니다. P1~P6와 클릭 순서는 프로젝트가 정의한 운영 규칙입니다. 연구 논문은 작도 개념의 참고 자료이며 이 앱의 정확도를 검증한 논문이 아닙니다.

Talar Tilt, 사용자 지정 두 점 거리, ROM 제한율은 서로 다른 지표입니다. 영상 각도에서 ROM 또는 보험 지급률을 추정하지 않습니다. 일반 JPG/PNG에서 측정한 값으로 stress radiography의 진단 임계값을 자동 적용하지 않습니다. 인공관절·관절 불안정성·KL 등급·다른 부위 장해·보훈 전체 기준·보험 전체 기준은 구현 범위 밖입니다.

## 기존 프로젝트와의 관계

첨부 `프로젝트 목표`의 발목 MVP 우선순위를 이번 구현 범위로 선택했습니다. 첨부 `GitHub 프로젝트 작업 지시서`의 척추 산재/보훈 규칙, 기존 M1~M4 보존 및 측정 파이프라인 연결은 기존 코드 확인이 필요하므로 완료했다고 주장하지 않습니다. 독립 폴더를 추가하므로 기존 기능을 교체하지 않습니다. `rating_engine.py` 대신 브라우저에서 독립 실행할 수 있는 `web/core.js`가 기하학·ROM 규칙 엔진을 담당합니다.

## 개발 및 검증

앱 사용에 Node.js 설치는 필요하지 않습니다. 개발 검사에는 Node.js 18 이상 및 Python 3.10 이상을 사용합니다. 외부 npm 설치도 필요하지 않습니다.

```bash
npm run build
npm run lint
npm test
```

`lint`는 JS 구문 검사와 Python 컴파일 검사입니다. 별도 스타일 린터를 의미하지 않습니다. `dist/`는 정적 앱 복사본입니다.

브라우저 회귀 테스트는 `tests/browser.cjs`에 있습니다. Playwright와 Chromium이 있는 개발 환경에서 아래와 같이 실행할 수 있습니다. 로컬 서버가 실행 중이어야 합니다.

```bash
node tests/browser.cjs
```

테스트 상세와 실행 결과는 `docs/VALIDATION.md`를 확인하세요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html`, `web/styles.css` | 한국어 반응형 화면 |
| `web/app.js` | 작도·검수·저장 흐름 |
| `web/core.js` | 기하학·ROM·검수 상태 검증 |
| `server.py` | 선택형 로컬 HTTP 서버 |
| `ai_review.py`, `review_prompt.txt` | 선택형 AI 작도 검수 |
| `law_api.py` | 법령·판례 API와 응답 정규화 |
| `tests/` | 계산·오류·화면 회귀 테스트 |
| `docs/` | 검증 결과와 후속 작업 |

이 프로젝트는 교육·연구용 프로토타입으로, 의료진의 영상 판독이나 공식 장해판정을 대체하지 않습니다.
