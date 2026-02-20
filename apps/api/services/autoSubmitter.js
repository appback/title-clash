// autoSubmitter.js - AI agent auto-submission when problems open
const Anthropic = require('@anthropic-ai/sdk')
const db = require('../db')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const AGENT_ID = process.env.AUTO_SUBMIT_AGENT_ID
const MODEL = process.env.AUTO_SUBMIT_MODEL || 'claude-sonnet-4-5-20250929'

let client = null

function getClient() {
  if (!client && ANTHROPIC_API_KEY) {
    client = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY })
  }
  return client
}

// Log startup status once
if (!ANTHROPIC_API_KEY) {
  console.warn('[AutoSubmitter] ANTHROPIC_API_KEY not set — auto-submission disabled')
} else if (!AGENT_ID) {
  console.warn('[AutoSubmitter] AUTO_SUBMIT_AGENT_ID not set — auto-submission disabled')
} else {
  console.log(`[AutoSubmitter] Enabled (model: ${MODEL}, agent: ${AGENT_ID})`)
}

const CAPTION_PROMPT = `You are competing in TitleClash — a caption contest inspired by Korean "제목학원" (Title Academy).
Your job is to write the single funniest English one-liner caption for this image.

Rules:
- Study the SPECIFIC expression, posture, context, and absurdity in the image
- Imagine what the subject is thinking/saying, or place it in an absurd everyday situation
- Use irony, sarcasm, wordplay, puns, or unexpected twists
- Reference relatable moments (work, relationships, mornings, diets) or pop culture when it fits
- Keep it punchy: under 100 characters is ideal, max 200
- Do NOT simply describe the image
- Do NOT be generic — the caption must only work for THIS exact image

Respond with ONLY the caption text, nothing else. No quotes, no explanation.`

/**
 * Trigger auto-submissions for the given problem IDs.
 * Fire-and-forget safe — catches all errors internally.
 * @param {string[]} problemIds
 */
async function triggerAutoSubmissions(problemIds) {
  if (!ANTHROPIC_API_KEY || !AGENT_ID) return

  for (const problemId of problemIds) {
    try {
      await submitForProblem(problemId)
    } catch (err) {
      console.error(`[AutoSubmitter] Failed for problem ${problemId}:`, err.message)
    }
  }
}

async function submitForProblem(problemId) {
  // 1. Get problem details
  const problemResult = await db.query(
    'SELECT id, title, description, image_url, state FROM problems WHERE id = $1',
    [problemId]
  )
  if (problemResult.rows.length === 0) {
    console.log(`[AutoSubmitter] Problem ${problemId} not found, skipping`)
    return
  }
  const problem = problemResult.rows[0]

  if (problem.state !== 'open') {
    console.log(`[AutoSubmitter] Problem ${problemId} is '${problem.state}', not open — skipping`)
    return
  }

  if (!problem.image_url) {
    console.log(`[AutoSubmitter] Problem ${problemId} has no image — skipping`)
    return
  }

  // 2. Check if already submitted
  const dupCheck = await db.query(
    'SELECT id FROM submissions WHERE agent_id = $1 AND problem_id = $2 LIMIT 1',
    [AGENT_ID, problemId]
  )
  if (dupCheck.rows.length > 0) {
    console.log(`[AutoSubmitter] Already submitted for problem ${problemId} — skipping`)
    return
  }

  // 3. Download image -> base64
  let imageBase64, mediaType
  try {
    const result = await downloadImage(problem.image_url)
    imageBase64 = result.base64
    mediaType = result.mediaType
  } catch (err) {
    console.error(`[AutoSubmitter] Image download failed for ${problemId}:`, err.message)
    return
  }

  // 4. Call Claude API (with 1 retry)
  let caption
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      caption = await generateCaption(imageBase64, mediaType)
      break
    } catch (err) {
      if (attempt === 2) {
        console.error(`[AutoSubmitter] Claude API failed after 2 attempts for ${problemId}:`, err.message)
        return
      }
      console.warn(`[AutoSubmitter] Claude API attempt ${attempt} failed, retrying...`)
      await sleep(2000)
    }
  }

  if (!caption || caption.trim().length === 0) {
    console.error(`[AutoSubmitter] Empty caption for problem ${problemId} — skipping`)
    return
  }

  caption = caption.trim()
  if (caption.length > 300) caption = caption.substring(0, 300)

  // 5. Insert submission directly (bypass API rate limiter)
  await db.query(
    `INSERT INTO submissions (problem_id, agent_id, title, metadata, status, model_name)
     VALUES ($1, $2, $3, $4, 'active', $5)`,
    [
      problemId,
      AGENT_ID,
      caption,
      JSON.stringify({ source: 'auto-submitter' }),
      MODEL
    ]
  )

  console.log(`[AutoSubmitter] Submitted for problem ${problemId}: "${caption}"`)
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TitleClash-AutoSubmitter/1.0' },
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || ''
  let mediaType = 'image/jpeg'
  if (contentType.includes('png')) mediaType = 'image/png'
  else if (contentType.includes('gif')) mediaType = 'image/gif'
  else if (contentType.includes('webp')) mediaType = 'image/webp'

  const buffer = Buffer.from(await response.arrayBuffer())
  return { base64: buffer.toString('base64'), mediaType }
}

async function generateCaption(imageBase64, mediaType) {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          { type: 'text', text: CAPTION_PROMPT }
        ]
      }
    ]
  })

  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock ? textBlock.text : ''
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = { triggerAutoSubmissions }
