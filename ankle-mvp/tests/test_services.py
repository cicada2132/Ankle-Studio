import base64
import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from ai_review import review, validate_output
from law_api import LawAPI


def response(data):
    return io.BytesIO(json.dumps(data).encode())


def payload():
    data = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\nfixture').decode()
    return {'view': 'Lateral', 'points': {'P5': {'x': .2, 'y': .2}, 'P6': {'x': .3, 'y': .3}}, 'original_image': data, 'annotated_image': data, 'external_image_consent': True}


class LawTests(unittest.TestCase):
    def test_missing_oc(self):
        client = LawAPI(oc='')
        self.assertEqual(client.search_law('test')['status'], 'not_configured')
        self.assertEqual(client.search_related()['status'], 'not_configured')
        self.assertEqual(client.get_precedent('1')['status'], 'not_configured')

    def test_single_and_multiple_results(self):
        item = {'판례일련번호': '123', '사건명': '테스트', '사건번호': '2020두1'}
        for items, expected in [(item, 1), ([item, item], 2), (None, 0)]:
            client = LawAPI('fixture', lambda *a, **k: response({'PrecSearch': {'prec': items}}))
            result = client.search_precedents('발목')
            self.assertEqual(len(result['precedents']), expected)

    def test_detail_normalization(self):
        client = LawAPI('fixture', lambda *a, **k: response({'PrecService': {'판례일련번호': '1', '판례내용': '원문'}}))
        self.assertEqual(client.get_precedent('1')['precedent']['content'], '원문')
        with self.assertRaises(ValueError):
            client.get_precedent('1&OC=bad')

    def test_no_key_leak_errors(self):
        for error, status in [(HTTPError('url-with-secret', 403, 'no', {}, None), 'http_error'), (URLError('key secret'), 'network_error')]:
            def fail(*args, **kwargs):
                raise error
            result = LawAPI('secret', fail).search_precedents('q')
            self.assertEqual(result['status'], status)
            self.assertNotIn('secret', json.dumps(result))
        client = LawAPI('fixture', lambda *a, **k: io.BytesIO(b'<html>not JSON</html>'))
        self.assertEqual(client.search_precedents('q')['status'], 'invalid_response')
        client = LawAPI('fixture', lambda *a, **k: response({'error': 'invalid OC'}))
        self.assertEqual(client.search_precedents('q')['status'], 'api_error')

    def test_dedup_and_query(self):
        def fake(url, **kwargs):
            if 'target=law' in url:
                return response({'LawSearch': {'law': {'법령ID': '1', '법령명한글': '법령'}}})
            self.assertIn('search=2', url)
            return response({'PrecSearch': {'prec': {'판례일련번호': '12', '사건명': '사건'}}})
        result = LawAPI('fixture', fake).search_related('6급 2항 8121 후보')
        self.assertEqual(len(result['precedents']), 1)
        self.assertEqual(len(result['queries']), 3)
        self.assertEqual(len(result['laws']), 1)


class ReviewTests(unittest.TestCase):
    def test_unconfigured_not_pass(self):
        with patch.dict(os.environ, {}, clear=True):
            result = review(payload())
        self.assertEqual(result['overall_status'], 'UNCERTAIN')
        self.assertFalse(result['performed'])

    def test_input_and_consent(self):
        for key, value in [('external_image_consent', False), ('view', 'Other'), ('original_image', 'https://invalid')]:
            p = payload(); p[key] = value
            with self.assertRaises(ValueError):
                review(p)

    def test_review_semantics_not_anatomical_accuracy(self):
        for status, expected in [('PASS', 'PASS'), ('FAIL', 'REVIEW_REQUIRED'), ('UNCERTAIN', 'UNCERTAIN')]:
            raw = {'view': 'Lateral', 'overall_status': 'PASS', 'points': {key: {'status': status, 'reason': 'fixture', 'correction_instruction': '', 'x': .9} for key in ['P5', 'P6']}}
            result = validate_output(raw, 'Lateral')
            self.assertEqual(result['overall_status'], expected)
            self.assertNotIn('x', result['points']['P5'])

    def test_remote_success_and_failure(self):
        raw = {'view': 'Lateral', 'points': {key: {'status': 'PASS', 'reason': 'fixture', 'correction_instruction': ''} for key in ['P5', 'P6']}}
        def fake(req, **kwargs):
            body = json.loads(req.data)
            self.assertEqual(len(body['messages'][1]['content']), 3)
            return response({'choices': [{'message': {'content': json.dumps(raw)}}]})
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only', 'OPENAI_MODEL': 'fixture'}):
            self.assertTrue(review(payload(), fake)['performed'])
            self.assertFalse(review(payload(), lambda *a, **k: response({}))['performed'])


if __name__ == '__main__':
    unittest.main()
