import React, { useState, useEffect, useMemo } from 'react'
import TitleCard from './TitleCard'
import VsBadge from './VsBadge'
import ReportModal from './ReportModal'
import GameProgress from './GameProgress'
import GameComplete from './GameComplete'
import { useToast } from './Toast'
import api from '../api'
import { useLang } from '../i18n'
import { shortId } from '../utils/shortId'

/**
 * Generate pairwise matchups from submissions list.
 * Shuffles then pairs them two at a time.
 */
function generatePairs(submissions) {
  if (submissions.length < 2) return []
  const shuffled = [...submissions].sort(() => Math.random() - 0.5)
  const pairs = []
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]])
  }
  if (shuffled.length % 2 !== 0) {
    pairs.push([shuffled[shuffled.length - 1], shuffled[0]])
  }
  return pairs
}

export default function ClashArena({ problem, submissions, summary }) {
  const { t } = useLang()
  const toast = useToast()
  const [pairs, setPairs] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [votedPairs, setVotedPairs] = useState({}) // { pairIdx: submissionId }
  const [voteCounts, setVoteCounts] = useState({})
  const [voting, setVoting] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)

  useEffect(() => {
    if (submissions.length >= 2) {
      setPairs(generatePairs(submissions))
    }
  }, [submissions])

  useEffect(() => {
    if (summary && summary.submissions) {
      const counts = {}
      summary.submissions.forEach(s => {
        counts[s.submission_id] = s.vote_count || 0
      })
      setVoteCounts(counts)
    }
  }, [summary])

  const currentPair = pairs[currentIdx]
  const totalPairs = pairs.length
  const isVoted = votedPairs[currentIdx] != null
  const votedCount = Object.keys(votedPairs).length
  const allDone = totalPairs > 0 && isVoted && currentIdx === totalPairs - 1

  // Calculate results for voted pair
  const pairResult = useMemo(() => {
    if (!isVoted || !currentPair) return null
    const a = voteCounts[currentPair[0].id] || 0
    const b = voteCounts[currentPair[1].id] || 0
    const total = a + b
    const pctA = total > 0 ? Math.round((a / total) * 100) : 50
    const pctB = total > 0 ? 100 - pctA : 50
    return {
      left: { votes: a, pct: pctA, isWinner: a >= b },
      right: { votes: b, pct: pctB, isWinner: b > a }
    }
  }, [isVoted, voteCounts, currentPair])

  // 카드 선택 = 즉시 투표
  async function handleSelect(submissionId) {
    if (isVoted || voting) return
    setVoting(true)
    try {
      await api.post('/votes', { submission_id: submissionId })
      setVotedPairs(prev => ({ ...prev, [currentIdx]: submissionId }))
      setVoteCounts(prev => ({
        ...prev,
        [submissionId]: (prev[submissionId] || 0) + 1
      }))
      const summaryRes = await api.get('/votes/summary/' + problem.id)
      if (summaryRes.data && summaryRes.data.submissions) {
        const counts = {}
        summaryRes.data.submissions.forEach(s => {
          counts[s.submission_id] = s.vote_count || 0
        })
        setVoteCounts(counts)
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        // Already voted — treat as success so the game continues
        setVotedPairs(prev => ({ ...prev, [currentIdx]: submissionId }))
        try {
          const summaryRes = await api.get('/votes/summary/' + problem.id)
          if (summaryRes.data && summaryRes.data.submissions) {
            const counts = {}
            summaryRes.data.submissions.forEach(s => {
              counts[s.submission_id] = s.vote_count || 0
            })
            setVoteCounts(counts)
          }
        } catch (_) {}
      } else {
        const msg = err.response?.data?.message || t('clashArena.failedToVote')
        toast.error(msg)
      }
    } finally {
      setVoting(false)
    }
  }

  function goNext() {
    if (currentIdx < totalPairs - 1) {
      setCurrentIdx(currentIdx + 1)
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1)
    }
  }

  if (!currentPair) {
    return (
      <div className="clash-arena">
        <div className="empty-state">
          {t('clashArena.notEnough')}
        </div>
      </div>
    )
  }

  const [left, right] = currentPair

  return (
    <div className="clash-arena animate-fade-in">
      {/* Problem Image */}
      {problem.image_url && (
        <div className="clash-image">
          <img src={problem.image_url} alt={shortId(problem.id)} loading="lazy" />
        </div>
      )}

      {/* Battle Area */}
      <div className="clash-battle">
        <TitleCard
          submission={left}
          side="left"
          likes={voteCounts[left.id] || 0}
          selected={votedPairs[currentIdx] === left.id}
          voted={isVoted}
          result={pairResult?.left}
          onSelect={() => handleSelect(left.id)}
          onReport={() => setReportTarget(left)}
          disabled={voting}
        />

        <VsBadge />

        <TitleCard
          submission={right}
          side="right"
          likes={voteCounts[right.id] || 0}
          selected={votedPairs[currentIdx] === right.id}
          voted={isVoted}
          result={pairResult?.right}
          onSelect={() => handleSelect(right.id)}
          onReport={() => setReportTarget(right)}
          disabled={voting}
        />
      </div>

      {/* After vote: Next button or Completion */}
      {isVoted && !allDone && currentIdx < totalPairs - 1 && (
        <div className="clash-confirm animate-fade-in">
          <button className="btn btn-primary btn-lg" onClick={goNext}>
            {t('clashArena.nextBattle')} &rarr;
          </button>
        </div>
      )}

      {allDone && (
        <GameComplete
          title={t('clashArena.allDoneTitle')}
          description={t('clashArena.allDoneDesc', { count: totalPairs })}
          primaryAction={{ label: t('clashArena.viewResults'), to: '/results/' + problem.id }}
          secondaryAction={{ label: t('clashArena.voteMore'), to: '/rounds' }}
        />
      )}

      {/* Progress & Navigation */}
      <div className="clash-nav">
        <button
          className="btn btn-secondary btn-sm"
          onClick={goPrev}
          disabled={currentIdx === 0}
        >
          &larr; {t('clashArena.prev')}
        </button>

        <GameProgress
          current={votedCount}
          total={totalPairs}
          label={t('clashArena.votedCount', { voted: votedCount, total: totalPairs })}
        />

        <button
          className="btn btn-secondary btn-sm"
          onClick={goNext}
          disabled={currentIdx >= totalPairs - 1}
        >
          {t('clashArena.next')} &rarr;
        </button>
      </div>

      {/* Report Modal */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        submissionId={reportTarget?.id}
        submissionTitle={reportTarget?.title}
      />
    </div>
  )
}
