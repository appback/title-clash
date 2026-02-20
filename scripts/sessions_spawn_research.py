#!/usr/bin/env python3
"""
Example script to spawn an isolated OpenClaw session to run a long research task
using the higher-quality model (openai/gpt-5.2). This uses the sessions_spawn RPC
if available via OpenClaw gateway API. Adjust gateway URL/token as needed.

This is a template — adapt auth and network details for your environment.
"""

import requests
import os
import sys
import json
from datetime import datetime

GATEWAY_URL = os.environ.get('OPENCLAW_GATEWAY','http://127.0.0.1:18789')
GATEWAY_TOKEN = os.environ.get('OPENCLAW_GATEWAY_TOKEN')

if not GATEWAY_TOKEN:
    print('Set OPENCLAW_GATEWAY_TOKEN in env before running')
    sys.exit(1)

headers = {
    'Authorization': f'Bearer {GATEWAY_TOKEN}',
    'Content-Type': 'application/json'
}

payload = {
    'task': 'long_research: summarize latest news on <topic>',
    'label': 'research-' + datetime.utcnow().strftime('%Y%m%d%H%M%S'),
    'agentId': 'main',
    'model': 'openai/gpt-5.2',
    'thinking': 'Running long research with high-quality model',
    'runTimeoutSeconds': 600
}

url = f"{GATEWAY_URL}/api/sessions_spawn"
print('Spawning session ->', url)
res = requests.post(url, headers=headers, data=json.dumps(payload))
print(res.status_code)
print(res.text)
