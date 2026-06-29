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
      if (!columnNames.has('resource_gain')) {
        statements.push('ALTER TABLE belief_cards ADD COLUMN resource_gain INTEGER DEFAULT 0');
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
      if (!columnNames.has('has_moved_this_turn')) {
        statements.push('ALTER TABLE players ADD COLUMN has_moved_this_turn INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('has_gathered_this_turn')) {
        statements.push('ALTER TABLE players ADD COLUMN has_gathered_this_turn INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('shelters_to_place')) {
        statements.push('ALTER TABLE players ADD COLUMN shelters_to_place INTEGER NOT NULL DEFAULT 6');
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

function ensureTerritoryColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(territories)', (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const columnNames = new Set(columns.map((column) => column.name));
      const statements = [];

      if (!columnNames.has('total_prey')) {
        statements.push('ALTER TABLE territories ADD COLUMN total_prey INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('prey_capacity')) {
        statements.push('ALTER TABLE territories ADD COLUMN prey_capacity INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('prey_remaining')) {
        statements.push('ALTER TABLE territories ADD COLUMN prey_remaining INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('shelter_yield')) {
        statements.push('ALTER TABLE territories ADD COLUMN shelter_yield INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('village_yield')) {
        statements.push('ALTER TABLE territories ADD COLUMN village_yield INTEGER NOT NULL DEFAULT 0');
      }
      if (!columnNames.has('city_yield')) {
        statements.push('ALTER TABLE territories ADD COLUMN city_yield INTEGER NOT NULL DEFAULT 0');
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

function ensureTerritoryDevelopmentConstraints() {
  return new Promise((resolve, reject) => {
    db.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_territory_development_player_territory ON territory_development(player_id, territory_id)',
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

function ensureGameStateColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(game_state)', (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      const columnNames = new Set(columns.map((column) => column.name));
      const statements = [];

      if (!columnNames.has('phase')) {
        statements.push("ALTER TABLE game_state ADD COLUMN phase TEXT NOT NULL DEFAULT 'setup_placement'");
      }
      if (!columnNames.has('current_phase')) {
        statements.push("ALTER TABLE game_state ADD COLUMN current_phase TEXT NOT NULL DEFAULT 'setup_placement'");
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
        prey_capacity INTEGER NOT NULL DEFAULT 0,
        total_prey INTEGER NOT NULL DEFAULT 0,
        prey_remaining INTEGER NOT NULL DEFAULT 0,
        shelter_yield INTEGER NOT NULL DEFAULT 0,
        village_yield INTEGER NOT NULL DEFAULT 0,
        city_yield INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tribe TEXT NOT NULL,
        resources INTEGER NOT NULL DEFAULT 10,
        current_territory_id INTEGER,
        has_moved_this_turn INTEGER NOT NULL DEFAULT 0,
        has_gathered_this_turn INTEGER NOT NULL DEFAULT 0,
        shelters_to_place INTEGER NOT NULL DEFAULT 6,
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
        resource_gain INTEGER DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS territory_development (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        territory_id INTEGER NOT NULL,
        shelters INTEGER NOT NULL DEFAULT 0,
        villages INTEGER NOT NULL DEFAULT 0,
        cities INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(territory_id) REFERENCES territories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS game_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        current_player_id INTEGER,
        round INTEGER NOT NULL DEFAULT 1,
        phase TEXT NOT NULL DEFAULT 'setup_placement',
        current_phase TEXT NOT NULL DEFAULT 'setup_placement',
        FOREIGN KEY(current_player_id) REFERENCES players(id)
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

      Promise.all([
        ensureBeliefCardColumns(),
        ensurePlayerColumns(),
        ensureTerritoryColumns(),
        ensureSettlementConstraints(),
        ensureTerritoryDevelopmentConstraints(),
        ensureGameStateColumns()
      ])
        .then(() => run(
          `UPDATE game_state
           SET current_phase = COALESCE(phase, current_phase, 'setup_placement')`
        ))
        .then(() => run(
          `UPDATE belief_cards
           SET resource_gain = CASE
             WHEN cost <= 2 THEN 2
             WHEN cost <= 4 THEN 3
             ELSE 5
           END
           WHERE COALESCE(resource_gain, 0) = 0`
        ))
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
