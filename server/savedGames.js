const express = require('express');
const { run, get, all } = require('./db');

const router = express.Router();

// Tabelle che descrivono lo stato di una partita. Le carte (credenze ed eventi) sono
// uguali per tutte le partite, quindi non si salvano.
const SNAPSHOT_TABLES = [
  'territories',
  'players',
  'player_beliefs',
  'settlements',
  'territory_development',
  'game_state',
  'game_log'
];
const CLEAR_ORDER = [
  'player_beliefs',
  'game_log',
  'settlements',
  'territory_development',
  'game_state',
  'players',
  'territories'
];
const MAX_NAME_LENGTH = 60;
const EXPORT_FORMAT = 'neolitico-save';
const EXPORT_VERSION = 1;
const REQUIRED_TABLES = ['territories', 'players', 'game_state'];

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return 'Il file non contiene una partita valida.';
  }

  for (const table of SNAPSHOT_TABLES) {
    const rows = snapshot[table];
    if (rows === undefined && !REQUIRED_TABLES.includes(table)) {
      continue;
    }
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      return `Il file non contiene una partita valida (dati "${table}" non leggibili).`;
    }
    if (REQUIRED_TABLES.includes(table) && rows.length === 0) {
      return `Il file non contiene una partita valida (mancano i dati "${table}").`;
    }
  }

  return null;
}

function safeFileName(name) {
  return String(name).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'partita';
}

async function ensureSavedGamesTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS saved_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      round INTEGER,
      phase TEXT,
      summary TEXT,
      snapshot TEXT NOT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function cleanName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

async function buildSnapshot() {
  const snapshot = {};
  for (const table of SNAPSHOT_TABLES) {
    snapshot[table] = await all(`SELECT * FROM ${table} ORDER BY id`);
  }
  return snapshot;
}

async function insertRows(table, rows) {
  const tableColumns = new Set((await all(`PRAGMA table_info(${table})`)).map((column) => column.name));

  for (const row of rows) {
    // Si accettano solo colonne che esistono davvero nella tabella
    const columns = Object.keys(row).filter((column) => tableColumns.has(column));
    if (columns.length === 0) {
      continue;
    }
    await run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => row[column])
    );
  }
}

async function restoreSnapshot(snapshot) {
  await run('PRAGMA foreign_keys = OFF');
  try {
    await run('BEGIN');
    try {
      for (const table of CLEAR_ORDER) {
        await run(`DELETE FROM ${table}`);
      }
      for (const table of SNAPSHOT_TABLES) {
        await insertRows(table, snapshot[table] ?? []);
      }
      await run('COMMIT');
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  } finally {
    await run('PRAGMA foreign_keys = ON');
  }
}

async function describeCurrentGame() {
  const state = await get(
    `SELECT round, COALESCE(current_phase, phase) AS phase FROM game_state ORDER BY id LIMIT 1`
  );
  const players = await all(
    `SELECT players.name,
            COALESCE(SUM(territory_development.cities), 0) AS cities,
            COALESCE(SUM(territory_development.villages), 0) AS villages
     FROM players
     LEFT JOIN territory_development ON territory_development.player_id = players.id
     GROUP BY players.id
     ORDER BY players.id`
  );
  return {
    round: state?.round ?? null,
    phase: state?.phase ?? null,
    summary: players.map((p) => `${p.name}: ${p.cities} città, ${p.villages} villaggi`).join(' · ')
  };
}

router.get('/saves', async (_req, res) => {
  try {
    await ensureSavedGamesTable();
    const rows = await all(
      'SELECT id, name, round, phase, summary, saved_at FROM saved_games ORDER BY saved_at DESC, id DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/saves', async (req, res) => {
  try {
    await ensureSavedGamesTable();
    const name = cleanName(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, error: 'Scrivi un nome per la partita.' });
    }

    const existing = await get('SELECT id FROM saved_games WHERE name = ?', [name]);
    if (existing && !req.body?.overwrite) {
      return res.status(409).json({
        success: false,
        exists: true,
        error: `Esiste già una partita chiamata "${name}".`
      });
    }

    const info = await describeCurrentGame();
    const snapshot = JSON.stringify(await buildSnapshot());

    if (existing) {
      await run(
        `UPDATE saved_games
         SET round = ?, phase = ?, summary = ?, snapshot = ?, saved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [info.round, info.phase, info.summary, snapshot, existing.id]
      );
    } else {
      await run(
        'INSERT INTO saved_games (name, round, phase, summary, snapshot) VALUES (?, ?, ?, ?, ?)',
        [name, info.round, info.phase, info.summary, snapshot]
      );
    }

    res.json({ success: true, data: { name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/saves/:id/export', async (req, res) => {
  try {
    await ensureSavedGamesTable();
    const saved = await get('SELECT * FROM saved_games WHERE id = ?', [req.params.id]);
    if (!saved) {
      return res.status(404).json({ success: false, error: 'Partita salvata non trovata.' });
    }

    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      name: saved.name,
      round: saved.round,
      phase: saved.phase,
      summary: saved.summary,
      saved_at: saved.saved_at,
      snapshot: JSON.parse(saved.snapshot)
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="neolitico-${safeFileName(saved.name)}.json"`);
    res.send(JSON.stringify(payload));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/saves/import', async (req, res) => {
  try {
    await ensureSavedGamesTable();
    const file = req.body?.file;

    if (!file || file.format !== EXPORT_FORMAT) {
      return res.status(400).json({ success: false, error: 'Il file non è una partita del Neolitico.' });
    }
    if (Number(file.version) > EXPORT_VERSION) {
      return res.status(400).json({ success: false, error: 'Il file viene da una versione più recente del gioco.' });
    }

    const problem = validateSnapshot(file.snapshot);
    if (problem) {
      return res.status(400).json({ success: false, error: problem });
    }

    const name = cleanName(req.body?.name || file.name);
    if (!name) {
      return res.status(400).json({ success: false, error: 'La partita nel file non ha un nome.' });
    }

    const existing = await get('SELECT id FROM saved_games WHERE name = ?', [name]);
    if (existing && !req.body?.overwrite) {
      return res.status(409).json({
        success: false,
        exists: true,
        name,
        error: `Esiste già una partita chiamata "${name}".`
      });
    }

    const values = [
      Number(file.round) || null,
      typeof file.phase === 'string' ? file.phase.slice(0, 40) : null,
      typeof file.summary === 'string' ? file.summary.slice(0, 300) : null,
      JSON.stringify(file.snapshot)
    ];

    if (existing) {
      await run(
        `UPDATE saved_games
         SET round = ?, phase = ?, summary = ?, snapshot = ?, saved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [...values, existing.id]
      );
    } else {
      await run(
        'INSERT INTO saved_games (name, round, phase, summary, snapshot) VALUES (?, ?, ?, ?, ?)',
        [name, ...values]
      );
    }

    res.json({ success: true, data: { name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/saves/:id/load', async (req, res) => {
  try {
    await ensureSavedGamesTable();
    const saved = await get('SELECT id, name, snapshot FROM saved_games WHERE id = ?', [req.params.id]);
    if (!saved) {
      return res.status(404).json({ success: false, error: 'Partita salvata non trovata.' });
    }

    const snapshot = JSON.parse(saved.snapshot);
    const problem = validateSnapshot(snapshot);
    if (problem) {
      return res.status(400).json({ success: false, error: problem });
    }

    await restoreSnapshot(snapshot);
    res.json({ success: true, data: { name: saved.name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/saves/:id', async (req, res) => {
  try {
    await ensureSavedGamesTable();
    const result = await run('DELETE FROM saved_games WHERE id = ?', [req.params.id]);
    if (!result.changes) {
      return res.status(404).json({ success: false, error: 'Partita salvata non trovata.' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
