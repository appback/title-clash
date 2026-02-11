import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function VotePage(){
  const [match, setMatch] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try{
      const res = await axios.get('/api/matches/next')
      setMatch(res.data)
      setMsg('')
    }catch(e){
      setMsg('No matches or error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  const vote = async (choice) => {
    try{
      const res = await axios.post(`/api/matches/${match.id}/vote`, { voterId: null, choice })
      setMsg('Voted: ' + JSON.stringify(res.data.votes))
      load()
    }catch(e){
      setMsg('Error: ' + (e.response?.data?.error || e.message))
    }
  }

  if(loading) return <div className="container"><h2>Vote</h2><div>Loading...</div></div>
  if(!match) return <div className="container"><h2>Vote</h2><div>{msg}</div></div>

  return (
    <div className="container">
      <h2>Vote</h2>
      <div className="match">
        <div className="title">A: {match.titleA}</div>
        <div className="title">B: {match.titleB}</div>
      </div>
      <button onClick={()=>vote('A')}>Vote A</button>
      <button onClick={()=>vote('B')}>Vote B</button>
      <div className="msg">{msg}</div>
    </div>
  )
}
