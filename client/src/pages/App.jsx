import React from 'react'
import { Link } from 'react-router-dom'

export default function App(){
  return (
    <div className="container">
      <h1>TitleClash</h1>
      <nav>
        <Link to="/submit">Submit a Title</Link> | <Link to="/vote">Vote</Link>
      </nav>
      <p>Welcome to TitleClash — submit titles and vote on matches.</p>
    </div>
  )
}
