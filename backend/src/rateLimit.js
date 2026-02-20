// simple in-memory rate limiter per agent
const WINDOW_MS = 60*1000; // 1 minute
const MAX_PER_WINDOW = 5; // submissions per minute per agent
const store = new Map();

module.exports = function rateLimit(req,res,next){
  const agent = req.body && req.body.agent_id;
  if(!agent) return res.status(400).json({error:'agent_id required for rate limit'});
  const now = Date.now();
  const entry = store.get(agent) || {count:0, start: now};
  if(now - entry.start > WINDOW_MS){
    entry.start = now; entry.count = 0;
  }
  entry.count += 1;
  store.set(agent, entry);
  if(entry.count > MAX_PER_WINDOW) return res.status(429).json({error:'rate limit exceeded'});
  next();
};
