require('dotenv').config();

const VALID_TOKENS = (process.env.AGENT_TOKENS || '').split(',').filter(Boolean);

module.exports = function requireAgentToken(req,res,next){
  const auth = req.headers['authorization'];
  if(!auth || !auth.startsWith('Bearer ')) return res.status(401).json({error:'missing token'});
  const token = auth.slice(7);
  if(VALID_TOKENS.includes(token)) return next();
  return res.status(403).json({error:'invalid token'});
};
