# OpenClaw Management Guide

## Instances

### Instance 1: 192.168.0.20 (primary)
- **Host**: `ssh au2222@192.168.0.20` (key auth, pw: !au2222!)
- **OpenClaw**: 2026.2.12 (global install — `openclaw` directly)
- **No node/npm** — do NOT use `npx openclaw`
- **Agent**: main → github-copilot/gpt-5-mini
- **TitleClash agent**: openclaw-agent-2 (ID: 133c50a4)

### Instance 2: 192.168.0.30 (multi-agent)
- **Host**: `ssh au2223@192.168.0.30` (key auth, pw: !au2222!)
- **OpenClaw**: 2026.2.13 (via `npx openclaw`)
- **Node**: v22, npm available
- **Agents**:
  - gemini → github-copilot/gemini-2.5-pro → TitleClash: Gemini-Flash (ID: 65bfdfb2)
  - gpt4o → github-copilot/gpt-4o → TitleClash: GPT-4o (ID: 684256dc)
  - haiku → github-copilot/claude-haiku-4.5 → TitleClash: Claude-Haiku (ID: 80d443bd)

### Common Config
- **Config**: `~/.openclaw/openclaw.json` (NEVER overwrite — always merge)
- **Skills dir**: `~/.openclaw/skills/`
- **Workspace**: `~/.openclaw/workspace`

## OpenClaw Config Structure

```
~/.openclaw/
  openclaw.json          # Main config (DO NOT overwrite - merge only)
  .env                   # API keys (OPENAI_API_KEY)
  skills/                # Custom skills directory
    titleclash/
      SKILL.md           # Skill definition
  agents/main/           # Agent config
  completions/           # Shell completions
  workspace/             # Working directory
  credentials/           # Auth credentials
```

## SKILL.md Format (Correct)

```yaml
---
name: skill-name
description: What it does. When to trigger it.
tools: Bash
user-invocable: true
homepage: https://example.com
metadata: {"openclaw": {"requires": {"env": ["ENV_VAR"]}, "emoji": "🏆"}}
---

# Instructions in markdown
(body loaded when skill activates)
```

### Required Fields
- `name` — unique identifier, used as `/name` slash command
- `description` — triggers auto-activation, be descriptive
- `tools` — permission declaration (Bash, Read, Write, etc.)

### Optional Fields
- `user-invocable` — expose as slash command (default: true)
- `homepage` — URL shown in UI
- `metadata` — single-line JSON for gating (env, bins, config, os)
- `disable-model-invocation` — exclude from auto-trigger

### Common Mistakes That Crash OpenClaw
- Missing `tools` field
- Unsupported frontmatter keys (version, author, tags, env)
- Multi-line metadata (must be single-line JSON)
- Overwriting openclaw.json instead of merging

## Managing Skills via SSH

### Install a skill
```bash
ssh au2222@192.168.0.20 'mkdir -p ~/.openclaw/skills/SKILLNAME && curl -s -o ~/.openclaw/skills/SKILLNAME/SKILL.md URL'
```

### Remove a skill
```bash
ssh au2222@192.168.0.20 'rm -rf ~/.openclaw/skills/SKILLNAME'
```

### Add skill config (merge into existing config)
```bash
ssh au2222@192.168.0.20 'python3 -c "
import json
with open(\"/home/au2222/.openclaw/openclaw.json\") as f:
    cfg = json.load(f)
cfg.setdefault(\"skills\", {}).setdefault(\"entries\", {})[\"SKILLNAME\"] = {
    \"enabled\": True,
    \"env\": {\"KEY\": \"VALUE\"}
}
with open(\"/home/au2222/.openclaw/openclaw.json\", \"w\") as f:
    json.dump(cfg, f, indent=2)
print(\"Done\")
"'
```

### Check installed skills
```bash
ssh au2222@192.168.0.20 'ls ~/.openclaw/skills/'
```

### Backup config before changes
```bash
ssh au2222@192.168.0.20 'cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak'
```

## TitleClash Skill

- **Skill path**: `~/.openclaw/skills/titleclash/SKILL.md`
- **Source**: `https://raw.githubusercontent.com/appback/title-clash/main/openclaw/SKILL.md`
- **Token**: configured in openclaw.json > skills.entries.titleclash.env.TITLECLASH_API_TOKEN
- **Agent name**: openclaw-agent-2
- **Agent ID**: 133c50a4-9c0d-46fa-b0a0-c79dfc4704cb
- **Invoke**: `/titleclash` or natural language about TitleClash

## Update Skill from GitHub
```bash
ssh au2222@192.168.0.20 'curl -s -o ~/.openclaw/skills/titleclash/SKILL.md https://raw.githubusercontent.com/appback/title-clash/main/openclaw/SKILL.md'
```

## Programmatic Control (Claude Code → OpenClaw)

### Send message to OpenClaw agent
```bash
ssh au2222@192.168.0.20 "export PATH='/home/au2222/.nvm/versions/node/v22.22.0/bin:\$PATH' && openclaw agent --agent main --message 'your message here' --json --timeout 120"
```

### Token handling (IMPORTANT)
GPT-5-mini refuses to use inline tokens for security. Token must be saved to a file:
```bash
# Token is saved at ~/.titleclash_token on the server
# The agent uses: curl -H "Authorization: Bearer $(cat ~/.titleclash_token)" ...
```

### Play TitleClash (full workflow)
```bash
ssh au2222@192.168.0.20 "export PATH='/home/au2222/.nvm/versions/node/v22.22.0/bin:\$PATH' && openclaw agent --agent main --message 'Play TitleClash! Fetch open problems using token from ~/.titleclash_token, pick one, generate a creative title, and submit it.' --json --timeout 180"
```

### Resume a session
```bash
# Use --session-id to continue a previous conversation
ssh au2222@192.168.0.20 "export PATH='/home/au2222/.nvm/versions/node/v22.22.0/bin:\$PATH' && openclaw agent --agent main --session-id SESSION_ID --message 'your followup' --json --timeout 120"
```

## Multi-Agent Management (Instance 2: 0.30)

### Add a new agent
```bash
npx openclaw agents add <name> \
  --model "github-copilot/<model>" \
  --workspace ~/agents/<name> \
  --non-interactive --json
```

### Register agent on TitleClash
```bash
curl -s -X POST https://titleclash.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name":"<Name>","model_name":"<model>","description":"..."}'
```
Save the `api_token` from response — shown only once.

### Set skill token for agent
```bash
# Global (shared by all agents on this instance)
npx openclaw config set skills.entries.titleclash.env.TITLECLASH_API_TOKEN "<token>"

# Per-run: switch token before running a specific agent
npx openclaw config set skills.entries.titleclash.env.TITLECLASH_API_TOKEN "<agent-specific-token>"
npx openclaw agent --agent <name> --message "..." --timeout 120
```

### List agents
```bash
npx openclaw agents list
```

### Run a specific agent
```bash
npx openclaw agent --agent gemini \
  --message "Play TitleClash: find open problems and submit a title." \
  --timeout 120
```

## Config Structure Reference

```json
{
  "agents": {
    "defaults": { "maxConcurrent": 4 },
    "list": [
      { "id": "main" },
      { "id": "gemini", "model": "github-copilot/gemini-2.5-pro", "workspace": "..." }
    ]
  },
  "skills": {
    "entries": {
      "titleclash": {
        "enabled": true,
        "env": { "TITLECLASH_API_TOKEN": "tc_agent_..." }
      }
    }
  }
}
```

**CRITICAL**: `agents` uses `list[]` array. `skills` uses `entries{}` object. Do NOT mix these up.

## Available Vision Models (github-copilot, free)

| Model | Good for |
|-------|----------|
| gemini-2.5-pro | Fast vision, creative |
| gpt-4o | Proven vision+humor |
| gpt-5-mini | Budget, good enough |
| claude-haiku-4.5 | Fast, witty |
| claude-sonnet-4.5 | High quality |

All support `text+image` input required for TitleClash image analysis.
