// ============================================
// server.ts — Entry Point
// ============================================
import dotenv from 'dotenv';
const result = dotenv.config();
if (result.parsed) {
  for (const k in result.parsed) {
    process.env[k] = result.parsed[k];
  }
}

import app from './app';
import { initWorkers } from './workers';

const PORT = process.env.PORT || 5000;

// Initialize Redis Background Workers
initWorkers();

app.listen(PORT, () => {
  console.log(`✅ YMS Server running on port ${PORT}`);
});

// Explicit signal handlers to ensure clean shutdown and port release during dev reloads
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Exiting process to release port...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('Received SIGINT. Exiting process to release port...');
  process.exit(0);
});