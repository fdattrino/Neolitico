const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'neolitico.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    return;
  }
  console.log(`Connected to SQLite database at ${dbPath}`);
});

function ensureBeliefCardColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(belief_cards)', (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const columnNames = new Set(columns.map((column) => column.name));
      const statements = [];

      if (!columnNames.has('number')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN number INTEGER');
      }
      if (!columnNames.has('title')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN title TEXT');
      }
      if (!columnNames.has('technology')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN technology TEXT');
      }
      if (!columnNames.has('type_code')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN type_code TEXT');
      }
      if (!columnNames.has('effect_text')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN effect_text TEXT');
      }

      const runNext = () => {
        if (statements.length === 0) {
          resolve();
          return;
        }

        const statement = statements.shift();
        db.run(statement, (alterErr) => {
          if (alterErr) {
            reject(alterErr);
            return;
          }
          runNext();
        });
      };

      runNext();
    });
  });
}

function ensurePlayerColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(players)', (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const columnNames = new Set(columns.map((column) => column.name));
      const statements = [];

      if (!columnNames.has('current_territory_id')) {
        statements.push('ALTER TABLE players ADD COLUMN current_territory_id INTEGER REFERENCES territories(id)');
      }

      const runNext = () => {
        if (statements.length === 0) {
          resolve();
          return;
        }

        const statement = statements.shift();
        db.run(statement, (alterErr) => {
          if (alterErr) {
            reject(alterErr);
            return;
          }
          runNext();
        });
      };

      runNext();
    });
  });
}

function ensureSettlementConstraints() {
  return new Promise((resolve, reject) => {
    db.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_player_territory ON settlements(player_id, territory_id)',
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

function initDb() {
  return new Promise((resolve, reject) => {
    const schema = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS territories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        terrain_type TEXT NOT NULL,
        description TEXT NOT NULL,
        resource_bonus TEXT NOT NULL,
        position_x INTEGER NOT NULL,
        position_y INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tribe TEXT NOT NULL,
        resources INTEGER NOT NULL DEFAULT 10,
        current_territory_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(current_territory_id) REFERENCES territories(id)
      );

      CREATE TABLE IF NOT EXISTS belief_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT,
        description TEXT NOT NULL,
        technology TEXT,
        type_code TEXT,
        cost INTEGER NOT NULL,
        effect_text TEXT,
        number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS player_beliefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        belief_card_id INTEGER NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(belief_card_id) REFERENCES belief_cards(id) ON DELETE CASCADE,
        UNIQUE(player_id, belief_card_id)
      );

      CREATE TABLE IF NOT EXISTS event_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        effect_type TEXT NOT NULL,
        effect_value INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        territory_id INTEGER NOT NULL,
        level TEXT NOT NULL CHECK(level IN ('riparo', 'villaggio', 'citta')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(territory_id) REFERENCES territories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS game_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        message TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    db.exec(schema, (err) => {
      if (err) {
        reject(err);
        return;
      }

      Promise.all([ensureBeliefCardColumns(), ensurePlayerColumns(), ensureSettlementConstraints()])
        .then(() => resolve())
        .catch(reject);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

module.exports = { db, initDb, run, get, all };
