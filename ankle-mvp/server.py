"""Loopback-only optional server. Python 3.10+, no installed packages required."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from ai_review import review
from law_api import LawAPI

ROOT = Path(__file__).resolve().parent
STATIC = {'/': ('index.html', 'text/html; charset=utf-8'), '/index.html': ('index.html', 'text/html; charset=utf-8'), '/web/app.js': ('web/app.js', 'text/javascript; charset=utf-8'), '/web/core.js': ('web/core.js', 'text/javascript; charset=utf-8'), '/web/styles.css': ('web/styles.css', 'text/css; charset=utf-8')}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Do not log patient images, query credentials, or user data.
        pass

    def send(self, status, body, content_type='application/json; charset=utf-8'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def host_allowed(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}')

    def do_GET(self):
        if not self.host_allowed():
            self.send(403, {'message': '허용되지 않은 Host'})
            return
        path = urlsplit(self.path).path
        if path not in STATIC:
            self.send(404, {'message': 'Not found'})
            return
        filename, kind = STATIC[path]
        self.send(200, (ROOT / filename).read_bytes(), kind)

    def do_POST(self):
        if not self.host_allowed() or self.headers.get('X-Ankle-Client') != '1':
            self.send(403, {'message': '허용되지 않은 요청'})
            return
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'):
            self.send(403, {'message': '동일 출처 요청만 허용합니다.'})
            return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.send(415, {'message': 'JSON 요청이 필요합니다.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 25_000_000:
                self.send(413, {'message': '요청 크기 제한 초과'})
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('JSON 객체가 필요합니다.')
            if self.path == '/api/review':
                result = review(payload)
            elif self.path == '/api/legal-search':
                candidate = payload.get('candidate')
                if candidate is not None and not isinstance(candidate, str):
                    raise ValueError('등급 후보 형식 오류')
                result = LawAPI().search_related(candidate)
            elif self.path == '/api/precedent':
                result = LawAPI().get_precedent(payload.get('id'))
            elif self.path == '/api/law':
                result = LawAPI().get_law(payload.get('id'))
            else:
                self.send(404, {'message': 'Not found'})
                return
            self.send(200, result)
        except (ValueError, TypeError) as exc:
            self.send(400, {'message': str(exc)[:300]})
        except Exception:
            self.send(500, {'message': '서버 처리 오류. 작도와 ROM 계산은 계속 사용할 수 있습니다.'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be 1..65535')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Ankle Studio: http://127.0.0.1:{args.port}\n종료: Ctrl+C', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == '__main__':
    main()
