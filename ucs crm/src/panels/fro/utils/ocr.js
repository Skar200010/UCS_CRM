const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
const ID_LABELS = [
  /^upi[ -]*(?:transaction)?[ -]*(?:id|ref(?:erence)?|no\.?)?\s*:?\s*$/i,
  /^google[ -]*(?:pay[ -]*)?transaction[ -]*id\s*:?\s*$/i,
  /^transaction[ -]*(?:id|ref(?:erence)?|no\.?)\s*:?\s*$/i,
  /^(?:ref|ref\.?|ref no|ref id|utr|utr no)\s*:?\s*$/i,
  /^upi[ -]*\d/i,
  /^(?:payment\s+)?id\s*:?\s*$/i,
  /^order[ -]*(?:id|no\.?)\s*:?\s*$/i,
];

const OCR_API = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/ocr/parse'
  : '/api/ocr/parse';

function normalizeDateStr(day, monthText, year) {
  const m = MONTHS[monthText.slice(0, 3).toLowerCase()];
  if (!m) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseTimeFromLine(line) {
  const m = line.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2];
  const sec = m[3] || '00';
  const ampm = (m[4] || '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}:${sec}`;
}

function extractTransactionDataFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let upiTransactionId = null;
  let transactionDatetime = null;
  let amount = null;
  let fromName = null;

  for (let i = 0; i < lines.length; i++) {
    if (ID_LABELS.some(p => p.test(lines[i]))) {
      if (i + 1 < lines.length) {
        const val = lines[i + 1].replace(/[^A-Z0-9a-z\-]/g, '');
        if (/^[A-Z0-9a-z\-]{4,30}$/.test(val)) { upiTransactionId = val; break; }
      }
    }
  }
  if (!upiTransactionId) {
    for (const line of lines) {
      const c = line.replace(/[^0-9]/g, '');
      if (c.length >= 10 && c.length <= 16) { upiTransactionId = c; break; }
    }
  }

  for (const line of lines) {
    const m1 = line.match(/[₹£]\s*([\d,.]+)/);
    if (m1) { const v = m1[1].replace(/,/g, ''); if (v.length <= 8) { amount = v; break; } }
    const m2 = line.match(/Rs\.?\s*([\d,.]+)/i);
    if (m2) { const v = m2[1].replace(/,/g, ''); if (v.length <= 8) { amount = v; break; } }
    const m3 = line.match(/amount\s*:?\s*[₹£Rs.]*\s*([\d,.]+)/i);
    if (m3) { const v = m3[1].replace(/,/g, ''); if (v.length <= 8) { amount = v; break; } }
  }
  if (!amount) {
    for (const line of lines) {
      const nums = line.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
      if (nums) { amount = nums[1].replace(/,/g, ''); break; }
    }
  }

  const fromLabels = [/^from\s*:?\s*$/i, /^paid\s+by\s*:?\s*$/i, /^sender\s*:?\s*$/i];
  for (let i = 0; i < lines.length; i++) {
    if (fromLabels.some(p => p.test(lines[i])) && i + 1 < lines.length) {
      const val = lines[i + 1].replace(/[^A-Za-z\s.]/g, '').trim();
      if (val && val.length > 1) { fromName = val; break; }
    }
    const inline = lines[i].match(/^(?:from|paid by|sender)\s*:?\s*(.+)/i);
    if (inline) {
      const val = inline[1].replace(/[^A-Za-z\s.]/g, '').trim();
      if (val && val.length > 1) { fromName = val; break; }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i].match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})/i);
    if (!dm) continue;
    const ds = normalizeDateStr(dm[1], dm[2], dm[3]);
    if (!ds) continue;
    const ts = parseTimeFromLine(lines[i]) || parseTimeFromLine(lines[i + 1] || '');
    transactionDatetime = ts ? `${ds}T${ts}` : `${ds}T00:00:00`;
    break;
  }

  return { upiTransactionId, transactionDatetime, amount, fromName };
}

async function callBackendOcr(base64Image) {
  try {
    const res = await fetch(OCR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.text || null;
  } catch {
    return null;
  }
}

export async function extractTransactionData(base64Image) {
  const backendText = await callBackendOcr(base64Image);
  if (backendText) {
    const result = extractTransactionDataFromText(backendText);
    if (result.upiTransactionId || result.amount || result.transactionDatetime || result.fromName) {
      return result;
    }
  }

  return { upiTransactionId: null, transactionDatetime: null, amount: null, fromName: null };
}
