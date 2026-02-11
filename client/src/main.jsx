import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Nav from './components/Nav'
import Footer from './components/Footer'
import App from './pages/App'
import RoundsPage from './pages/RoundsPage'
import VotePage from './pages/VotePage'
import ResultsPage from './pages/ResultsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'
import './styles.css'

// Apply saved theme on load
const savedTheme = localStorage.getItem('theme')
if (savedTheme) {
  document.documentElement.dataset.theme = savedTheme
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
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
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <Footer />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
