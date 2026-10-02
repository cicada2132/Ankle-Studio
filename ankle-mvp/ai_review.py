"""Optional image review adapter. Does not claim clinical validation."""
import base64
import json
import math
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PROMPT = Path(__file__).with_name('review_prompt.txt').read_text(encoding='utf-8')


def active_ids(view):
    if view not in ('AP', 'Mortise', 'Lateral'):
        raise ValueError('지원하지 않는 영상 유형')
    return ['P5', 'P6'] if view == 'Lateral' else ['P1', 'P2', 'P3', 'P4']


def validate_input(payload):
    ids = active_ids(payload.get('view'))
    points = payload.get('points')
    if not isinstance(points, dict) or set(points) != set(ids):
        raise ValueError('검수할 점이 누락되었거나 예상과 다릅니다.')
    for point in points.values():
        if not isinstance(point, dict) or set(point) != {'x', 'y'}:
            raise ValueError('좌표 형식 오류')
        for value in point.values():
            if type(value) not in (float, int) or not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError('좌표는 0~1 정규화 값이어야 합니다.')
    if payload.get('external_image_consent') is not True:
        raise ValueError('영상 전송 동의가 필요합니다.')
    for key in ('original_image', 'annotated_image'):
        value = payload.get(key, '')
        if not isinstance(value, str) or not value.startswith('data:image/png;base64,') or len(value) > 12_000_000:
            raise ValueError('PNG data URL이 필요합니다.')
        try:
            raw = base64.b64decode(value.split(',', 1)[1], validate=True)
        except (ValueError, TypeError) as exc:
            raise ValueError('이미지 데이터 형식 오류') from exc
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('PNG 서명 오류')
    return ids


def validate_output(raw, view):
    ids = active_ids(view)
    if not isinstance(raw, dict) or raw.get('view') != view or not isinstance(raw.get('points'), dict):
        raise ValueError('검수 응답 형식 오류')
    points = {}
    for i in range(1, 7):
        key = f'P{i}'
        if key not in ids:
            points[key] = None
            continue
        item = raw['points'].get(key)
        if not isinstance(item, dict) or item.get('status') not in ('PASS', 'FAIL', 'UNCERTAIN'):
            raise ValueError('검수 상태 오류')
        if not isinstance(item.get('reason'), str) or not isinstance(item.get('correction_instruction'), str):
            raise ValueError('검수 설명 오류')
        # Whitelist: model-supplied coordinates or other fields are discarded.
        points[key] = {k: item[k] for k in ('status', 'reason', 'correction_instruction')}
    statuses = [points[key]['status'] for key in ids]
    overall = 'REVIEW_REQUIRED' if 'FAIL' in statuses else 'UNCERTAIN' if 'UNCERTAIN' in statuses else 'PASS'
    return {'overall_status': overall, 'view': view, 'points': points, 'notes': str(raw.get('notes', ''))[:4000], 'performed': True, 'provider_status': 'ok'}


def unavailable(view, message, status='not_configured'):
    ids = active_ids(view)
    return {'overall_status': 'UNCERTAIN', 'view': view, 'points': {f'P{i}': {'status': 'UNCERTAIN', 'reason': message, 'correction_instruction': '사용자가 원본 영상에서 위치를 확인하세요.'} if f'P{i}' in ids else None for i in range(1, 7)}, 'notes': message, 'performed': False, 'provider_status': status}


def review(payload, opener=None):
    validate_input(payload)
    view = payload['view']
    key, model = os.environ.get('OPENAI_API_KEY'), os.environ.get('OPENAI_MODEL')
    if not key or not model:
        return unavailable(view, 'AI 검수 미설정: OPENAI_API_KEY와 OPENAI_MODEL이 필요합니다.')
    content = [
        {'type': 'text', 'text': json.dumps({'view': view, 'side': payload.get('side', 'unknown'), 'points': payload['points']}, ensure_ascii=False)},
        {'type': 'image_url', 'image_url': {'url': payload['original_image']}},
        {'type': 'image_url', 'image_url': {'url': payload['annotated_image']}},
    ]
    body = {'model': model, 'messages': [{'role': 'system', 'content': PROMPT}, {'role': 'user', 'content': content}], 'response_format': {'type': 'json_object'}}
    request = Request('https://api.openai.com/v1/chat/completions', data=json.dumps(body).encode(), headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, method='POST')
    try:
        with (opener or urlopen)(request, timeout=45) as response:
            result = json.loads(response.read(2_000_001))
        raw = json.loads(result['choices'][0]['message']['content'])
        return validate_output(raw, view)
    except HTTPError as exc:
        return unavailable(view, f'AI API HTTP 오류 ({exc.code}). 모델 지원 여부·인증·이용한도를 확인하세요.', 'http_error')
    except (URLError, TimeoutError, OSError):
        return unavailable(view, 'AI 연결 실패 또는 시간 초과. 검수는 완료되지 않았습니다.', 'network_error')
    except (ValueError, TypeError, KeyError, IndexError):
        return unavailable(view, 'AI 응답 형식 오류. 검수는 완료되지 않았습니다.', 'invalid_response')
