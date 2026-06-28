const { initDb } = require('./db');
const { resetAndSeedGame } = require('./gameSetup');

async function seed() {
  await initDb();
  await resetAndSeedGame(1);

  console.log('Seed data inserted into neolitico.sqlite');
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
