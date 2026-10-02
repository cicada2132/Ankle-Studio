"""National Law Information API adapter. No keys or images reach the client.
Guides: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide
https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precInfoGuide
"""
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


class LawAPI:
    def __init__(self, oc=None, opener=None):
        self.oc = os.environ.get('LAW_API_OC', '') if oc is None else oc
        self.opener = opener or urlopen

    def _request(self, endpoint, **params):
        if not self.oc.strip():
            return {'status': 'not_configured', 'message': 'API 인증값 미설정: LAW_API_OC', 'data': None}
        query = urlencode({'OC': self.oc, 'type': 'JSON', **params})
        try:
            with self.opener(f'https://www.law.go.kr/DRF/{endpoint}?{query}', timeout=12) as response:
                raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise ValueError('response too large')
            data = json.loads(raw.decode('utf-8-sig'))
            if not isinstance(data, dict):
                raise ValueError('invalid root')
            expected = ('LawSearch', 'PrecSearch') if endpoint == 'lawSearch.do' else ('법령', 'PrecService')
            if not any(key in data for key in expected):
                return {'status': 'api_error', 'message': 'API 인증·이용권한 또는 응답 형식을 확인하세요.', 'data': None}
            return {'status': 'ok', 'data': data}
        except HTTPError as exc:
            return {'status': 'http_error', 'message': f'법령 API HTTP 오류 ({exc.code}). 인증·이용권한을 확인하세요.', 'data': None}
        except (URLError, TimeoutError, OSError):
            return {'status': 'network_error', 'message': '법령 API 연결 실패 또는 시간 초과', 'data': None}
        except (ValueError, UnicodeError):
            return {'status': 'invalid_response', 'message': '법령 API가 유효한 JSON을 반환하지 않았습니다. OC 설정 및 권한을 확인하세요.', 'data': None}

    @staticmethod
    def _list(value):
        if isinstance(value, dict):
            return [value]
        return value if isinstance(value, list) else []

    @staticmethod
    def _id(value):
        value = str(value)
        if not re.fullmatch(r'\d{1,20}', value):
            raise ValueError('유효한 API 문서 ID가 필요합니다.')
        return value

    def search_law(self, query, display=20):
        result = self._request('lawSearch.do', target='law', query=str(query)[:200], display=max(1, min(int(display), 100)))
        result['laws'] = []
        if result['status'] == 'ok':
            root = result['data'].get('LawSearch', {})
            if not isinstance(root, dict):
                return {'status': 'invalid_response', 'message': '법령 목록 형식 오류', 'laws': []}
            result['laws'] = [{'id': str(item.get('법령ID', '')), 'serial': str(item.get('법령일련번호', '')), 'name': item.get('법령명한글', ''), 'effective_date': item.get('시행일자', '')} for item in self._list(root.get('law')) if isinstance(item, dict)]
        result.pop('data', None)
        return result

    def get_law(self, law_id):
        return self._request('lawService.do', target='law', ID=self._id(law_id))

    def search_precedents(self, query, display=20):
        result = self._request('lawSearch.do', target='prec', search=2, query=str(query)[:200], display=max(1, min(int(display), 100)))
        result['precedents'] = []
        if result['status'] == 'ok':
            root = result['data'].get('PrecSearch', {})
            if not isinstance(root, dict):
                return {'status': 'invalid_response', 'message': '판례 목록 형식 오류', 'precedents': []}
            result['precedents'] = [self.normalize(item) for item in self._list(root.get('prec')) if isinstance(item, dict)]
        result.pop('data', None)
        return result

    @staticmethod
    def normalize(item):
        mapping = {'id': '판례일련번호', 'case_name': '사건명', 'case_number': '사건번호', 'decision_date': '선고일자', 'court': '법원명', 'judgment_type': '판결유형', 'issues': '판시사항', 'summary': '판결요지', 'content': '판례내용', 'statutes': '참조조문'}
        return {key: item.get(source) for key, source in mapping.items()}

    def get_precedent(self, precedent_id):
        result = self._request('lawService.do', target='prec', ID=self._id(precedent_id))
        if result['status'] == 'ok':
            root = result['data'].get('PrecService', {})
            if not isinstance(root, dict):
                return {'status': 'invalid_response', 'message': '판례 상세 형식 오류'}
            result['precedent'] = self.normalize(root)
        result.pop('data', None)
        return result

    def search_related(self, candidate=None):
        if not self.oc.strip():
            return {'status': 'not_configured', 'message': 'API 인증값 미설정: LAW_API_OC. 작도·ROM 계산은 정상 사용할 수 있습니다.', 'laws': [], 'precedents': []}
        law = self.search_law('국가유공자 등 예우 및 지원에 관한 법률 시행규칙', display=5)
        queries = ['발목 운동가능영역 상이등급', '발목 상이등급구분신체검사']
        if candidate and re.fullmatch(r'(7급 8122|6급 [12]항 81(17|21)) 후보', candidate):
            queries.append('발목 ' + candidate.replace(' 후보', ''))
        records, seen, errors = [], set(), []
        if law['status'] != 'ok':
            errors.append(law.get('message', law['status']))
        for query in queries:
            result = self.search_precedents(query, display=10)
            if result['status'] != 'ok':
                errors.append(result.get('message', result['status']))
            for record in result.get('precedents', []):
                key = str(record.get('id') or '')
                if not key or key in seen:
                    continue
                seen.add(key)
                records.append(record)
        return {'status': 'partial' if errors else 'ok', 'message': '검색 오류: ' + '; '.join(dict.fromkeys(errors)) if errors else f'판례 {len(records)}건. 관련성 및 원문을 직접 확인하세요.', 'queries': queries, 'laws': law.get('laws', []), 'precedents': records}
