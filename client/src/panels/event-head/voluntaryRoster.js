// Shared logic for the Voluntary (volunteer + management) roster.
//
// Both the "Voluntary" page and the picker inside Create/Edit Event need the
// exact same roster and the exact same NGO grouping. Keeping two hand-copied
// versions of this is what let them drift — the page showed a worker with no
// ngo_code under its full NGO name while the picker put the same org under
// "BSCT", so the same organisation appeared as two separate groups.

const NGO_CODE_LABELS = {
  BSCT: 'BSCT',
  AFLF: 'AFLF',
  MANN: 'Mann',
  MAN: 'Mann',
  OTHER: 'Others',
  OTHERS: 'Others',
};

export const DEFAULT_NGO = 'Others';

// Short label for an NGO code or name, matching the Management column headers
// in the HR employees file.
export const shortLabel = (codeOrName) => {
  const c = String(codeOrName || '').toUpperCase().trim();
  return NGO_CODE_LABELS[c] || String(codeOrName || '').trim() || DEFAULT_NGO;
};

export const orderIndex = (label) => {
  const u = String(label || '').toUpperCase();
  const map = { BSCT: 0, AFLF: 1, MANN: 2, MAN: 2, OTHERS: 3, OTHER: 3 };
  return map[u] !== undefined ? map[u] : 100;
};

// Keeps the known NGOs first in a stable order, then anything else alphabetically.
export const sortNgos = (a, b) =>
  orderIndex(a) - orderIndex(b) || String(a).localeCompare(String(b));

// NGO full-name -> short label, so a worker can still be grouped correctly when
// the ngos.code value is not one of the mapped shortcuts above.
const ngoLabelLookup = (ngos) => {
  const m = {};
  for (const n of ngos || []) {
    const key = String(n.name || '').trim().toUpperCase();
    if (key) m[key] = shortLabel(n.code || n.name);
  }
  return m;
};

// NGO group for a worker row coming from the HR panel. Resolved in order:
// ngo_code shortcut -> the NGO's full name matched against the live NGO list ->
// the raw name -> "Others". This is what keeps one organisation in one group.
export const personNgo = (worker, byName) => {
  const code = String(worker.ngo_code || '').toUpperCase().trim();
  if (NGO_CODE_LABELS[code]) return NGO_CODE_LABELS[code];
  const nameKey = String(worker.ngo_name || '').trim().toUpperCase();
  if (nameKey && byName && byName[nameKey]) return byName[nameKey];
  return worker.ngo_name || DEFAULT_NGO;
};

// Management Team columns only. Volunteers are NOT read from the spreadsheet —
// it is a stale snapshot with no employment status, so it would keep offering
// people the HR panel has since absconded.
export const parseManagementTeam = (rows) => {
  const active = {};
  const out = [];
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] || '').trim();
      const mg = txt.match(/^(.*?)\s*Management\s+Team\s*$/i);
      if (mg) {
        active[c] = { ngo: (mg[1] || '').trim() || DEFAULT_NGO };
        continue;
      }
      if (txt && /Volunteer\s+Team\s*$/i.test(txt)) {
        delete active[c];
      }
    }
    for (const c of Object.keys(active)) {
      const ci = Number(c);
      const name = String(row[ci + 1] || '').trim().replace(/\s+/g, ' ');
      const ngoCell = String(row[ci + 2] || '').trim();
      if (!name || /Team\s*$/i.test(name) || /^Sr\.?\s*No\.?\s*$/i.test(name) || name.toUpperCase() === 'NAME') continue;
      out.push({ name, ngo: ngoCell || active[c].ngo });
    }
  }
  const seen = new Set();
  return out.filter((m) => {
    const k = m.name.toLowerCase() + '|' + m.ngo.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ');

// Combine the two sources into the { id?, name, ngo, team } shape the picker and
// the event_head_events.volunteers column both use.
//
// Volunteers come from the live HR panel (absconded people are already absent).
// Management comes from the spreadsheet, since management is not in the workers
// table. A name present in both is kept once, as a Volunteer, so the live HR
// record wins and nobody is listed or counted twice.
export const buildRoster = (people, management, ngoList) => {
  const byName = ngoLabelLookup(ngoList);
  const volunteers = (Array.isArray(people) ? people : [])
    .filter((p) => p && cleanName(p.name))
    // ngo_id is carried through so the picker can scope to a single NGO by
    // identity (exact), not just by the display label.
    .map((p) => ({ id: p.id ?? null, name: cleanName(p.name), ngo: personNgo(p, byName), team: 'Volunteer', ngo_id: p.ngo_id ?? null }));
  const volNames = new Set(volunteers.map((v) => v.name.toLowerCase()));
  const mgmt = (Array.isArray(management) ? management : [])
    .filter((m) => m && cleanName(m.name) && !volNames.has(cleanName(m.name).toLowerCase()))
    .map((m) => ({ id: null, name: cleanName(m.name), ngo: m.ngo || DEFAULT_NGO, team: 'Management', ngo_id: null }));
  const out = [];
  const seen = new Set();
  for (const i of [...volunteers, ...mgmt]) {
    const k = (i.team + '|' + i.ngo + '|' + i.name).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
};
