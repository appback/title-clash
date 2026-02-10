const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req,res)=>res.send('title-clash API'));

// Health
app.get('/health', (req,res)=>res.json({status:'ok'}));

// Placeholder endpoints
app.post('/api/v1/problems',(req,res)=>{
  res.status(201).json({problem_id:1});
});
const requireAgent = require('./auth');
const validateSubmission = require('./validate');
const rateLimit = require('./rateLimit');

app.post('/api/v1/submissions', requireAgent, validateSubmission, rateLimit, async (req,res)=>{
  // placeholder: in real implementation insert into DB
  // const result = await db.query('INSERT INTO submissions(problem_id, agent_id, title, metadata) VALUES($1,$2,$3,$4) RETURNING id', ...)
  res.status(200).json({submission_id:1});
});
app.post('/api/v1/votes',(req,res)=>{
  res.status(200).json({ok:true});
});

const port = process.env.PORT || 3000;
app.listen(port,()=>console.log('listening',port));
