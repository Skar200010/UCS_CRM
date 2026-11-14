// ---------------------------------------------------------------------------
// SS (social / WhatsApp reply) lead placement
//
// A reply lands in the `leads` inbox. The admin assigns it to a FRO. That is
// the moment this service turns the inbox row into a REAL lead:
//   donor_profiles  (name + last-10 mobile)
//   fro_assignments (station SS-<NGO>, batch_type new_data, pending)
//
// Rules that mirror the rest of the CRM:
//   * one active assignment per (donor_id, ngo_id) — never duplicate the row
//   * if the donor already has a live lead, append the reply to its notes
//     instead of creating a second assignment
//   * an existing live lead on ANOTHER station is never moved; only the note is
//     added, so a worker's portfolio cannot be stolen by assigning a reply
//   * the SS station is created on demand (data-only: no FRO owner)
// ---------------------------------------------------------------------------
import db from '../config/db.js';
import crypto from 'crypto';

export const SS_STATIONS = { BSCT: 'SS-BSCT', AFLF: 'SS-AFLF', MANN: 'SS-MANN' };

// Explicit "yes, I am interested" signals only. This is the auto-placement gate:
// a reply that does not clear this stays in the admin inbox for a human to
// decide. Business auto-replies are rejected before the keyword check because
// they routinely contain words like "donate" and "details".
const BUTTON_INTEREST = /interested|want\s*to\s*donate|donate\s*now|send\s*details|more\s*information|volunteer|^yes/i;
const BUTTON_REJECT = /not\s*interested|maybe\s*later|^stop$|unsubscribe|no\s*thanks/i;
const REJECT_TEXT = /(not\s*interested|do\s*not\s*disturb|don'?t\s*disturb|do\s*not\s*call|don'?t\s*call|wrong\s*number|remove\s*my\s*number|unsubscribe|^stop\b|no\s*thanks)/i;
const AUTO_REPLY = /(thank\s*you\s*for\s*contacting|thanks\s*for\s*contacting|thank\s*you\s*for\s*(your\s*)?(message|interest|writing)|welcome\s*to|please\s*let\s*us\s*know\s*how\s*we\s*can\s*help|we\s*(will|'ll)\s*(respond|get\s*back)|please\s*wait|we\s*are\s*unavailable|auto[\s-]?reply|automated|assalamoaleikum|namaste|hello\s*and\s*welcome|jay\s*shri\s*shyam)/i;
const FREE_TEXT_INTEREST = /(w[ao]n(?:t|ted|ts|ting)?\s*to\s*donate|(?:would|will)\s*like\s*to\s*donate|wish(?:es)?\s*to\s*donate|(?:how|where|when)\s*(?:can|do|should|to)\s*i\s*(?:donate|pay|contribute)|how\s*(?:can|do|should)\s*(?:i|we)\s*(?:donate|pay|contribute)|interested\s*in\s*donat|i\s*am\s*interested|donate\s*(?:now|today)|contribute|80\s*g|call\s*me|interested|details\s*(?:chahiye|send)|kit\s*(?:chahiye|send)|put\s*me\s*in)/i;

export function qualifySsReply(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const button = (t.match(/\[(?:Button|Reply):\s*([^\]]+)\]/i) || [])[1] || '';
  if (button) return BUTTON_INTEREST.test(button) && !BUTTON_REJECT.test(button);
  if (BUTTON_REJECT.test(t) || REJECT_TEXT.test(t)) return false;
  if (AUTO_REPLY.test(t)) return false;
  return FREE_TEXT_INTEREST.test(t);
}

// Free text the rule engine cannot classify. Used by the webhook to decide
// whether a background AI check is worth making: empty/media-only replies,
// obvious rejects and business auto-replies are skipped.
export function shouldAiCheckSsReply(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^\[(image|video|audio|document|sticker)\]$/i.test(t)) return false;
  if (BUTTON_REJECT.test(t) || REJECT_TEXT.test(t) || AUTO_REPLY.test(t)) return false;
  if (qualifySsReply(t)) return false;
  return true;
}

// ── Smart suggestion ────────────────────────────────────────────────────────
// Local, zero-cost scoring used by the admin SS inbox. It is deliberately the
// same signal set as qualifySsReply (template buttons + intent words) plus a few
// negative patterns, so the badge never promises more than the router knows.
// Output: { score 0-100, label, reasons[] }.
const SERVICE_TEXT = /(receipt|80\s*g|pan\s*number|wrong\s*name|address\s*change|already\s*donated)/i;

export function scoreSsReply(notes) {
  const text = String(notes || '');
  const button = (text.match(/\[(?:Button|Reply):\s*([^\]]+)\]/i) || [])[1] || '';
  const body = text
    .split('\n')
    .filter((l) => !/^\[(Template|Account|Lead|Button|Reply):/i.test(l.trim()))
    .join('\n')
    .trim();

  const reasons = [];
  let score = 35;

  if (button) {
    const b = button.toLowerCase();
    if (/not\s*interested|maybe\s*later|^stop$|unsubscribe|no\s*thanks/.test(b)) {
      score = 5;
      reasons.push(`Clicked "${button}"`);
    } else if (/donate\s*now|i\s*want\s*to\s*donate/.test(b)) {
      score = 95;
      reasons.push(`Clicked "${button}"`);
    } else if (/interested/.test(b)) {
      score = 90;
      reasons.push(`Clicked "${button}"`);
    } else if (/send\s*details|^yes/.test(b)) {
      score = 85;
      reasons.push(`Clicked "${button}"`);
    } else if (/more\s*information/.test(b)) {
      score = 70;
      reasons.push(`Clicked "${button}"`);
    } else if (/volunteer/.test(b)) {
      score = 60;
      reasons.push(`Clicked "${button}"`);
    } else {
      score = 45;
      reasons.push(`Clicked "${button}"`);
    }
  } else if (!body) {
    score = 15;
    reasons.push('No text in the reply');
  } else if (AUTO_REPLY.test(body)) {
    score = 8;
    reasons.push('Looks like a business auto-reply');
  } else if (BUTTON_REJECT.test(body) || REJECT_TEXT.test(body)) {
    score = 5;
    reasons.push('Says not interested / do not contact');
  } else if (FREE_TEXT_INTEREST.test(body)) {
    score = 80;
    reasons.push('Message shows donation intent');
  } else if (SERVICE_TEXT.test(body)) {
    score = 30;
    reasons.push('Receipt / service request, not a new lead');
  } else {
    score = 25;
    reasons.push('No clear buying signal');
  }

  const label = score >= 70 ? 'interested' : score >= 40 ? 'review' : 'low';
  return { score, label, reasons: reasons.slice(0, 2), button: button || null };
}

const ngoFromAccount = (notes) => {
  const acct = String((notes || '').match(/\[Account:\s*([^\]]+)\]/)?.[1] || '').toLowerCase().trim();
  if (acct.startsWith('bsct')) return 'BSCT';
  if (acct.startsWith('aflf')) return 'AFLF';
  if (acct.startsWith('mann')) return 'MANN';
  return null;
};

const m10 = (v) => String(v || '').replace(/[^0-9]/g, '').slice(-10);

const isPlaceholder = (n) => !n || /^recipient\s*\d+$/i.test(String(n).trim()) || /^\d+$/.test(String(n).trim());

const replyText = (notes) => String(notes || '')
  .split('\n')
  // Keep [Button: ...] / [Reply: ...]: that IS the reply for a template button.
  // Only CRM bookkeeping tags are stripped.
  .filter((l) => !/^\[(Template|Account|Lead|Meta Lead|Platform|Campaign|Form):/i.test(l.trim()))
  .join('\n')
  .trim();

export async function materializeReplyLead(lead, { froId = null, client = null } = {}) {
  const run = client ? client.query.bind(client) : db._pool.query.bind(db._pool);

  if (!lead?.id) throw new Error('lead id is required');
  const ngoName = ngoFromAccount(lead.notes);
  if (!ngoName) return { ok: false, reason: 'Reply has no NGO [Account:] tag' };

  const mobile = m10(lead.phone);
  if (mobile.length !== 10) return { ok: false, reason: 'Reply has no valid 10-digit mobile' };

  const station = SS_STATIONS[ngoName];
  const { rows: ngoRows } = await run('select id from ngos where upper(name) = $1 limit 1', [ngoName]);
  if (!ngoRows[0]) return { ok: false, reason: `NGO ${ngoName} not found` };
  const ngoId = ngoRows[0].id;

  // station must exist for this NGO
  await run(
    `insert into fro_station_assignments (ngo_id, station)
     select $1, $2
      where not exists (select 1 from fro_station_assignments where ngo_id = $1 and station = $2)`,
    [ngoId, station],
  );

  // If no FRO was picked, fall back to the station's owner so an SS station with
  // an owner routes new replies automatically.
  let ownerId = froId || null;
  if (!ownerId) {
    const { rows: owner } = await run(
      `select fro_worker_id from fro_station_assignments where ngo_id = $1 and station = $2 limit 1`,
      [ngoId, station],
    );
    ownerId = owner[0]?.fro_worker_id || null;
  }

  // donor profile
  const { rows: existingProfile } = await run(
    `select id, name from donor_profiles
      where right(regexp_replace(coalesce(mobile_number, ''), '[^0-9]', '', 'g'), 10) = $1
      limit 1`,
    [mobile],
  );

  let donorId = existingProfile[0]?.id || null;
  if (!donorId) {
    let name = lead.name;
    if (isPlaceholder(name)) {
      const { rows: contact } = await run(
        `select wa_profile_name from contacts
          where right(regexp_replace(coalesce(phone_normalized, ''), '[^0-9]', '', 'g'), 10) = $1
            and coalesce(wa_profile_name, '') <> ''
          limit 1`,
        [mobile],
      );
      name = contact[0]?.wa_profile_name || name;
    }
    const { rows: created } = await run(
      `insert into donor_profiles (mobile_number, name, ngo, station, amount, total_amount, donation_count)
       values ($1, $2, $3, $4, 0, 0, 1)
       returning id`,
      [mobile, name || `WhatsApp ${mobile.slice(-4)}`, ngoName, station],
    );
    donorId = created[0].id;
  }

  const marker = `[Lead:${lead.id}]`;
  const reply = replyText(lead.notes);

  // one live row per (donor, ngo)
  const { rows: existingRows } = await run(
    `select id, station, notes
       from fro_assignments
      where donor_id = $1 and ngo_id = $2
        and (status is null or status <> 'reassigned')
      limit 1`,
    [donorId, ngoId],
  );

  if (existingRows[0]) {
    const row = existingRows[0];
    const existingNotes = String(row.notes || '');
    const hasMarker = existingNotes.includes(marker);
    const hasReply = reply ? existingNotes.includes(reply) : false;
    // A NEW reply on an already-placed lead must still be visible: the marker is
    // about placement (do not create a second assignment), not about freezing
    // the thread at the first message. Same reply twice = no duplicate append.
    let noteAdd = null;
    if (!hasMarker) {
      noteAdd = `${existingNotes}${existingNotes ? '\n' : ''}${reply}${reply ? '\n' : ''}${marker}`;
    } else if (reply && !hasReply) {
      noteAdd = `${existingNotes}${existingNotes ? '\n' : ''}${reply}`;
    }
    const onOwnStation = row.station === station;

    if (onOwnStation) {
      await run(
        `update fro_assignments
            set fro_worker_id = coalesce($2, fro_worker_id),
                notes = coalesce($3, notes),
                updated_at = now()
          where id = $1`,
        [row.id, ownerId, noteAdd],
      );
    } else if (noteAdd) {
      // Live lead sits on another station: add context, never move ownership.
      await run(`update fro_assignments set notes = $2, updated_at = now() where id = $1`, [row.id, noteAdd]);
    }
    return {
      ok: true,
      donorId,
      assignmentId: row.id,
      station: row.station,
      ngoId,
      ngoName,
      merged: true,
      movedToFro: onOwnStation && !!ownerId,
      reason: onOwnStation ? null : `Donor already has a live lead on ${row.station}`,
    };
  }

  const { rows: inserted } = await run(
    `insert into fro_assignments
       (donor_id, fro_worker_id, ngo_id, station, status, is_new, batch_type,
        assigned_at, batch_id, notes)
     values ($1, $2, $3, $4, 'pending', true, 'new_data', now(), $5, $6)
     returning id`,
    [donorId, ownerId, ngoId, station, crypto.randomUUID(), [reply, marker].filter(Boolean).join('\n')],
  );

  return {
    ok: true,
    donorId,
    assignmentId: inserted[0].id,
    station,
    ngoId,
    ngoName,
    merged: false,
    movedToFro: !!ownerId,
  };
}
