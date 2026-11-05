"""Archive discovered public frontend sources; never sends session cookies.

Usage: python tools/collect_public.py [additional public JS/CSS URLs ...]
Only assets referenced by collected files are followed. No endpoint probing.
"""
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'archive' / 'public'
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = OUT / 'manifest.json'
records = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
extras = [arg for arg in sys.argv[1:] if arg != '--captured']
if '--captured' in sys.argv:
    for capture in (ROOT / 'archive' / 'private').glob('*.json'):
        extras.extend(json.loads(capture.read_text(encoding='utf-8')).get('sources', []))
queue = deque(['https://www.khanwars.ae/',
               'https://static.khanwarsx.com/game7.1/js/ajax_army_order.js?ver=73', *extras])
seen = set()
allowed = {'www.khanwars.ae', 'static.khanwarsx.com'}

while queue:
    url = queue.popleft()
    if url in seen:
        continue
    seen.add(url)
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != 'https' or parts.hostname not in allowed:
        continue
    if url != 'https://www.khanwars.ae/' and not parts.path.endswith(('.js', '.css')):
        continue
    entry = {'url': url, 'collected_at': datetime.now(timezone.utc).isoformat()}
    try:
        previous = records.get(url, {})
        if previous.get('path') and (ROOT / previous['path']).exists():
            body = (ROOT / previous['path']).read_bytes()
            for ref in re.findall(r'''["']([^"'\s<>]+\.(?:js|css)(?:\?[^"'\s<>]*)?)["']''', body.decode('utf-8', errors='replace')):
                queue.append(urllib.parse.urljoin(url, ref.replace('&amp;', '&')))
            continue
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0', 'Referer': 'https://71.game.khanwars.ae/'})
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read()
            entry.update(status=response.status, content_type=response.headers.get('Content-Type'))
        suffix = Path(parts.path).suffix or '.html'
        basename = Path(parts.path).stem or 'index'
        name = re.sub(r'[^a-zA-Z0-9_.-]', '_', basename)
        destination = OUT / parts.hostname / f'{name}--{hashlib.sha256(url.encode()).hexdigest()[:12]}{suffix}'
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(body)
        entry.update(path=str(destination.relative_to(ROOT)), bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
        source = body.decode('utf-8', errors='replace')
        for ref in re.findall(r'''["']([^"'\s<>]+\.(?:js|css)(?:\?[^"'\s<>]*)?)["']''', source):
            queue.append(urllib.parse.urljoin(url, ref.replace('&amp;', '&')))
        print(f'{entry["status"]} {len(body):>8} {url}')
    except Exception as exc:
        entry['error'] = str(exc)
        print(f'FAILED {url}: {exc}')
    records[url] = entry
    MANIFEST.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')

findings = []
for entry in records.values():
    if 'path' not in entry:
        continue
    file = ROOT / entry['path']
    if file.suffix != '.js':
        continue
    source = file.read_text(encoding='utf-8', errors='replace')
    functions = re.findall(r'(?:function\s+([\w$]+)\s*\(|([\w$.]+)\s*=\s*function\s*\()', source)
    endpoints = []
    for number, line in enumerate(source.splitlines(), 1):
        for endpoint in re.findall(r'''["']([^"'\s]*\.php(?:\?[^"'\s]*)?)["']''', line):
            endpoints.append({'value': endpoint, 'line': number})
    findings.append({'file': entry['path'], 'url': entry['url'],
                     'functions': [a or b for a, b in functions], 'php_references': endpoints})
(ROOT / 'analysis').mkdir(exist_ok=True)
(ROOT / 'analysis' / 'source-index.json').write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Archived {sum("path" in x for x in records.values())} sources; index: analysis/source-index.json')
