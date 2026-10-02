# 프로젝트 목표

발목 X-ray와 실제 관절가동범위(ROM)를 이용하여 사용자가 직접 해부학적 기준점을 작도하고, AI는 사용자의 작도가 명백하게 잘못된 경우만 검수하며, 프로그램이 각도·거리·ROM 제한율을 계산하는 웹 기반 프로토타입을 구현한다.

이 프로젝트의 목적은 AI가 독자적으로 의료영상을 진단하는 것이 아니다.

핵심 원칙은 다음과 같다.

사용자 수동 작도  
→ AI 작도 오류 검수  
→ 사용자가 필요 시 수정  
→ 코드가 기하학적 값 계산  
→ 별도 입력된 ROM 계산  
→ 관련 장해 기준 후보 표시

AI가 사용자를 대신해 기준점을 자동 생성하거나 강제로 수정해서는 안 된다.

---

# 1. 프로젝트 범위

이번 단계에서는 다음 기능만 구현한다.

1. JPG 또는 PNG 형식의 발목 X-ray 업로드
2. AP / Mortise / Lateral 영상 유형 선택
3. 사용자가 X-ray 위에 직접 점을 클릭하여 작도
4. 점과 점을 연결하여 기준선 표시
5. AI가 사용자가 선택한 해부학적 위치를 검수
6. 잘못된 점만 사용자에게 알려 재작도 요청
7. 코드가 Talar Tilt 각도 계산
8. Lateral 영상에서는 Anterior Talar Translation 작도 지원
9. 별도의 ROM 직접 입력 기능
10. 실제 ROM 합계와 운동제한율 계산
11. 현재 등록된 보훈 ROM 기준과 비교
12. 결과와 작도 좌표 저장 또는 JSON 내보내기

DICOM 처리는 이번 버전에서 구현하지 않는다.

JPEG/PNG를 기본 입력으로 사용한다.

---

# 2. 가장 중요한 설계 원칙

AI의 역할:

"사용자가 작도한 점이 해부학적으로 적절한 위치인지 검수"

AI의 역할이 아닌 것:

- X-ray를 보고 자동 진단
- 사용자 대신 기준점 생성
- 자동으로 점 이동
- 임의의 좌표를 정답이라고 생성
- X-ray만으로 장해율 계산
- X-ray만으로 상이등급 확정
- ROM 값 추정
- 영상만 보고 질환 확정

프로그램 계산과 AI 판단을 반드시 분리한다.

기하학 계산은 JavaScript/Python 등의 일반 코드로 수행한다.

AI는 좌표 계산기가 아니라 검수자다.

---

# 3. X-ray 작도 기준의 근거

기준 연구:

Noh S, Lee MS, Lee BD.
"Automated radiography assessment of ankle joint instability using deep learning"
Scientific Reports, 2025.
DOI: 10.1038/s41598-025-99620-6

이 연구에서 확인되는 측정 기준을 프로젝트의 기본 작도 원칙으로 사용한다.

단, 논문은 의사가 마우스로 어느 점부터 클릭했는지에 대한 클릭 순서를 규정하지 않는다.

따라서 아래 P1~P6이라는 클릭 순서는 프로젝트 UI를 위해 정의한 운영 규칙이며, 이를 "논문에서 정한 의사의 클릭 순서"라고 표시하면 안 된다.

---

# 4. AP / Mortise 영상 작도

측정 대상:

Talar Tilt

논문상 정의:

Talar Tilt는

- tibial plafond의 articular surface
- talar dome의 articular surface

두 관절면 사이의 각도이다.

## 프로젝트용 수동 작도

사용자가 총 4개의 점을 찍는다.

### P1
distal tibial plafond의 관절면에서 내측 방향 기준점

### P2
같은 tibial plafond 관절면에서 외측 방향 기준점

### P3
talar dome superior articular surface에서 내측 방향 기준점

### P4
같은 talar dome 관절면에서 외측 방향 기준점

다음 두 선을 만든다.

Line_Tibia = P1 → P2

Line_Talus = P3 → P4

두 선이 이루는 최소각을 Talar Tilt로 계산한다.

중요:

P1/P2 및 P3/P4는 각각 동일한 관절면의 방향을 표현하기 위한 프로젝트용 두 점이다.

논문의 핵심 기준은 "두 관절면 사이의 각도"이며, P1~P4라는 명칭 자체는 프로젝트에서 정의한다.

---

# 5. AP / Mortise 사용자 안내문

화면에 다음 안내를 표시한다.

[1/4]
경골 원위부 관절면(tibial plafond)의 안쪽 기준점을 선택하세요.

[2/4]
같은 경골 관절면의 바깥쪽 기준점을 선택하세요.

[3/4]
거골 상부 관절면(talar dome)의 안쪽 기준점을 선택하세요.

[4/4]
같은 거골 관절면의 바깥쪽 기준점을 선택하세요.

점 선택 후 즉시 선을 연결하여 사용자에게 보여준다.

---

# 6. AP / Mortise AI 검수 기준

AI에는 원본 X-ray와 사용자가 찍은 점이 겹쳐진 이미지를 함께 전달한다.

각 점마다 다음 항목을 검수한다.

## 구조 확인

P1/P2:

- distal tibia에 위치하는가?
- tibial plafond 관절면에 위치하는가?
- medial/lateral 방향이 서로 뒤집히지 않았는가?

P3/P4:

- talus에 위치하는가?
- superior talar dome의 관절면에 위치하는가?
- medial/lateral 방향이 서로 뒤집히지 않았는가?

## 오류 사례

다음은 FAIL 후보이다.

- 점이 뼈 밖의 연부조직에 위치
- tibial plafond 대신 medial malleolus를 선택
- talar dome 대신 다른 거골 부위를 선택
- 골절편을 정상 관절면으로 선택
- 뚜렷한 osteophyte 끝을 정상 관절면 방향점으로 사용
- P1/P2가 서로 전혀 다른 해부학적 구조에 위치
- P3/P4가 서로 전혀 다른 해부학적 구조에 위치

하지만 영상이 불명확한 경우 추측해서 FAIL을 내려서는 안 된다.

이 경우:

UNCERTAIN

을 반환한다.

---

# 7. Lateral 영상 작도

측정 대상:

Anterior Talar Translation

논문상 정의:

경골 관절면의 posterior edge와 talar articular surface 사이의 shortest distance를 측정한다.

## 프로젝트용 절차

### P5

distal tibial articular surface의 posterior end를 사용자가 직접 선택한다.

### P6

사용자가 talar articular surface에서 P5와 가장 가까운 것으로 판단되는 점을 직접 선택한다.

그 다음 프로그램이 P5-P6 사이 픽셀 거리를 계산한다.

---

# 8. 거리 계산의 제한

JPEG/PNG에는 실제 물리적 크기 정보가 없을 수 있다.

따라서 calibration 정보가 없는 경우:

절대로 pixel 거리를 mm로 자동 환산하지 않는다.

출력:

distance_px = 계산값

distance_mm = null

physical_scale_available = false

만약 사용자가 별도의 실제 길이 보정값을 입력한 경우에만 mm 환산 기능을 활성화한다.

---

# 9. AI가 P5/P6에서 확인해야 하는 것

P5:

- distal tibial articular surface인가?
- 그 관절면의 posterior end인가?
- 단순한 posterior cortex의 임의 지점은 아닌가?

P6:

- talar articular surface 위에 있는가?
- 다른 뼈 또는 연부조직은 아닌가?
- 사용자가 선택한 P5와의 거리 측정을 위한 거골 관절면 기준점으로 타당한가?

AI가 정확한 P6 좌표를 새로 생성하면 안 된다.

잘못된 경우에는 위치 설명만 제공한다.

예:

"현재 P6는 거골 관절면보다 아래쪽에 위치한 것으로 보입니다. 거골 관절면에서 P5와 가장 가까운 지점을 다시 선택하십시오."

---

# 10. AI 검수 판정

세 가지 상태만 사용한다.

PASS

사용자 작도가 기준과 명백하게 일치함.

REVIEW_REQUIRED

한 개 이상의 점이 명백하게 잘못된 구조에 위치함.

UNCERTAIN

영상 품질, 중첩, 골절, 변형 등으로 AI가 신뢰성 있게 판단할 수 없음.

AI confidence가 낮다고 무조건 FAIL 처리하지 않는다.

---

# 11. AI 반환 JSON

다음 구조를 사용한다.

{
  "overall_status": "PASS | REVIEW_REQUIRED | UNCERTAIN",

  "view": "AP | Mortise | Lateral",

  "points": {
    "P1": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    },
    "P2": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    },
    "P3": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    },
    "P4": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    },
    "P5": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    },
    "P6": {
      "status": "PASS | FAIL | UNCERTAIN",
      "reason": "",
      "correction_instruction": ""
    }
  },

  "notes": ""
}

사용되지 않는 점은 null 처리한다.

---

# 12. AI 검수 프롬프트

AI 호출 시 다음 시스템 프롬프트를 사용한다.

"너는 발목 X-ray의 진단 AI가 아니라 사용자가 직접 작도한 해부학적 landmark의 위치를 검수하는 보조 시스템이다.

사용자가 지정하지 않은 새로운 landmark 좌표를 생성하지 않는다.

사용자가 찍은 점을 자동으로 이동하지 않는다.

각 점이 지정된 해부학적 구조에 위치하는지만 판단한다.

명백하게 틀린 경우만 FAIL로 판정한다.

영상이 불명확하거나 구조물 중첩 때문에 확신할 수 없으면 UNCERTAIN으로 판단한다.

AP/Mortise에서는 tibial plafond articular surface와 talar dome superior articular surface의 작도가 적절한지 확인한다.

Lateral에서는 distal tibial articular surface posterior end와 talar articular surface의 측정점이 적절한지 확인한다.

osteophyte, 명백한 골절편, 연부조직 또는 다른 뼈를 관절면으로 잘못 선택한 경우 이를 알려준다.

진단명, 장해등급 또는 장애율을 임의로 확정하지 않는다.

반드시 지정된 JSON 형식으로만 반환한다."

---

# 13. 기하학 계산

Talar Tilt는 AI가 계산하지 않는다.

사용자가 입력한 좌표로 코드에서 계산한다.

벡터:

A = P2 - P1

B = P4 - P3

각도:

theta =
acos(
 dot(A,B) /
 (|A| * |B|)
)

결과는 degree로 변환한다.

항상 두 선 사이의 작은 각도를 출력한다.

결과 예:

Talar Tilt: 6.4°

---

# 14. 논문상 불안정성 참고값

연구가 인용한 임상 기준에서는 Talar Tilt가

- 반대쪽 발목보다 3° 초과 차이가 나거나
- 절대값 9°를 초과

할 경우 불안정성을 시사하는 기준으로 소개된다.

Anterior Talar Translation은

- 반대쪽보다 3 mm 초과하거나
- 절대 전위가 10 mm 초과

할 경우 불안정성을 시사하는 기준으로 소개된다.

그러나 이 값은 특정 stress radiography 문헌의 기준이다.

현재 프로젝트의 일반 JPG/PNG X-ray 측정값과 직접 동일한 진단 기준으로 자동 확정하지 않는다.

UI에는 다음과 같이 표시한다.

"참고 측정값이며 단독 진단값이 아닙니다."

---

# 15. ROM 입력 화면

X-ray 작도와 ROM은 별도 평가 단계로 만든다.

사용자가 다음 값을 직접 입력한다.

배굴 dorsiflexion: ___ °
척굴 plantar flexion: ___ °
외번 eversion: ___ °
내번 inversion: ___ °

현재 프로젝트 자료에서 사용하는 정상각도:

배굴 = 20°
척굴 = 40°
외번 = 20°
내번 = 30°

정상 총 ROM:

110°

실제 ROM:

actual_ROM =
dorsiflexion
+ plantar_flexion
+ eversion
+ inversion

운동제한율:

limitation_percent =
(110 - actual_ROM) / 110 * 100

0% 미만이 나오지 않도록 validation을 둔다.

비정상적으로 정상 범위를 초과하는 값을 입력하면 경고를 띄운다.

---

# 16. 현재 프로젝트에 입력된 ROM 기준

다음 로직을 사용한다.

limitation < 25%

→ ROM 기준상 해당 구간 없음

25% 이상 50% 미만

→ 7급 8122 후보

50% 이상 75% 미만

→ 6급 2항 8121 후보

75% 이상

→ 6급 1항 8117 후보

단 UI에는 반드시:

"자동 판정이 아닌 입력값에 따른 기준 후보"

라고 표시한다.

최종 법적·의학적 판정을 의미한다고 표현하지 않는다.

---

# 17. 매우 중요한 데이터 분리

다음을 절대로 하나의 공식으로 합치지 않는다.

Talar Tilt
Anterior Talar Translation
ROM 운동제한율

각 항목은 서로 다른 측정치이다.

잘못된 예:

"Talar Tilt 10°이므로 ROM 장해율 50%"

이런 계산은 금지한다.

X-ray 측정값은 불안정성 또는 구조적 평가를 위한 보조자료다.

ROM 장해율은 별도로 직접 입력된 관절 운동각을 사용한다.

---

# 18. UI 흐름

첫 화면:

[발목 X-ray 수동 작도 평가]

버튼:

새 평가 시작

---

STEP 1

X-ray 업로드

지원:
JPG
JPEG
PNG

---

STEP 2

촬영 방향 선택

AP
Mortise
Lateral

---

STEP 3

수동 작도

현재 찍어야 할 점의 설명을 화면 위에 크게 표시한다.

이미지 확대/축소를 지원한다.

확대해도 실제 원본 이미지 좌표가 변하지 않도록 좌표를 원본 이미지 기준 정규화 좌표로 저장한다.

예:

x_normalized = x / image_width
y_normalized = y / image_height

---

STEP 4

작도 미리보기

점과 선을 표시한다.

다시 찍기
검수 요청

버튼 제공.

---

STEP 5

AI 검수

각 점을 다음처럼 표시한다.

P1 ✓
P2 ✓
P3 ⚠ 다시 확인
P4 ✓

잘못된 점만 다시 찍을 수 있도록 한다.

전체 작도를 처음부터 반복시키지 않는다.

---

STEP 6

계산

AI 검수가 PASS이거나 사용자가 UNCERTAIN 결과를 확인하고 계속 진행한 경우 계산한다.

AP/Mortise:

Talar Tilt 계산

Lateral:

pixel distance 계산

---

STEP 7

ROM 입력

4방향 ROM을 직접 입력한다.

---

STEP 8

결과 화면

영상 측정:

Talar Tilt: XX.X°
또는
Anterior Talar Translation: XXX px

ROM:

배굴 XX°
척굴 XX°
외번 XX°
내번 XX°

실제 ROM: XX°

운동제한율: XX.X%

기준 후보:
XXXX

---

# 19. 결과에 반드시 표시할 구분

[영상 측정 결과]

[ROM 측정 결과]

[기준 비교 결과]

세 영역을 UI에서 분리한다.

이를 하나의 "AI 최종 판정"으로 표현하지 않는다.

---

# 20. 사용자 수정 기능

모든 점에는 다음 기능이 있어야 한다.

- 선택
- 삭제
- 다시 지정
- Undo
- Reset

AI가 FAIL한 점에는 시각적으로 표시한다.

단 AI가 자동으로 좌표를 바꾸면 안 된다.

---

# 21. 저장 데이터 구조

평가 한 건을 다음과 비슷한 JSON으로 저장한다.

{
  "case_id": "...",

  "image": {
    "filename": "...",
    "width": 0,
    "height": 0,
    "view": "AP"
  },

  "landmarks": {
    "P1": {
      "x": 0.0,
      "y": 0.0
    },
    "P2": {
      "x": 0.0,
      "y": 0.0
    },
    "P3": {
      "x": 0.0,
      "y": 0.0
    },
    "P4": {
      "x": 0.0,
      "y": 0.0
    }
  },

  "ai_review": {
    "overall_status": "PASS",
    "points": {}
  },

  "radiographic_measurement": {
    "talar_tilt_deg": 0.0,
    "anterior_translation_px": null,
    "anterior_translation_mm": null
  },

  "rom": {
    "dorsiflexion": 0,
    "plantar_flexion": 0,
    "eversion": 0,
    "inversion": 0,
    "total": 0,
    "limitation_percent": 0
  },

  "rating_reference": {
    "candidate": "",
    "is_final_diagnosis": false
  }
}

---

# 22. 학습 데이터 축적을 고려한 저장 방식

향후 개발을 위해 다음 데이터를 별도로 남길 수 있게 설계한다.

원본 X-ray

사용자의 최초 작도점

AI가 FAIL한 점

사용자가 수정한 최종 점

최종 PASS된 점

기하학 계산값

이 구조를 사용하면 추후:

"사용자가 처음 찍은 위치 vs 수정 후 위치"

데이터를 축적할 수 있다.

그러나 현재 단계에서는 이 데이터를 이용해 자동 진단 모델을 훈련하지 않는다.

---

# 23. 개인정보 보호

사용자가 업로드한 X-ray에

- 이름
- 주민등록번호
- 병원 환자번호
- 생년월일
- 기타 식별정보

가 포함될 수 있다.

따라서 테스트 UI에:

"개인식별정보가 제거된 영상을 사용하십시오."

라는 안내를 표시한다.

이미지를 공개 GitHub repository에 자동 저장하면 안 된다.

기본 동작은 브라우저 세션 내 처리 또는 로컬 저장을 우선한다.

샘플 영상만 repository에 포함한다.

---

# 24. README에 명시할 제한

README에 다음 내용을 명시한다.

이 프로젝트는 교육·연구용 프로토타입이다.

의료진의 영상 판독 또는 공식 장해판정을 대체하지 않는다.

AI의 역할은 사용자가 직접 지정한 landmark의 위치 검수를 보조하는 것이다.

X-ray 측정값과 ROM 장해율은 별개의 지표이다.

DICOM 기반 실제 거리 보정은 현재 버전에 포함하지 않는다.

JPEG/PNG 영상에서 calibration 정보가 없는 경우 실제 mm를 임의로 생성하지 않는다.

---

# 25. 구현 우선순위

먼저 다음 MVP만 완성한다.

1순위:
X-ray 업로드

2순위:
이미지 위 클릭 좌표 생성

3순위:
P1~P4 표시 및 선 연결

4순위:
Talar Tilt 계산

5순위:
점 삭제/재선택/Undo

6순위:
AI 검수 인터페이스

7순위:
Lateral P5/P6 작도

8순위:
ROM 입력 및 제한율 계산

9순위:
기준 후보 표시

10순위:
JSON 결과 내보내기

불필요하게 기능 범위를 확대하지 않는다.

---

# 26. 테스트 케이스

자동 테스트를 작성한다.

## 기하학 테스트

평행한 두 선:

Talar Tilt = 0°

한 선이 10° 기울어진 경우:

Talar Tilt ≈ 10°

점의 위치 순서가 반대로 입력되어도 작은 두 선 사이 각도가 동일해야 한다.

## ROM 테스트 1

배굴 20
척굴 40
외번 20
내번 30

Total = 110
Limitation = 0%

## ROM 테스트 2

배굴 10
척굴 20
외번 10
내번 15

Total = 55

Limitation =

(110 - 55) / 110 × 100

= 50%

기준 후보:

6급 2항 8121

## 검수 테스트

P1이 연부조직에 위치:

REVIEW_REQUIRED

P1이 경골 관절면에 위치:

PASS

관절면 경계가 영상 중첩으로 불분명:

UNCERTAIN

---

# 27. 완료 조건

프로젝트가 완료됐다고 판단하기 위한 조건:

- JPG/PNG X-ray를 업로드할 수 있다.
- 사용자가 X-ray 위에 직접 점을 찍을 수 있다.
- 모든 점의 좌표가 저장된다.
- 점을 수정할 수 있다.
- AP/Mortise에서 두 기준선이 표시된다.
- 코드로 Talar Tilt가 계산된다.
- AI가 각 점을 PASS/FAIL/UNCERTAIN으로 검수한다.
- AI가 사용자의 점을 자동 수정하지 않는다.
- Lateral 측정에서는 calibration이 없으면 mm를 만들지 않는다.
- ROM 4개 값을 입력할 수 있다.
- 실제 ROM 합계를 계산한다.
- ROM 운동제한율을 계산한다.
- 현재 프로젝트 기준에 따른 등급 후보를 표시한다.
- X-ray 측정값과 ROM 장해율이 UI에서 명확하게 분리된다.
- JSON으로 평가 결과를 내보낼 수 있다.
- README에 연구 근거와 프로젝트 한계를 적는다.
- 기본 테스트가 모두 통과한다.

---

# 28. 구현 시 작업 방식

먼저 현재 repository 전체 구조를 읽어라.

기존 기능이 있다면 삭제하거나 전면 재작성하지 말고 최대한 유지한다.

그 다음 위 요구사항과 현재 코드를 비교해 필요한 최소 변경사항을 정리한다.

이후 실제 코드를 구현한다.

구현 후:

1. 빌드
2. lint
3. 테스트
4. 실제 화면 동작 확인

순으로 검증한다.

오류가 있으면 수정 후 다시 검증한다.

작업을 끝낸 뒤 다음 내용을 출력한다.

- 생성/수정된 파일
- 구현된 기능
- 테스트 결과
- 아직 구현하지 않은 기능
- 의료/법적 판단과 관련된 제한사항

질문을 반복하지 말고 현재 repository와 위 요구사항을 기준으로 MVP 구현을 우선 진행한다.