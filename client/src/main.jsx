import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import App from './pages/App'
import RoundsPage from './pages/RoundsPage'
import VotePage from './pages/VotePage'
import ResultsPage from './pages/ResultsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Nav />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/rounds" element={<RoundsPage />} />
          <Route path="/vote" element={<VotePage />} />
          <Route path="/vote/:problemId" element={<VotePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:problemId" element={<ResultsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  </React.StrictMode>
)
