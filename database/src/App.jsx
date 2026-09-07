import { useEffect, useRef, useState } from 'react';
import { api } from './lib/api.js';
import Icon from './components/Icon.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import DataGrid from './components/DataGrid.jsx';
import Pager from './components/Pager.jsx';
import QueryRunner from './components/QueryRunner.jsx';
import CapacityPanel from './components/CapacityPanel.jsx';
import ProvisionPanel from './components/ProvisionPanel.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';

const DESTRUCTIVE = /\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|REINDEX|VACUUM|COPY)\b/i;
const STORE_KEY = 'db-viewer-sql';
const HIST_KEY = 'db-viewer-history';

export default function App() {
  const [tables, setTables] = useState([]);
  const [status, setStatus] = useState({ msg: 'Connecting…', ok: true });
  const [current, setCurrent] = useState(null);
  const [view, setView] = useState({ table: null, limit: 50, offset: 0, order: null, desc: false, search: '', col: '' });
  const [selected, setSelected] = useState(() => new Map());
  const [err, setErr] = useState(null);

  const [runnerOpen, setRunnerOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [provOpen, setProvOpen] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchCol, setSearchCol] = useState('');
  const [filterText, setFilterText] = useState('');

  const [sqlText, setSqlText] = useState(() => localStorage.getItem(STORE_KEY) || 'SELECT * FROM workers LIMIT 10;');
  const [runStatus, setRunStatus] = useState({ msg: 'Destructive statements need confirmation.', cls: '' });
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem(HIST_KEY) || '[]'));
  const [runnerResult, setRunnerResult] = useState(null);

  const [capData, setCapData] = useState(null);

  const [confirm, setConfirm] = useState(null);
  const confirmResolve = useRef(null);
  const confirmDialog = (opts) => new Promise((resolve) => {
    confirmResolve.current = resolve;
    setConfirm(opts);
  });
  const closeConfirm = (ok) => {
    const r = confirmResolve.current;
    confirmResolve.current = null;
    setConfirm(null);
    if (r) r(ok);
  };

  // ---- tables ----
  const loadTables = async () => {
    setStatus({ msg: 'Connecting…', ok: true });
    try {
      const { data } = await api('/api/db/tables');
      setTables(data);
      setStatus({ msg: `Connected to ${data.length} tables`, ok: true });
    } catch (e) {
      setStatus({ msg: 'Disconnected', ok: false });
      setErr('Failed to load tables: ' + e.message);
    }
  };
  useEffect(() => { loadTables(); }, []);

  // ---- table data ----
  const loadTable = async (v) => {
    if (!v.table) return;
    setStatus({ msg: `Loading ${v.table}…`, ok: true });
    setErr(null);
    const q = `/api/db/table/${encodeURIComponent(v.table)}?limit=${v.limit}&offset=${v.offset}` +
      (v.order ? `&order=${encodeURIComponent(v.order)}` : '') +
      (v.desc ? '&desc=1' : '') +
      (v.search ? `&search=${encodeURIComponent(v.search)}${v.col ? `&column=${encodeURIComponent(v.col)}` : ''}` : '');
    try {
      const data = await api(q);
      setCurrent(data);
      setView((prev) => ({ ...prev, order: data.order }));
      setSelected(new Map());
    } catch (e) {
      setStatus({ msg: 'Error', ok: false });
      setErr(e.message);
    }
  };

  const openTable = async (name) => {
    setSearchText('');
    setSearchCol('');
    const v = { ...view, table: name, offset: 0, search: '', col: '' };
    setView(v);
    setSelected(new Map());
    await loadTable(v);
  };

  const sortBy = (col) => {
    const v = { ...view, offset: 0 };
    if (view.order === col) v.desc = !view.desc;
    else { v.order = col; v.desc = false; }
    setView(v);
    loadTable(v);
  };

  const doSearch = () => {
    const v = { ...view, search: searchText.trim(), col: searchCol, offset: 0 };
    setView(v);
    loadTable(v);
  };

  const doReset = () => {
    setSearchText('');
    setSearchCol('');
    const v = { ...view, search: '', col: '', offset: 0 };
    setView(v);
    loadTable(v);
  };

  const goPrev = () => {
    const v = { ...view, offset: Math.max(0, view.offset - view.limit) };
    setView(v);
    loadTable(v);
  };
  const goNext = () => {
    const v = { ...view, offset: view.offset + view.limit };
    setView(v);
    loadTable(v);
  };

  // ---- row selection ----
  const toggleRow = (k, row, checked) => {
    setSelected((prev) => {
      const m = new Map(prev);
      if (checked) m.set(k, row);
      else m.delete(k);
      return m;
    });
  };
  const toggleAll = (checked) => {
    if (!current) return;
    setSelected((prev) => {
      const m = new Map(prev);
      current.rows.forEach((row) => {
        const k = current.pk.length ? current.pk.map((c) => String(row[c])).join('|') : JSON.stringify(row);
        if (checked) m.set(k, row);
        else m.delete(k);
      });
      return m;
    });
  };

  // ---- delete / drop ----
  const deleteSelected = async () => {
    if (!current || selected.size === 0) return;
    const rows = [...selected.values()];
    const names = rows.slice(0, 8).map((r) => {
      const labelCol = ['name', 'email', 'title', 'id', current.pk[0]].find((c) => r[c] !== undefined) || current.pk[0];
      return String(r[labelCol]);
    });
    const ok = await confirmDialog({
      title: `Delete ${selected.size} row${selected.size > 1 ? 's' : ''} from "${current.table}"?`,
      desc: 'This permanently deletes the selected rows. This cannot be undone.',
      sql: names.join(', ') + (rows.length > 8 ? `\n… and ${rows.length - 8} more` : ''),
      phrase: 'delete',
      inputPlaceholder: 'Type "delete" to confirm',
    });
    if (!ok) return;
    try {
      const r = await api('/api/db/rows/delete', { method: 'POST', body: JSON.stringify({ table: current.table, rows }) });
      setStatus({ msg: `Deleted ${r.rowCount} row(s)`, ok: true });
      await loadTable(view);
    } catch (e) {
      setErr(e.message);
    }
  };

  const dropTable = async () => {
    if (!current) return;
    const t = current.table;
    const ok = await confirmDialog({
      title: `Drop table "${t}"?`,
      desc: 'This permanently deletes the ENTIRE table and all its data. There is no undo.',
      phrase: 'drop ' + t,
      inputPlaceholder: `Type "drop ${t}" to confirm`,
    });
    if (!ok) return;
    try {
      const r = await api('/api/db/drop-table', { method: 'POST', body: JSON.stringify({ table: t }) });
      setCurrent(null);
      setSelected(new Map());
      setStatus({ msg: `Dropped ${r.table}`, ok: true });
      setView((v) => ({ ...v, table: null, offset: 0, search: '', col: '' }));
      await loadTables();
    } catch (e) {
      setErr(e.message);
    }
  };

  // ---- panels ----
  const toggleRunner = () => {
    setRunnerOpen((o) => !o);
    setCapOpen(false);
    setProvOpen(false);
  };
  const toggleCapacity = () => {
    setCapOpen((o) => {
      if (!o) loadCapacity();
      return !o;
    });
    setRunnerOpen(false);
    setProvOpen(false);
  };
  const toggleProvision = () => {
    setProvOpen((o) => !o);
    setRunnerOpen(false);
    setCapOpen(false);
  };
  const newTable = () => {
    if (!runnerOpen) toggleRunner();
    const template = '-- CREATE TABLE example (\n--   id bigserial PRIMARY KEY,\n--   name text NOT NULL\n-- );\n\n';
    setSqlText(template);
    try { localStorage.setItem(STORE_KEY, template); } catch (_) {}
  };

  // ---- query runner ----
  const pushHistory = (sql) => {
    setHistory((h) => {
      if (h[h.length - 1] === sql) return h;
      const nh = [...h, sql].slice(-100);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(nh)); } catch (_) { setHistory((h2) => [...h2].slice(-20)); }
      return nh;
    });
  };
  const runQuery = async () => {
    const sql = sqlText.trim();
    if (!sql) return setRunStatus({ msg: 'Enter a query first', cls: 'err' });
    if (DESTRUCTIVE.test(sql)) {
      const ok = await confirmDialog({
        title: 'Run destructive query?',
        desc: 'This statement can modify or delete data. Review it carefully.',
        sql,
        phrase: 'run',
        inputPlaceholder: 'Type "run" to execute',
      });
      if (!ok) return;
    }
    setRunStatus({ msg: 'running…', cls: '' });
    setRunnerResult(null);
    try {
      const r = await api('/api/db/query', { method: 'POST', body: JSON.stringify({ sql }) });
      pushHistory(sql);
      setRunnerResult(r);
      setRunStatus({ msg: `Done — ${r.rowCount ?? ''} ${r.command}`.trim(), cls: 'ok' });
    } catch (e) {
      setRunStatus({ msg: 'Error: ' + e.message, cls: 'err' });
    }
  };

  // ---- RDS capacity ----
  const loadCapacity = async () => {
    setCapData({ loading: true });
    try {
      setCapData(await api('/api/db/capacity'));
    } catch (e) {
      setCapData({ error: e.message });
    }
  };

  return (
    <div className="antialiased overflow-hidden flex h-screen bg-background-deep text-on-surface">
      <Sidebar
        tables={tables}
        activeTable={view.table}
        capOpen={capOpen}
        provOpen={provOpen}
        filterText={filterText}
        setFilterText={setFilterText}
        onSelectTable={openTable}
        onNewTable={newTable}
        onOpenSqlEditor={toggleRunner}
        onToggleCapacity={toggleCapacity}
        onToggleProvision={toggleProvision}
      />

      <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden relative z-10">
        <Header status={status} onToggleRunner={toggleRunner} />

        <main className="flex-1 overflow-hidden flex flex-col bg-surface">
          <Toolbar
            searchText={searchText}
            setSearchText={setSearchText}
            searchCol={searchCol}
            setSearchCol={setSearchCol}
            columns={current ? current.columns : []}
            onSearch={doSearch}
            onReset={doReset}
            selectedCount={selected.size}
            onDelete={deleteSelected}
            onDrop={dropTable}
            dropDisabled={!current}
          />

          {err && (
            <div className="mx-md mt-md px-3 py-2.5 rounded border border-error/60 bg-error/10 text-error text-body-sm whitespace-pre-wrap">
              {err}
            </div>
          )}

          <CapacityPanel open={capOpen} data={capData} onRefresh={loadCapacity} />
          <ProvisionPanel open={provOpen} onClose={() => setProvOpen(false)} />
          <QueryRunner
            open={runnerOpen}
            sqlText={sqlText}
            setSqlText={setSqlText}
            runStatus={runStatus}
            onRun={runQuery}
            histOpen={histOpen}
            onToggleHist={() => setHistOpen((o) => !o)}
            history={history}
            onPickHistory={() => setHistOpen(false)}
            onClear={() => { setSqlText(''); localStorage.removeItem(STORE_KEY); setRunnerResult(null); setRunStatus({ msg: '', cls: '' }); }}
            result={runnerResult}
          />

          <div className="flex-1 overflow-auto bg-surface-container-lowest">
            {current ? (
              <DataGrid
                current={current}
                order={view.order}
                desc={view.desc}
                onSort={sortBy}
                selected={selected}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center z-10 p-xl rounded-xl border border-border-subtle bg-surface/80 backdrop-blur-sm max-w-sm w-full mx-auto shadow-2xl">
                  <Icon name="database_off" className="text-on-surface-variant mb-4 inline-block" size={36} />
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-2">No rows</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Select a table on the left</p>
                </div>
              </div>
            )}
          </div>

          <Pager
            count={current ? current.count : 0}
            limit={view.limit}
            offset={view.offset}
            onPrev={goPrev}
            onNext={goNext}
          />
        </main>
      </div>

      <ConfirmDialog confirm={confirm} onClose={closeConfirm} />
    </div>
  );
}
