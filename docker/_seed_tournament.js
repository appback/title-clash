// Seed script: create a Title Battle tournament from existing problems
// Run inside API container: docker exec -it <api-container> node /app/_seed_tournament.js
// Or copy + exec: docker cp _seed_tournament.js <api>:/app/ && docker exec <api> node /app/_seed_tournament.js

const { Pool } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/titleclash'
const pool = new Pool({ connectionString: DATABASE_URL })

async function q(text, params) {
  const res = await pool.query(text, params)
  return res.rows
}

async function seed() {
  console.log('=== Tournament Seed Script ===')

  // 1. Run migration if tables don't exist
  console.log('\n1. Checking tournament tables...')
  const tableCheck = await q(`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments'
  )`)

  if (!tableCheck[0].exists) {
    console.log('   Creating tournament tables...')
    const fs = require('fs')
    const path = require('path')

    // Try different paths
    let migrationPath = '/docker-entrypoint-initdb.d/010_create_tournaments.sql'
    if (!fs.existsSync(migrationPath)) {
      migrationPath = path.join(__dirname, '..', 'db', 'migrations', '010_create_tournaments.sql')
    }
    if (!fs.existsSync(migrationPath)) {
      // Read from the known location
      migrationPath = '/app/010_create_tournaments.sql'
    }

    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8')
      await pool.query(sql)
      console.log('   Tables created!')
    } else {
      console.log('   Migration file not found, running inline...')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          content_type TEXT NOT NULL DEFAULT 'title_battle',
          problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
          phase TEXT NOT NULL DEFAULT 'draft',
          total_rounds INTEGER NOT NULL DEFAULT 4,
          current_round INTEGER NOT NULL DEFAULT 0,
          human_submissions_open BOOLEAN DEFAULT false,
          participant_count INTEGER DEFAULT 0,
          config JSONB DEFAULT '{}',
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tournament_type ON tournaments(content_type);
        CREATE INDEX IF NOT EXISTS idx_tournament_phase ON tournaments(phase);
        CREATE INDEX IF NOT EXISTS idx_tournament_problem ON tournaments(problem_id);

        CREATE TABLE IF NOT EXISTS tournament_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
          source TEXT NOT NULL DEFAULT 'ai',
          title TEXT NOT NULL,
          image_url TEXT,
          author_name TEXT NOT NULL,
          model_name TEXT,
          seed INTEGER,
          is_eliminated BOOLEAN DEFAULT false,
          final_rank INTEGER,
          total_votes_received INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tent_tournament ON tournament_entries(tournament_id);

        CREATE TABLE IF NOT EXISTS tournament_matches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          round TEXT NOT NULL,
          match_order INTEGER NOT NULL,
          entry_a_id UUID REFERENCES tournament_entries(id),
          entry_b_id UUID REFERENCES tournament_entries(id),
          winner_id UUID REFERENCES tournament_entries(id),
          vote_count_a INTEGER DEFAULT 0,
          vote_count_b INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          next_match_id UUID REFERENCES tournament_matches(id),
          started_at TIMESTAMPTZ,
          ended_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tmatch_tournament ON tournament_matches(tournament_id);
        CREATE INDEX IF NOT EXISTS idx_tmatch_status ON tournament_matches(status);

        CREATE TABLE IF NOT EXISTS tournament_votes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          match_id UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
          entry_id UUID NOT NULL REFERENCES tournament_entries(id),
          voter_id UUID REFERENCES users(id) ON DELETE SET NULL,
          voter_token TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tvote_match_user
          ON tournament_votes(match_id, voter_id) WHERE voter_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tvote_match_token
          ON tournament_votes(match_id, voter_token) WHERE voter_token IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_tvote_match ON tournament_votes(match_id);
      `)
      console.log('   Tables created inline!')
    }
  } else {
    console.log('   Tournament tables exist.')
  }

  // 2. Get problems with enough submissions
  console.log('\n2. Finding problems with enough submissions...')
  const problems = await q(`
    SELECT p.id, p.title, p.image_url,
           COUNT(s.id)::int AS sub_count
    FROM problems p
    JOIN submissions s ON s.problem_id = p.id AND s.status = 'active'
    GROUP BY p.id
    HAVING COUNT(s.id) >= 4
    ORDER BY COUNT(s.id) DESC
    LIMIT 5
  `)

  console.log(`   Found ${problems.length} eligible problems`)

  if (problems.length === 0) {
    console.log('   No problems with enough submissions. Run _seed_bulk.js first.')
    process.exit(0)
  }

  // 3. Get admin user
  const admins = await q("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
  const adminId = admins.length > 0 ? admins[0].id : null

  // 4. Create tournaments
  console.log('\n3. Creating tournaments...')

  for (const problem of problems) {
    // Check if tournament already exists for this problem
    const existing = await q(
      'SELECT id FROM tournaments WHERE problem_id = $1 AND content_type = $2',
      [problem.id, 'title_battle']
    )

    if (existing.length > 0) {
      console.log(`   Skipping "${problem.title}" - tournament exists`)
      continue
    }

    // Create tournament
    const [tournament] = await q(
      `INSERT INTO tournaments (title, content_type, problem_id, created_by)
       VALUES ($1, 'title_battle', $2, $3)
       RETURNING id, title`,
      [`Title Battle: ${problem.title}`, problem.id, adminId]
    )
    console.log(`   Created: "${tournament.title}" (${problem.sub_count} entries)`)

    // Import submissions as entries
    const subs = await q(`
      SELECT s.id, s.title, a.name AS agent_name, s.model_name
      FROM submissions s
      LEFT JOIN agents a ON a.id = s.agent_id
      WHERE s.problem_id = $1 AND s.status = 'active'
      ORDER BY RANDOM()
    `, [problem.id])

    // Take up to 16 entries (good bracket size)
    const entries = subs.slice(0, 16)

    for (let i = 0; i < entries.length; i++) {
      const s = entries[i]
      await q(
        `INSERT INTO tournament_entries
         (tournament_id, submission_id, source, title, author_name, model_name, seed)
         VALUES ($1, $2, 'ai', $3, $4, $5, $6)`,
        [tournament.id, s.id, s.title, s.agent_name || 'Unknown', s.model_name, i + 1]
      )
    }

    console.log(`   Added ${entries.length} entries`)

    // Generate bracket + start first tournament
    if (problem === problems[0]) {
      console.log('   Starting first tournament (generating bracket)...')
      await generateBracketAndStart(tournament.id, entries.length)
    }
  }

  console.log('\n=== Done! ===')
  process.exit(0)
}

// Simple bracket generation (mirror of services/bracket.js logic)
async function generateBracketAndStart(tournamentId, entryCount) {
  const size = Math.pow(2, Math.ceil(Math.log2(entryCount)))
  const rounds = Math.log2(size)

  const ROUND_NAMES = {
    1: 'final', 2: 'semi', 4: 'quarter',
    8: 'round_of_16', 16: 'round_of_32'
  }

  // Get entries sorted by seed
  const entries = await q(
    'SELECT id, seed FROM tournament_entries WHERE tournament_id = $1 ORDER BY seed ASC',
    [tournamentId]
  )

  // Simple sequential placement
  const slots = new Array(size).fill(null)
  for (let i = 0; i < entries.length; i++) {
    slots[i] = entries[i]
  }

  // Create rounds from first to final
  const roundDefs = []
  for (let r = 0; r < rounds; r++) {
    const matchCount = Math.pow(2, rounds - r - 1)
    const roundName = ROUND_NAMES[matchCount] || `round_of_${matchCount * 2}`
    roundDefs.push({ round: roundName, count: matchCount })
  }

  const allMatches = []

  for (let r = 0; r < roundDefs.length; r++) {
    const { round, count } = roundDefs[r]
    const roundMatches = []

    for (let m = 0; m < count; m++) {
      let entryA = null, entryB = null, winnerId = null, status = 'pending'

      if (r === 0) {
        entryA = slots[m * 2] ? slots[m * 2].id : null
        entryB = slots[m * 2 + 1] ? slots[m * 2 + 1].id : null

        if (entryA && !entryB) { winnerId = entryA; status = 'completed' }
        else if (!entryA && entryB) { winnerId = entryB; status = 'completed' }
      }

      const [match] = await q(
        `INSERT INTO tournament_matches
         (tournament_id, round, match_order, entry_a_id, entry_b_id, winner_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tournamentId, round, m + 1, entryA, entryB, winnerId, status]
      )
      roundMatches.push({ ...match, winner_id: winnerId, match_order: m + 1 })
    }
    allMatches.push(roundMatches)
  }

  // Link next_match_id and advance byes
  for (let r = 0; r < allMatches.length - 1; r++) {
    for (let m = 0; m < allMatches[r].length; m++) {
      const nextMatch = allMatches[r + 1][Math.floor(m / 2)]
      await q('UPDATE tournament_matches SET next_match_id = $1 WHERE id = $2',
        [nextMatch.id, allMatches[r][m].id])

      if (allMatches[r][m].winner_id) {
        const slot = m % 2 === 0 ? 'entry_a_id' : 'entry_b_id'
        await q(`UPDATE tournament_matches SET ${slot} = $1 WHERE id = $2`,
          [allMatches[r][m].winner_id, nextMatch.id])
      }
    }
  }

  // Activate first round matches
  await q(`
    UPDATE tournament_matches
    SET status = 'active', started_at = NOW()
    WHERE tournament_id = $1
      AND entry_a_id IS NOT NULL AND entry_b_id IS NOT NULL
      AND status = 'pending'
      AND round = $2
  `, [tournamentId, roundDefs[0].round])

  // Update tournament phase
  await q(
    "UPDATE tournaments SET phase = 'playing', total_rounds = $1, current_round = 1 WHERE id = $2",
    [rounds, tournamentId]
  )

  console.log(`   Bracket generated: ${size} bracket, ${rounds} rounds`)
}

seed().catch(err => {
  console.error('Seed error:', err)
  process.exit(1)
})
