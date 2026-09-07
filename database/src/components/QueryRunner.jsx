import DataGrid from './DataGrid.jsx';

export default function QueryRunner({ open, sqlText, setSqlText, runStatus, onRun, histOpen, onToggleHist, history, onPickHistory, onClear, result }) {
  if (!open) return null;
  const runCls = runStatus.cls === 'ok' ? 'text-primary' : runStatus.cls === 'err' ? 'text-error' : 'text-on-surface-variant';

  return (
    <div className="mx-md my-md border border-border-subtle rounded bg-surface-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface-container-high border-b border-border-subtle">
        <span className="font-headline-md text-headline-md font-bold text-on-surface">Query Runner</span>
        <span className="flex-1"></span>
        <button onClick={onToggleHist} className="px-2.5 py-1 rounded border border-border-subtle bg-surface text-on-surface font-body-sm text-body-sm hover:border-primary hover:text-primary transition-colors cursor-pointer">
          History
        </button>
        <button onClick={onClear} className="px-2.5 py-1 rounded border border-border-subtle bg-surface text-on-surface font-body-sm text-body-sm hover:border-primary hover:text-primary transition-colors cursor-pointer">
          Clear
        </button>
      </div>

      <textarea
        value={sqlText}
        onChange={(e) => { setSqlText(e.target.value); try { localStorage.setItem('db-viewer-sql', e.target.value); } catch (_) {} }}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); } }}
        spellCheck={false}
        placeholder="Enter SQL…  (Ctrl+Enter to run)"
        className="w-full min-h-[110px] resize-y px-3 py-2.5 bg-surface-card text-on-surface font-code-snippet text-code-snippet outline-none border-b border-border-subtle"
      />

      <div className="flex items-center gap-2.5 px-3 py-2">
        <button onClick={onRun} className="bg-primary-container text-on-primary-fixed-variant font-semibold px-4 py-1.5 rounded font-body-sm text-body-sm hover:bg-primary-fixed transition-colors cursor-pointer">
          Run
        </button>
        <span className={`font-body-sm text-body-sm ${runCls}`}>{runStatus.msg}</span>
      </div>

      {histOpen && (
        <div className="max-h-[200px] overflow-auto border-t border-border-subtle">
          {history.length === 0 ? (
            <div className="hist-item">No history yet</div>
          ) : (
            [...history].reverse().slice(0, 30).map((sql, i) => (
              <div
                key={i}
                className="hist-item"
                onClick={() => { setSqlText(sql); try { localStorage.setItem('db-viewer-sql', sql); } catch (_) {} onPickHistory(); }}
              >
                {sql.length > 400 ? sql.slice(0, 400) + '…' : sql}
              </div>
            ))
          )}
        </div>
      )}

      {result && (
        <div className="max-h-[340px] overflow-auto border-t border-border-subtle">
          {result.columns && result.columns.length ? (
            <DataGrid
              current={{ columns: result.columns, rows: result.rows || [], pk: [] }}
              order={null}
              desc={false}
              onSort={null}
              selected={new Map()}
              onToggleRow={() => {}}
              onToggleAll={() => {}}
              emptyText="Query returned no rows"
            />
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 13, color: '#4edea3' }}>
              OK — {result.rowCount ?? ''} {result.command || ''}{result.rowCount == null ? '' : ' row(s) affected'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
