import cron from 'node-cron';
import { db } from '../config/db.js';

// ---------------------------------------------------------------------------
// DB health watchdog.
//
// Runs every 5 minutes and looks for:
//   1. Long-running / stuck queries (older than DB_HEALTH_SLOW_MS, default 60s).
//   2. seq-scan drift on hot tables (receipts, fro_assignments, fro_donor_logs,
//      bank_audit_entries) — the "missing index" canary that caused the CPU
//      incident (agent_name ILIKE '%..%' seq scanning 100k+ rows).
//
// Findings are logged with console.warn/error. If DB_HEALTH_WEBHOOK is set,
// the report is POSTed there (JSON) so ops can be alerted without log scraping.
// The webhook body includes `level` so you can point it at a Slack/Discord
// style integration and route by severity.
// ---------------------------------------------------------------------------

const SLOW_MS = Number(process.env.DB_HEALTH_SLOW_MS || 60000);
const WEBHOOK = process.env.DB_HEALTH_WEBHOOK || '';

const HOT_TABLES = ['receipts', 'fro_assignments', 'fro_donor_logs', 'bank_audit_entries'];

export async function runDbHealthCheck() {
  const findings = [];

  const longRunning = await db.query(`
    SELECT pid, usename, state, wait_event_type, wait_event,
           round(extract(epoch FROM (now() - query_start)))::int AS age_s,
           left(query, 300) AS query
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND state = 'active'
      AND query_start < now() - make_interval(secs => $1)
    ORDER BY query_start
  `, [SLOW_MS / 1000]);
  for (const r of longRunning.rows) {
    findings.push({
      level: 'warn',
      kind: 'slow-query',
      detail: `pid=${r.pid} ${r.usename} state=${r.state} age=${r.age_s}s wait=${r.wait_event_type}/${r.wait_event}`,
      query: r.query,
    });
  }

  const seqDrift = await db.query(`
    SELECT s.relname,
           s.seq_scan,
           s.seq_tup_read,
           s.idx_scan,
           round(get_current_timestamp() - s.last_analyze) AS ...
    FROM pg_stat_user_tables s
    WHERE s.relname = ANY($1)
    ORDER BY s.seq_tup_read DESC
  `, [HOT_TABLES]);
  for (const r of seqDrift.rows) {
    // High seq_scan count with a working index is the missing-index/tup-read signal.
    if (r.seq_scan > 1000 && r.seq_tup_read > 100000 && (r.idx_scan === 0 && r.seq_scan > 0)) {
      findings.push({
        level: 'warn',
        kind: 'seq-scan-drift',
        detail: `${r.relname}: ${r.seq_scan} seq scans, ${r.seq_tup_read} rows read, ${r.idx_scan} idx scans`,
      });
    }
  }

  if (findings.length === 0) {
    console.log('[db-health] all good');
    return { ok: true, findings: [] };
  }

  for (const f of findings) {
    const label = `[db-health] ${f.level.toUpperCase()} ${f.kind}: ${f.detail}`;
    if (f.level === 'error') console.error(label);
    else console.warn(label);
    if (f.query) console.warn(`   ${f.query}`);
  }

  if (WEBHOOK) {
    const body = JSON.stringify({ ts: new Date().toISOString(), level: findings.some((f) => f.level === 'error') ? 'error' : 'warn', findings });
    try {
      const res = await fetch(WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      console.log(`[db-health] webhook sent: ${res.status}`);
    } catch (e) {
      console.error('[db-health] webhook failed:', e.message);
    }
  }

  return { ok: findings.length === 0, findings };
}

export function startDbHealthWatchdog() {
  cron.schedule('*/5 * * * *', () => {
    runDbHealthCheck().catch((e) => console.error('[db-health] check error:', e.message));
  });
  console.log('Scheduled: DB health check every 5 minutes');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runDbHealthCheck();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}