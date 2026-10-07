import { useRef, useState } from 'react';

function formatDate(value) {
  if (!value) {
    return '';
  }
  // SQLite salva l'ora in UTC senza indicazione del fuso
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function SavedGames({ saves = [], currentName = '', onSave, onLoad, onExport, onImport, onDelete }) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (_err) {
      // il messaggio di errore è già mostrato in alto da App
    } finally {
      setBusy(false);
    }
  };

  const handleSave = (event) => {
    event.preventDefault();
    run(() => onSave(name));
  };

  const handleFileChosen = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      run(() => onImport(file));
    }
  };

  return (
    <div>
      <h2>Partite salvate</h2>
      <form className="save-form" onSubmit={handleSave}>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder='Nome della partita, es. "3B – 15 gennaio"'
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={busy || !name.trim()}>Salva partita</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          Importa da file
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={handleFileChosen} />
      </form>
      <p className="hint">
        Salva lo stato attuale: round, fase, risorse, insediamenti, prede e diario. Con Esporta ottieni un file da portare su chiavetta; con Importa da file lo aggiungi all'elenco di un altro computer.
      </p>
      {saves.length === 0 ? (
        <p className="hint">Nessuna partita salvata.</p>
      ) : (
        <ul className="save-list">
          {saves.map((save) => (
            <li key={save.id}>
              <div className="save-info">
                <strong>{save.name}</strong>
                <span>Round {save.round ?? '-'} · {formatDate(save.saved_at)}</span>
                {save.summary && <span>{save.summary}</span>}
              </div>
              <div className="save-actions">
                <button type="button" disabled={busy} onClick={() => run(() => onLoad(save))}>Carica</button>
                <button type="button" className="secondary" disabled={busy} onClick={() => run(() => onExport(save))}>Esporta</button>
                <button type="button" className="danger" disabled={busy} onClick={() => run(() => onDelete(save))}>Elimina</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SavedGames;
