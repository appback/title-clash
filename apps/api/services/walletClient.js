// walletClient.js - Agent Wallet integration (fire-and-forget)
const WALLET_URL = process.env.AGENT_WALLET_URL || 'https://wallet.titleclash.com'
const SERVICE_KEY = process.env.AGENT_WALLET_SERVICE_KEY

// Cache: titleclash_agent_id → wallet_agent_id
let agentMap = null

async function loadAgentMap() {
  const res = await fetch(`${WALLET_URL}/api/v1/leaderboard?limit=100`)
  const data = await res.json()
  const map = {}
  for (const agent of data.data || []) {
    const tcId = agent.external_ids?.titleclash_agent_id
    if (tcId) map[tcId] = agent.id
  }
  agentMap = map
  console.log(`[WalletClient] Loaded ${Object.keys(map).length} agent mappings`)
  return map
}

async function getWalletAgentId(titleclashAgentId) {
  if (!agentMap) await loadAgentMap()
  return agentMap[titleclashAgentId] || null
}

/**
 * Credit points to an agent's wallet.
 * Fire-and-forget — errors are logged, never thrown.
 */
async function credit(titleclashAgentId, amount, reference, idempotencyKey) {
  if (!SERVICE_KEY) return null

  try {
    const walletId = await getWalletAgentId(titleclashAgentId)
    if (!walletId) return null

    const res = await fetch(`${WALLET_URL}/api/v1/wallet/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        agent_id: walletId,
        amount,
        reference,
        idempotency_key: idempotencyKey
      })
    })
    const data = await res.json()
    if (data.transaction) {
      console.log(`[WalletClient] Credited ${amount} to ${titleclashAgentId} (ref: ${reference})`)
    }
    return data
  } catch (err) {
    console.error(`[WalletClient] Credit failed:`, err.message)
    return null
  }
}

/** Refresh agent mapping cache (call after new agent registration) */
function refreshCache() {
  agentMap = null
}

module.exports = { credit, refreshCache }
