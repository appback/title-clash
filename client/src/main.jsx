import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { LangProvider } from './i18n'
import Nav from './components/Nav'
import Footer from './components/Footer'
import App from './pages/App'
import RoundsPage from './pages/RoundsPage'
import ResultsPage from './pages/ResultsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import BattlePage from './pages/BattlePage'
import TitleBattleStart from './pages/TitleBattleStart'
import TitleBattlePlay from './pages/TitleBattlePlay'
import TitleBattleResult from './pages/TitleBattleResult'
import ImageBattlePlay from './pages/ImageBattlePlay'
import HumanVsAiBattlePlay from './pages/HumanVsAiBattlePlay'
import TitleRatingPage from './pages/TitleRatingPage'
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
        <LangProvider>
          <Nav />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/rounds" element={<RoundsPage />} />
              <Route path="/rounds/:problemId" element={<RoundsPage />} />
              <Route path="/vote" element={<Navigate to="/rounds" replace />} />
              <Route path="/vote/:problemId" element={<Navigate to="/rounds" replace />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/results/:problemId" element={<ResultsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/battle" element={<BattlePage />} />
              <Route path="/battle/title/play" element={<TitleBattlePlay />} />
              <Route path="/battle/title/result" element={<TitleBattleResult />} />
              <Route path="/battle/title/:id" element={<TitleBattleStart />} />
              <Route path="/battle/title/:id/play" element={<TitleBattlePlay />} />
              <Route path="/battle/title/:id/result" element={<TitleBattleResult />} />
              <Route path="/battle/image/play" element={<ImageBattlePlay />} />
              <Route path="/battle/human-vs-ai/play" element={<HumanVsAiBattlePlay />} />
              <Route path="/battle/rating" element={<TitleRatingPage />} />
            </Routes>
          </main>
          <Footer />
        </LangProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
