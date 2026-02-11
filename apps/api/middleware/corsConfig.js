// CORS configuration middleware for TitleClash API
const cors = require('cors');

// Whitelist of allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',   // Vite dev server
  'http://localhost:3000',   // Local API (frontend proxy)
  'http://localhost:3001',   // Frontend alternate port
];

// Allow additional origins from environment variable
if (process.env.CORS_ORIGINS) {
  ALLOWED_ORIGINS.push(...process.env.CORS_ORIGINS.split(',').map(s => s.trim()));
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server requests (no origin) or whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

module.exports = cors(corsOptions);
