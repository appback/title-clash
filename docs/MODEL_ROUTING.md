# Model routing & cost-safety for TitleClash / OpenClaw

Goal
- Use github-copilot/gpt-5-mini as default (unlimited subscription) for lightweight tasks.
- Route heavy/high-quality tasks to openai/gpt-5.2 (or later) and enforce cost caps and fallbacks.

Components provided
- apps/api/middleware/modelRouting.ts — Express middleware example that sets X-Model-Override and enforces a simple daily quota for heavy calls.
- scripts/sessions_spawn_research.py — example script to spawn an isolated session via gateway for long research using openai/gpt-5.2.
- infra/model-routing.patch.json — preview of config patch to add model alias and policy snippet.

How it works (high level)
1. API receives request.
2. modelRouting middleware checks: route path OR explicit header/body priority.
3. If heavy and quota/tokens OK -> sets header x-model-override=openai/gpt-5.2 and increments daily counter.
4. If heavy but quota or token estimate too large -> fallback to github-copilot/gpt-5-mini and note the reason.

Deployment notes
- Replace in-memory counter with Redis for multi-process reliability.
- Tune DAILY_QUOTA and maxTokens according to your budget.
- Model override header name (X-Model-Override) is arbitrary; the receiving OpenClaw API/agent must honor it.

Next steps I can do for you
- Apply config patch to gateway (requires approval/exec) to add the openai model alias.
- Drop middleware into the API project and wire it before routes that should be protected.
- Create a cron entry or GitHub Actions workflow to run sessions_spawn_research.py on a schedule.
