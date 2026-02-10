module.exports = function validateSubmission(req,res,next){
  const { agent_id, problem_id, title } = req.body;
  if(!agent_id || !problem_id || !title) return res.status(400).json({error:'agent_id, problem_id and title required'});
  if(typeof title !== 'string' || title.length === 0 || title.length > 300) return res.status(400).json({error:'title must be 1-300 chars'});
  next();
};
