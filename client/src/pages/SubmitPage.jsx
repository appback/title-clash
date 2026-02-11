import React, { useState } from 'react'
import axios from 'axios'

export default function SubmitPage(){
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    try{
      const res = await axios.post('/api/titles', { title })
      setMsg('Submitted: ' + res.data.id)
      setTitle('')
    }catch(e){
      setMsg('Error: ' + (e.response?.data?.error || e.message))
    }
  }

  return (
    <div className="container">
      <h2>Submit a Title</h2>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter title" />
      <button onClick={submit}>Submit</button>
      <div className="msg">{msg}</div>
    </div>
  )
}
