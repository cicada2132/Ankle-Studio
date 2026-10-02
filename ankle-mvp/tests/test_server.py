import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from unittest.mock import patch

from server import Handler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        conn = HTTPConnection('127.0.0.1', self.port, timeout=5)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        conn.close()
        return result

    def test_static_and_no_secrets(self):
        for path in ['/', '/web/app.js', '/web/core.js', '/web/styles.css']:
            status, body, headers = self.request('GET', path)
            self.assertEqual(status, 200)
            self.assertGreater(len(body), 100)
            self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        for path in ['/.env', '/server.py', '/../../../etc/passwd']:
            self.assertEqual(self.request('GET', path)[0], 404)

    def test_missing_oc_does_not_stop_app(self):
        with patch.dict('os.environ', {}, clear=True):
            status, body, _ = self.request('POST', '/api/legal-search', '{}', {'Content-Type': 'application/json', 'X-Ankle-Client': '1'})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)['status'], 'not_configured')
        self.assertEqual(self.request('GET', '/')[0], 200)

    def test_cross_origin_and_bad_json_blocked(self):
        headers = {'Content-Type': 'application/json', 'X-Ankle-Client': '1', 'Origin': 'https://example.invalid'}
        self.assertEqual(self.request('POST', '/api/review', '{}', headers)[0], 403)
        del headers['Origin']
        self.assertEqual(self.request('POST', '/api/review', '{', headers)[0], 400)
        self.assertEqual(self.request('GET', '/', headers={'Host': 'malicious.example'})[0], 403)


if __name__ == '__main__':
    unittest.main()
