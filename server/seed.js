const { initDb } = require('./db');
const { resetGameSession } = require('./gameSetup');

async function seed() {
  await initDb();
  await resetGameSession(1);

  console.log('Seed data inserted into neolitico.sqlite');
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
