"""
Nightfall Command Center Backend
Serves: /metrics (Gmail), /projects (dir scan), /chat (Claude), /log, /tts, /config, /health
"""

import os
import json
import time
import threading
import datetime
from collections import deque
from http.server import HTTPServer, BaseHTTPRequestHandler
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
PORT   = 5050

# ── CONFIG ──────────────────────────────────────────────────────────────────

def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.json')
    config_path = os.path.abspath(config_path)
    if os.path.exists(config_path):
        with open(config_path) as f:
            return json.load(f)
    return {}

CONFIG = load_config()

ACCOUNTS = [
    {'key': 'gmail',     'email': 'royalbramble@gmail.com',              'token': 'token_gmail.json'},
    {'key': 'workspace', 'email': 'richard.quantrill@royalbramble.com',  'token': 'token_workspace.json'},
]

PROJECTS_DIR = CONFIG.get('projects_dir', '/mnt/c/Users/ricqua/Desktop/Projects')
ANTHROPIC_KEY = CONFIG.get('anthropic_api_key', '')
CLAUDE_MODEL  = CONFIG.get('claude_model', 'claude-haiku-4-5')

# ── LOG RING BUFFER ─────────────────────────────────────────────────────────

log_buffer = deque(maxlen=100)
log_lock   = threading.Lock()

def log(msg):
    entry = {'time': time.strftime('%H:%M:%S'), 'message': msg}
    with log_lock:
        log_buffer.appendleft(entry)
    print(f"[{entry['time']}] {msg}")

# ── EMAIL CACHE ──────────────────────────────────────────────────────────────

cache      = {}
cache_lock = threading.Lock()

# ── PROJECTS CACHE ───────────────────────────────────────────────────────────

projects_cache = []
projects_lock  = threading.Lock()

# ── ANTHROPIC USAGE CACHE ────────────────────────────────────────────────────

anthropic_usage_cache = {}
anthropic_usage_lock  = threading.Lock()

# ── AUTH ─────────────────────────────────────────────────────────────────────

def get_service(account):
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), account['token'])
    creds_path = os.path.join(os.path.dirname(__file__), 'credentials.json')
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            log(f"Opening browser to authenticate: {account['email']}")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0, prompt='select_account')
        with open(token_path, 'w') as f:
            f.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

# ── EMAIL FETCH ──────────────────────────────────────────────────────────────

def fetch_count(service, query):
    try:
        result = service.users().messages().list(userId='me', q=query, maxResults=1).execute()
        return result.get('resultSizeEstimate', 0)
    except Exception:
        return 0

def fetch_recent(service, n=8):
    threads = []
    try:
        result = service.users().threads().list(userId='me', q='in:inbox', maxResults=n).execute()
        for t in result.get('threads', []):
            detail = service.users().threads().get(
                userId='me', id=t['id'], format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            ).execute()
            msg  = detail['messages'][0]
            hdrs = {h['name']: h['value'] for h in msg['payload'].get('headers', [])}
            sender = hdrs.get('From', '')
            if '<' in sender:
                sender = sender[:sender.index('<')].strip().strip('"')
            threads.append({
                'subject': hdrs.get('Subject', '(no subject)'),
                'sender':  sender or hdrs.get('From', ''),
                'date':    hdrs.get('Date', ''),
                'unread':  'UNREAD' in msg.get('labelIds', []),
            })
    except Exception:
        pass
    return threads

def poll_account(account):
    try:
        service     = get_service(account)
        unread      = fetch_count(service, 'is:unread in:inbox')
        today       = fetch_count(service, 'in:inbox newer_than:1d')
        sent_today  = fetch_count(service, 'in:sent newer_than:1d')
        attachments = fetch_count(service, 'has:attachment newer_than:7d')
        recent      = fetch_recent(service)
        log(f"{account['email']} — ok — {unread} unread")
        return {
            'email': account['email'], 'unread': unread, 'today': today,
            'sent_today': sent_today, 'attachments_7d': attachments,
            'recent': recent, 'status': 'ok', 'last_updated': time.strftime('%H:%M:%S'),
        }
    except Exception as e:
        log(f"{account['email']} — error — {e}")
        return {
            'email': account['email'], 'unread': None, 'today': None,
            'sent_today': None, 'attachments_7d': None, 'recent': [],
            'status': 'error', 'error': str(e), 'last_updated': time.strftime('%H:%M:%S'),
        }

def poll_loop():
    while True:
        for account in ACCOUNTS:
            result = poll_account(account)
            with cache_lock:
                cache[account['key']] = result
        time.sleep(120)

# ── PROJECTS SCAN ────────────────────────────────────────────────────────────

def age_category(mtime):
    age_seconds = time.time() - mtime
    if age_seconds < 86400:    return 'active'
    if age_seconds < 604800:   return 'recent'
    return 'idle'

def scan_projects():
    results = []
    if not os.path.isdir(PROJECTS_DIR):
        log(f"projects dir not found: {PROJECTS_DIR}")
        return results
    try:
        for entry in sorted(os.scandir(PROJECTS_DIR), key=lambda e: -e.stat().st_mtime):
            if entry.is_dir():
                mtime = entry.stat().st_mtime
                results.append({
                    'name': entry.name,
                    'last_modified': datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%dT%H:%M:%S'),
                    'age': age_category(mtime),
                })
        log(f"projects scan — {len(results)} found")
    except Exception as e:
        log(f"projects scan error: {e}")
    return results

def projects_loop():
    while True:
        result = scan_projects()
        with projects_lock:
            projects_cache.clear()
            projects_cache.extend(result)
        time.sleep(60)

# ── ANTHROPIC USAGE FETCH ────────────────────────────────────────────────────

def fetch_anthropic_usage():
    if not ANTHROPIC_KEY or ANTHROPIC_KEY.startswith('sk-ant-REPLACE'):
        log("anthropic usage — no api key")
        return {}
    try:
        import urllib.request
        end   = datetime.date.today()
        start = end - datetime.timedelta(days=364)
        url   = (
            f"https://api.anthropic.com/v1/usage/tokens"
            f"?start_time={start.isoformat()}T00:00:00Z"
            f"&end_time={end.isoformat()}T23:59:59Z"
            f"&granularity=daily"
        )
        req = urllib.request.Request(url, headers={
            'x-api-key':         ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        # Haiku 4.5 pricing: $0.25/M input, $1.25/M output
        INPUT_PRICE  = 0.25  / 1_000_000
        OUTPUT_PRICE = 1.25  / 1_000_000

        dates, input_tokens, output_tokens, cost_usd = [], [], [], []
        for entry in data.get('data', []):
            d = entry.get('timestamp', '')[:10]
            inp  = entry.get('input_tokens', 0)
            out  = entry.get('output_tokens', 0)
            cost = inp * INPUT_PRICE + out * OUTPUT_PRICE
            dates.append(d)
            input_tokens.append(inp)
            output_tokens.append(out)
            cost_usd.append(round(cost, 6))

        log(f"anthropic usage — ok — {len(dates)} days")
        return {
            'dates':         dates,
            'input_tokens':  input_tokens,
            'output_tokens': output_tokens,
            'cost_usd':      cost_usd,
        }
    except Exception as e:
        log(f"anthropic usage — error — {e}")
        return {}


def usage_loop():
    while True:
        result = fetch_anthropic_usage()
        with anthropic_usage_lock:
            anthropic_usage_cache.clear()
            anthropic_usage_cache.update(result)
        time.sleep(3600)


# ── CLAUDE CHAT ──────────────────────────────────────────────────────────────

def build_system_prompt():
    now = datetime.datetime.utcnow()
    def fmt_tz(tz_offset_hours):
        t = now + datetime.timedelta(hours=tz_offset_hours)
        return t.strftime('%H:%M')

    tx_time = fmt_tz(-5)
    za_time = fmt_tz(2)
    kr_time = fmt_tz(9)

    with cache_lock:
        gm = cache.get('gmail', {})
        ws = cache.get('workspace', {})
    with projects_lock:
        projs = list(projects_cache)
    with log_lock:
        recent_logs = list(log_buffer)[:5]

    proj_summary = ', '.join(f"{p['name']} ({p['age']})" for p in projs) or 'none found'
    log_summary  = ' | '.join(e['message'] for e in recent_logs) or 'no recent events'

    return f"""You are Nightfall, the personal AI assistant embedded in R.A.'s Command Center dashboard.
You have real-time awareness of the system state. Be concise — responses will be spoken aloud.
Aim for 1-3 sentences unless more detail is specifically requested.

Current system state:
- Time: Texas {tx_time} | South Africa {za_time} | Korea {kr_time}
- Gmail: {gm.get('unread', '?')} unread, {gm.get('today', '?')} today
- Workspace: {ws.get('unread', '?')} unread, {ws.get('today', '?')} today
- Projects: {proj_summary}
- Recent events: {log_summary}"""

def call_claude(message):
    if not ANTHROPIC_KEY or ANTHROPIC_KEY == 'sk-ant-REPLACE_ME':
        return None, 'No Anthropic API key configured'
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=build_system_prompt(),
            messages=[{'role': 'user', 'content': message}]
        )
        text = response.content[0].text
        log(f"claude chat — ok — {len(text)} chars")
        return text, None
    except Exception as e:
        log(f"claude chat — error — {e}")
        return None, str(e)

# ── HTTP SERVER ───────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def send_json(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/metrics':
            with cache_lock:
                self.send_json(cache)

        elif self.path == '/projects':
            with projects_lock:
                self.send_json(list(projects_cache))

        elif self.path == '/log':
            with log_lock:
                self.send_json(list(log_buffer)[:20])

        elif self.path == '/config':
            el_key = CONFIG.get('elevenlabs_api_key', '')
            self.send_json({
                'elevenlabs_configured': bool(el_key and el_key != 'REPLACE_ME'),
                'anthropic_credit_usd': CONFIG.get('anthropic_credit_usd', 0),
            })

        elif self.path == '/health':
            self.send_json({'status': 'ok'})

        elif self.path == '/anthropic-usage':
            with anthropic_usage_lock:
                self.send_json(dict(anthropic_usage_cache))

        else:
            self.send_response(404)
            self.send_cors()
            self.end_headers()

    def do_POST(self):
        if self.path == '/chat':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data    = json.loads(body)
                message = data.get('message', '').strip()
                if not message:
                    self.send_json({'error': 'empty message'}, 400)
                    return
                log(f"voice command: {message[:60]}")
                text, err = call_claude(message)
                if err:
                    self.send_json({'error': err}, 500)
                else:
                    self.send_json({'response': text})
            except Exception as e:
                self.send_json({'error': str(e)}, 500)

        elif self.path == '/tts':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data     = json.loads(body)
                text     = data.get('text', '').strip()
                el_key   = CONFIG.get('elevenlabs_api_key', '')
                voice_id = CONFIG.get('elevenlabs_voice_id', '21m00Tcm4TlvDq8ikWAM')
                if not text or not el_key or el_key == 'REPLACE_ME':
                    self.send_response(503)
                    self.send_cors()
                    self.end_headers()
                    return
                import requests as req_lib
                resp = req_lib.post(
                    f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
                    headers={
                        'xi-api-key': el_key,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg',
                    },
                    json={'text': text, 'model_id': 'eleven_turbo_v2',
                          'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75}},
                    timeout=10,
                )
                if resp.status_code != 200:
                    self.send_response(502)
                    self.send_cors()
                    self.end_headers()
                    return
                audio = resp.content
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(audio)))
                self.send_cors()
                self.end_headers()
                self.wfile.write(audio)
                log(f"elevenlabs tts — ok — {len(text)} chars")
            except Exception as e:
                log(f"elevenlabs tts — error — {e}")
                self.send_response(500)
                self.send_cors()
                self.end_headers()

        else:
            self.send_response(404)
            self.send_cors()
            self.end_headers()

# ── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    log("=" * 50)
    log("NIGHTFALL COMMAND CENTER BACKEND")
    log("=" * 50)

    result = scan_projects()
    with projects_lock:
        projects_cache.extend(result)

    for account in ACCOUNTS:
        log(f"Connecting {account['email']}...")
        result = poll_account(account)
        with cache_lock:
            cache[account['key']] = result

    threading.Thread(target=poll_loop,     daemon=True).start()
    threading.Thread(target=projects_loop, daemon=True).start()

    initial_usage = fetch_anthropic_usage()
    with anthropic_usage_lock:
        anthropic_usage_cache.update(initial_usage)

    threading.Thread(target=usage_loop, daemon=True).start()

    log(f"Serving on http://localhost:{PORT}")
    server = HTTPServer(('localhost', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Nightfall backend stopped.")
