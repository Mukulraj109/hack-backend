import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { initializeFirebase } from './config/firebase.js';
import { getEnv } from './config/env.js';

async function main() {
  try {
    const env = getEnv();

    await connectDatabase();

    initializeFirebase();

    const app = createApp();

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(`📚 API: http://localhost:${env.PORT}/api`);
      console.log(`🏥 Health: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
