# Ankle Studio

발목 X-ray(JPG/PNG) 위에 기준점을 직접 찍어 각도·거리를 계산하고, ROM 운동제한율을 따로 계산하는 로컬 웹 프로토타입입니다.

## 구성

| 경로 | 내용 |
|---|---|
| [`ankle-mvp/`](ankle-mvp/) | 수동 작도 MVP (웹 UI + 선택형 Python 로컬 서버) |
| [`ankle-mvp/README.md`](ankle-mvp/README.md) | 실행 방법, 선택 기능(AI 검토·법령 API), 주의사항 |
| [`ankle-mvp/docs/`](ankle-mvp/docs/) | 검증 기록과 다음 단계 |

## 빠른 시작

- **설치 없이:** `ankle-mvp/index.html`을 Chrome 또는 Edge에서 엽니다.
- **로컬 서버:** Python 3.10 이상에서 `cd ankle-mvp && python server.py`를 실행한 뒤 http://127.0.0.1:8765 에 접속합니다. Windows에서는 `start_windows.bat`을 더블클릭해도 됩니다.

## 테스트

```bash
cd ankle-mvp
npm test
```

## 주의

실제 의료영상, 결과 JSON, `.env`와 API 키는 저장소에 올리지 마세요. 계산 결과는 참고용이며 진단을 대신하지 않습니다.
