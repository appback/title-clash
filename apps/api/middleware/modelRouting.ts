// Express middleware: modelRouting
// - Tags heavy requests and sets X-Model-Override header for OpenClaw
// - Enforces per-request max tokens and daily heavy-call quota (in-memory simple counter)

import { Request, Response, NextFunction } from 'express'

// Simple in-memory quota (replace with Redis for production)
const DAILY_QUOTA = 200
let heavyCountToday = 0
let quotaResetTs = getStartOfToday()

function getStartOfToday() {
  const d = new Date()
  d.setUTCHours(0,0,0,0)
  return d.getTime()
}

function resetQuotaIfNeeded() {
  const now = Date.now()
  if (now - quotaResetTs >= 24*60*60*1000) {
    heavyCountToday = 0
    quotaResetTs = getStartOfToday()
  }
}

interface HeavyOptions {
  maxTokens?: number
  heavyModel?: string
  fallbackModel?: string
}

export function modelRouting(options: HeavyOptions = {}) {
  const maxTokens = options.maxTokens ?? 3000
  const heavyModel = options.heavyModel ?? 'openai/gpt-5.2'
  const fallbackModel = options.fallbackModel ?? 'github-copilot/gpt-5-mini'

  return (req: Request, res: Response, next: NextFunction) => {
    resetQuotaIfNeeded()

    // Determine "heavy" by route or explicit header
    const isHeavyRoute = req.path.startsWith('/api/research') || req.path.startsWith('/api/longtask')
    const explicitHeavy = req.header('X-Priority') === 'heavy' || (req.body && req.body.priority === 'heavy')

    const wantHeavy = isHeavyRoute || explicitHeavy

    // simple token estimate: look at prompt length
    const prompt = (req.body && (req.body.prompt || req.body.text || req.body.query)) || ''
    const estTokens = Math.ceil((String(prompt).length / 4)) // rough

    if (wantHeavy) {
      // quota check
      if (heavyCountToday >= DAILY_QUOTA) {
        // deny heavy, fall back to mini
        req.headers['x-model-override'] = fallbackModel
        req.headers['x-routing-note'] = 'quota_exceeded_fallback'
        return next()
      }

      if (estTokens > maxTokens) {
        // too large for heavy call; mark and fallback
        req.headers['x-model-override'] = fallbackModel
        req.headers['x-routing-note'] = 'tokens_too_large_fallback'
        return next()
      }

      // Approve heavy: increment counter and set override
      heavyCountToday += 1
      req.headers['x-model-override'] = heavyModel
      req.headers['x-routing-note'] = 'routed_heavy'
      return next()
    }

    // default: use lightweight model (no override or explicit fallback)
    req.headers['x-model-override'] = fallbackModel
    req.headers['x-routing-note'] = 'routed_default'
    return next()
  }
}

export default modelRouting
