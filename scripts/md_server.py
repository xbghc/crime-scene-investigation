#!/usr/bin/env python3
"""Minimal Markdown-rendering HTTP server with token auth on .md only.

usage: md_server.py <port> <root_dir> <token>

Protection model:
- Index page (/) and .md files: require ?t=<token>, else 403.
- Any other file (svg, png, jpg, css, fonts, etc.): served as-is.

Rationale: static asset paths are only discoverable via rendered .md pages,
which are token-gated. Anyone who can't read the .md can't guess asset paths.
"""
import http.server
import socketserver
import sys
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import markdown

PORT = int(sys.argv[1])
ROOT = Path(sys.argv[2]).resolve()
TOKEN = sys.argv[3]

CSS = """
<style>
body {
  max-width: 760px;
  margin: 2em auto;
  padding: 0 1em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  line-height: 1.6;
  color: #222;
}
h1, h2, h3 { line-height: 1.25; margin-top: 1.8em; }
h1 { border-bottom: 1px solid #eee; padding-bottom: .3em; }
pre, code {
  font-family: "JetBrains Mono", ui-monospace, Menlo, monospace;
  background: #f6f8fa;
}
pre { padding: 1em; border-radius: 6px; overflow-x: auto; }
code { padding: .1em .3em; border-radius: 3px; font-size: .9em; }
pre code { padding: 0; background: none; }
blockquote {
  border-left: 3px solid #ddd;
  margin: 1em 0;
  padding: .3em 1em;
  color: #555;
}
img, svg { max-width: 100%; height: auto; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: .4em .8em; }
th { background: #f6f8fa; }
a { color: #0969da; }
@media (prefers-color-scheme: dark) {
  body { background: #0d1117; color: #c9d1d9; }
  h1 { border-bottom-color: #30363d; }
  pre, code { background: #161b22; }
  blockquote { border-left-color: #30363d; color: #8b949e; }
  th { background: #161b22; }
  th, td { border-color: #30363d; }
  a { color: #58a6ff; }
}
</style>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Token-gated paths: index and .md files
        needs_token = (path == '/' or path.endswith('.md'))

        if needs_token:
            params = parse_qs(parsed.query)
            supplied = params.get('t', [None])[0]
            if supplied != TOKEN:
                self.send_error(403, "missing or invalid token")
                return

            if path == '/':
                return self._send_index()

            fs_path = (ROOT / path.lstrip('/')).resolve()
            if not str(fs_path).startswith(str(ROOT)):
                self.send_error(403)
                return
            if fs_path.is_file():
                return self._send_markdown(fs_path)
            self.send_error(404)
            return

        # Static assets: serve as-is, no token required.
        # Strip query string so SimpleHTTPRequestHandler finds the file.
        self.path = path
        return super().do_GET()

    def list_directory(self, path):
        # Don't leak directory listings for static dirs (diagrams/, etc.)
        self.send_error(403, "directory listing disabled")
        return None

    def _send_index(self):
        items = sorted(
            [p for p in ROOT.glob('*.md') if not p.name.startswith('.')],
            reverse=True
        )
        links = '\n'.join(
            f'<li><a href="/{p.name}?t={TOKEN}">{p.stem}</a></li>' for p in items
        )
        html = f'<html><head><meta charset="utf-8"><title>blog</title>{CSS}</head><body><h1>blog</h1><ul>{links}</ul></body></html>'
        body = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_markdown(self, path: Path):
        text = path.read_text(encoding='utf-8')
        html_body = markdown.markdown(
            text,
            extensions=['fenced_code', 'tables', 'toc', 'codehilite']
        )
        html = f'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{path.stem}</title>{CSS}</head><body>{html_body}</body></html>'
        body = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    os.chdir(str(ROOT))
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"markdown server on {PORT}", flush=True)
        httpd.serve_forever()
