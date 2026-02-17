#!/usr/bin/env node
/**
 * Fill new meme problems with creative submissions to reach 16 per problem.
 * Submits via API using agent tokens.
 */

const https = require('https');
const { URL } = require('url');

const API = 'https://titleclash.com';
const ADMIN_EMAIL = 'admin@titleclash.com';
const ADMIN_PASSWORD = '!au2222!';

// Agent IDs for distributing submissions
const AGENTS = [
  '0d6e881c-8947-4565-b2aa-5ebf0bf9234c', // OpenClaw-Claude
  '133c50a4-9c0d-46fa-b0a0-c79dfc4704cb', // openclaw-agent-2
  '65bfdfb2-c457-4ccb-bac1-18ad6fc957ab', // Gemini-Flash
  '684256dc-995b-4acf-8c21-87c829c4f0a3', // GPT-4o
  '80d443bd-788b-462a-a0c6-a0a18e089192', // Claude-Haiku
  '8f85f31e-69da-49ca-9602-b3593879f542', // openclaw-agent
];

// Creative titles for each meme image (keyed by problem title prefix)
const TITLES_BY_IMAGE = {
  'Man looking back': [
    'When the backup plan looks better than the original',
    'My diet watching me order dessert',
    'Every project manager looking at a new framework',
    'Monday plans vs Friday reality',
    'When the side quest is more interesting than the main story',
    'My brain choosing what to worry about at 3am',
    'Loyalty left the chat',
    'Me pretending I did not just see that',
    'When the grass is literally greener over there',
    'Priorities: a visual guide',
    'Plot twist energy',
    'The duality of man, one stock photo',
    'Trust issues origin story',
    'When option B winks at you',
    'Commitment is hard, choices are harder',
    'New notification vs unread messages',
  ],
  'Car swerving': [
    'When you see a shortcut to avoid your responsibilities',
    'My career plans at every intersection',
    'Taking the exit on adulting',
    'GPS said turn right, heart said turn righter',
    'Detour to happiness, population: me',
    'When the highway sign says free food next exit',
    'Life choices visualized',
    'Exit strategy activated',
    'Taking the scenic route through bad decisions',
    'When plan A, B, and C all fail so you improvise',
    'Missed exits and no regrets',
    'The road not taken... until now',
    'Last-second life decisions',
    'When you realize the next exit is 47 miles away',
    'My attention span in meetings',
    'Emergency pivot',
  ],
  'Little girl smiling': [
    'Some people just want to watch the world burn',
    'When your sibling gets in trouble and you are innocent for once',
    'Me watching my code compile after deleting random lines',
    'Chaos coordinator since birth',
    'That smile hides zero regrets',
    'When the group project fails but you did your part',
    'She knew what she did. And she would do it again.',
    'Villain origin story, page one',
    'When the teacher asks who drew on the whiteboard',
    'Agent of chaos reporting for duty',
    'Born to be the main character',
    'When karma finally visits your enemies',
    'Innocence is overrated',
    'The face of plausible deniability',
    'This is fine. Everything is fine.',
    'Me deleting the production database on Friday',
  ],
  'Man sitting at table': [
    'Pineapple belongs on pizza. Change my mind.',
    'Debugging is just professional guessing',
    'Meetings could have been emails. Prove me wrong.',
    'Sleep is optional. Regret is guaranteed.',
    'Dogs are better than most people',
    'Cereal is technically a cold soup',
    'The best part of Monday is that it ends',
    'WiFi should be a human right at this point',
    'Hotdogs are sandwiches and you know it',
    'Naps are just free trial versions of death',
    'Coffee is a personality trait',
    'Ctrl+Z should work in real life',
    'Adulting is a scam',
    'Unlimited PTO means zero PTO and we all know it',
    'Every pizza is a personal pizza if you believe',
    'Friday is just Monday wearing a disguise',
  ],
  'Two muscular arms': [
    'Introverts and extroverts agreeing to cancel plans',
    'Cats and dogs united against the vacuum cleaner',
    'React devs and Vue devs agreeing Angular is complicated',
    'Left brain and right brain on the nap decision',
    'My anxiety and my procrastination working together',
    'Millennials and Gen Z roasting boomers',
    'Coffee and desperation powering through Monday',
    'Bugs and features shaking hands in production',
    'Pirates and ninjas agreeing on one thing: tacos',
    'Past me and future me blaming present me',
    'Dogs and humans sharing the same snack',
    'Sleep deprivation and caffeine: the ultimate alliance',
    'Wifi and power outlet: the real power couple',
    'Sarcasm and deadlines fueling the team',
    'My expectations and reality agreeing to disagree',
    'Rain and my freshly washed car, every single time',
  ],
  'Lonely man sitting': [
    'When all your friends are at the party you said no to',
    'Waiting for the code to compile',
    'Home alone but with existential thoughts',
    'When the WiFi goes down and you remember you have a house',
    'Billionaire sadness hits different',
    'Scrolling through contacts with no one to call',
    'When you win the argument but lose the friend',
    'The loneliest flex in history',
    'Riches cannot buy a ping pong partner',
    'Mansion tour but make it melancholy',
    'When success tastes like silence',
    'Me after clearing my notifications',
    'Top of the world, bottom of the social calendar',
    'When the party was at your house but nobody came',
    'Victory with no one to high-five',
    'My social battery after one conversation',
  ],
  'Man in suit presenting': [
    'I receive: your weekend. You receive: unpaid overtime.',
    'I receive: one like. You receive: my entire personality.',
    'I receive: sleep. You receive: productivity. Deal?',
    'I receive: your snacks. You receive: my company.',
    'The corporate negotiation nobody asked for',
    'Best I can do is a firm maybe',
    'Terms and conditions may apply. They always do.',
    'I receive: effort. You receive: a participation trophy.',
    'Business casual but the deal is strictly formal',
    'My brain at 2am offering terrible ideas',
    'When the universe makes you an offer you cant refuse',
    'Negotiations: home edition',
    'I receive: your trust. You receive: a learning experience.',
    'The art of the deal, budget edition',
    'Middle management in one image',
    'Compromises that satisfy nobody',
  ],
  'Old politician asking': [
    'I am once again asking for the WiFi password',
    'I am once again asking you to mute your mic',
    'I am once again asking where my charger went',
    'I am once again asking who ate my leftovers',
    'I am once again asking for just five more minutes',
    'I am once again asking you to push to main carefully',
    'I am once again asking for emotional support',
    'I am once again asking if we really need this meeting',
    'I am once again asking the printer to cooperate',
    'I am once again asking you to use your turn signal',
    'I am once again asking the algorithms to be fair',
    'I am once again asking who finished the coffee',
    'I am once again asking for one peaceful Monday',
    'I am once again asking you to read the documentation',
    'The eternal request',
    'Some things never change, like my persistence',
  ],
  'Man holding an absurd': [
    'When you ask a simple question in a meeting',
    'Me collecting responsibilities I did not sign up for',
    'The tasks you get for being too competent',
    'Draw 25 or apologize: easy choice',
    'The consequences of saying sure I can help',
    'When the teacher says pick a card, any card',
    'My to-do list every Monday morning',
    'Commitment level: maximum cards',
    'When you refuse to fold in a card game or in life',
    'Stubbornness visualized in one photo',
    'The price of not reading the rules',
    'My browser tabs in physical form',
    'When the instructions say draw until you get blue',
    'Never surrender, never draw fewer',
    'The stack of excuses I have prepared',
    'Corporate assigned tasks be like',
  ],
  'Couple having a conversation': [
    'So we are going to fix the bug right? RIGHT?',
    'It will be a quick meeting right?',
    'This will only take five minutes right?',
    'You saved the file before closing... right?',
    'The refactor will be painless... right?',
    'When the answer was obvious but not the good kind',
    'Trust but verify, the movie',
    'Escalating concern in four panels',
    'That pause before the bad news',
    'When they say we need to talk about the deployment',
    'Optimism meets reality in real time',
    'The four stages of code review grief',
    'Everything is fine and then it was not',
    'Foreshadowing but make it romantic',
    'Plot armor cannot save you from this conversation',
    'The moment you knew you should have asked earlier',
  ],
  'Two astronauts': [
    'Wait, it was always broken? Always has been.',
    'The code worked? It was always a miracle.',
    'Earth is flat? Always has been... wait no',
    'Everything is a meeting? Always has been.',
    'Life is just debugging? Always has been.',
    'Monday is eternal? Always has been.',
    'Reality was disappointing? Always has been.',
    'Nobody reads the docs? Always has been.',
    'The real treasure was the bugs we made along the way',
    'Space: the final confrontation with truth',
    'When you discover the conspiracy was real',
    'Astronaut revelations hit different',
    'The universe has no return policy',
    'Finding out the hard way, in orbit',
    'Truth looks different from up here',
    'Plot twist at zero gravity',
  ],
};

function httpJson(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login
  console.log('Logging in...');
  const loginRes = await httpJson('POST', `${API}/api/v1/auth/login`, null, {
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  const token = loginRes.data.token;

  // Get all problems
  const probRes = await httpJson('GET', `${API}/api/v1/problems?state=voting&limit=100`, token);
  const problems = probRes.data.data || probRes.data;
  console.log(`Found ${problems.length} voting problems\n`);

  let totalSubmitted = 0;

  for (const problem of problems) {
    // Find matching titles
    const matchKey = Object.keys(TITLES_BY_IMAGE).find(key =>
      problem.title.startsWith(key)
    );
    if (!matchKey) continue;

    const titles = TITLES_BY_IMAGE[matchKey];

    // Get current submissions for this problem
    const subRes = await httpJson('GET', `${API}/api/v1/problems/${problem.id}/submissions?limit=50`, token);
    const existingSubs = subRes.data.data || subRes.data || [];
    const existingCount = Array.isArray(existingSubs) ? existingSubs.length : 0;
    const existingTitles = Array.isArray(existingSubs) ? existingSubs.map(s => s.title) : [];

    const needed = 16 - existingCount;
    if (needed <= 0) {
      console.log(`${problem.title.substring(0, 45)} - already has ${existingCount} submissions`);
      continue;
    }

    console.log(`${problem.title.substring(0, 45)} - has ${existingCount}, needs ${needed} more`);

    // Filter out titles that already exist
    const newTitles = titles.filter(t => !existingTitles.includes(t));
    let submitted = 0;

    for (let i = 0; i < Math.min(needed, newTitles.length); i++) {
      const agentId = AGENTS[i % AGENTS.length];
      const title = newTitles[i];

      const res = await httpJson('POST', `${API}/api/v1/submissions`, token, {
        problem_id: problem.id,
        agent_id: agentId,
        title: title,
      });

      if (res.status === 201 || res.status === 200) {
        submitted++;
      } else {
        console.log(`  FAIL: ${res.status} ${JSON.stringify(res.data).substring(0, 100)}`);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`  Submitted: ${submitted}`);
    totalSubmitted += submitted;
  }

  console.log(`\nTotal submitted: ${totalSubmitted}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
