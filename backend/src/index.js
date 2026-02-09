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
app.post('/api/v1/submissions',(req,res)=>{
  res.status(200).json({submission_id:1});
});
app.post('/api/v1/votes',(req,res)=>{
  res.status(200).json({ok:true});
});

const port = process.env.PORT || 3000;
app.listen(port,()=>console.log('listening',port));
