import supabase from '../config/supabase.js';
import { createReceipt, findReceiptByLogId, getLastReceiptNo, listAllReceipts } from '../models/receiptModel.js';
import { sendPushNotification } from '../services/fcmService.js';
import { getEntryByPaymentId, verifyEntry } from '../models/bankAuditModel.js';

export const getLeadList = async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('fro_donor_logs')
      .select(`
        id, action, disposition_category, disposition_detail, amount_collected,
        payment_screenshot_url, accounts_status, pan_number, notes, remark, created_at, verified_at,
        upi_transaction_id, transaction_datetime, payment_from, payment_mode,
        assignment_id,
        fro_assignments!inner(
          id,
          donor_id,
          fro_worker_id,
          status,
          donor_profiles!inner(id, name, mobile_number, city, pan_number, address_1, email, project_supported, donation_count, total_amount, birth_date),
          workers!inner(id, name, login_id)
        )
      `)
      .eq('action', 'disposition')
      .eq('disposition_detail', 'lead_done')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('accounts_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    const result = (data || []).map(r => ({
      log_id: r.id,
      amount: r.amount_collected,
      screenshot_url: r.payment_screenshot_url,
      accounts_status: r.accounts_status,
      pan_number: r.pan_number,
      notes: r.notes,
      remark: r.remark,
      rejection_reason: r.rejection_reason,
      created_at: r.created_at,
      assignment_id: r.assignment_id,
      assignment_status: r.fro_assignments?.status || 'lead_done',
      donor_id: r.fro_assignments?.donor_id,
      donor_name: r.fro_assignments?.donor_profiles?.name || 'Unknown',
      donor_mobile: r.fro_assignments?.donor_profiles?.mobile_number || '',
      donor_city: r.fro_assignments?.donor_profiles?.city || '',
      donor_pan: r.fro_assignments?.donor_profiles?.pan_number || '',
      donor_address: r.fro_assignments?.donor_profiles?.address_1 || '',
      donor_email: r.fro_assignments?.donor_profiles?.email || '',
      donor_project: r.fro_assignments?.donor_profiles?.project_supported || '',
      donor_dob: r.fro_assignments?.donor_profiles?.birth_date || '',
      donation_count: r.fro_assignments?.donor_profiles?.donation_count || 0,
      total_donated: r.fro_assignments?.donor_profiles?.total_amount || 0,
      upi_transaction_id: r.upi_transaction_id || null,
      transaction_datetime: r.transaction_datetime || null,
      payment_from: r.payment_from || null,
      payment_mode: r.payment_mode || null,
      verified_at: r.verified_at || null,
      agent_id: r.fro_assignments?.fro_worker_id,
      agent_name: r.fro_assignments?.workers?.name || 'Unknown',
      agent_login: r.fro_assignments?.workers?.login_id || '',
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const verifyLead = async (req, res) => {
  try {
    const { logId } = req.params;
    const {
      pan_number, notes,
      donor_name, donor_mobile, donor_city, donor_email, donor_pan, donor_address,
      upi_transaction_id, transaction_datetime, payment_from, payment_mode,
    } = req.body;

    const { data: log, error: logError } = await supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(id, fro_worker_id, donor_id, status, donor_profiles!inner(id, name, mobile_number, city, address_1, email, pan_number, project_supported))')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    if (log.accounts_status !== 'pending') {
      return res.status(400).json({ message: `This lead has already been ${log.accounts_status || 'processed'}` });
    }

    const assignmentId = log.fro_assignments?.id;
    const donorProfile = log.fro_assignments?.donor_profiles;
    if (!assignmentId || !donorProfile) {
      return res.status(400).json({ message: 'Associated assignment/donor not found' });
    }

    const logUpdate = {
      accounts_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: req.user.id,
      pan_number: pan_number || log.pan_number || null,
      notes: notes || log.notes || null,
    };
    if (upi_transaction_id !== undefined) logUpdate.upi_transaction_id = upi_transaction_id || null;
    if (transaction_datetime !== undefined) logUpdate.transaction_datetime = transaction_datetime || null;
    if (payment_from !== undefined) logUpdate.payment_from = payment_from || null;

    const { error: updateLogError } = await supabase
      .from('fro_donor_logs')
      .update(logUpdate)
      .eq('id', logId);

    if (updateLogError) throw updateLogError;

    const { error: updateAsgnError } = await supabase
      .from('fro_assignments')
      .update({
        status: 'donation_collected',
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateAsgnError) throw updateAsgnError;

    const donorId = log.fro_assignments?.donor_id;
    if (donorId) {
      const donorUpdate = { updated_at: new Date().toISOString() };
      if (donor_name !== undefined) donorUpdate.name = donor_name || null;
      if (donor_mobile !== undefined) donorUpdate.mobile_number = donor_mobile || null;
      if (donor_city !== undefined) donorUpdate.city = donor_city || null;
      if (donor_email !== undefined) donorUpdate.email = donor_email || null;
      if (donor_pan !== undefined || pan_number) donorUpdate.pan_number = pan_number || donor_pan || null;
      if (donor_address !== undefined) donorUpdate.address_1 = donor_address || null;
      try {
        const { data: donor } = await supabase
          .from('donor_profiles')
          .select('total_amount, donation_count')
          .eq('id', donorId)
          .single();
        donorUpdate.total_amount = (donor?.total_amount || 0) + (log.amount_collected || 0);
        donorUpdate.donation_count = (donor?.donation_count || 0) + 1;
        await supabase.from('donor_profiles').update(donorUpdate).eq('id', donorId);
      } catch (err) { console.error('Failed to update donor totals:', err); }
    }

    const existing = await findReceiptByLogId(logId);
    let receipt = existing || null;
    if (!existing) {
      const project = donorProfile?.project_supported || 'bsct';
      const donorName = donorProfile?.name || 'Unknown';
      const lastNo = await getLastReceiptNo(project);
      const receiptNo = generateReceiptNo(project, lastNo);

      receipt = await createReceipt({
        log_id: parseInt(logId),
        receipt_no: receiptNo,
        project_id: project,
        donor_name: donorName,
        donor_mobile: donorProfile?.mobile_number || null,
        amount: log.amount_collected || 0,
        pan_number: pan_number || log.pan_number || donorProfile?.pan_number || null,
        address: donor_address || donorProfile?.address_1 || null,
        mode: payment_mode || null,
        purpose: 'General Donation',
        generated_by: req.user.id,
      });
    }

    // Notify FRO that their lead was verified
    const froWorkerId = log.fro_assignments?.fro_worker_id;
    const donorName = log.fro_assignments?.donor_profiles?.name || 'Unknown';
    if (froWorkerId) {
      try {
        const notifBody = `Your lead for ${donorName} (₹${log.amount_collected || 0}) has been verified. Receipt: ${receipt?.receipt_no || ''}`;
        await supabase.from('notification_log').insert({
          worker_id: froWorkerId,
          type: 'lead_verified',
          title: 'Lead Verified',
          body: notifBody,
          fro_donor_log_id: String(logId),
          sent_at: new Date().toISOString(),
        });
      } catch (err) { console.error('Failed to create verified notification:', err.message); }
    }

    // Auto-verify matching bank audit entry if UPI transaction ID matches
    if (upi_transaction_id) {
      try {
        const bankEntry = await getEntryByPaymentId(upi_transaction_id);
        if (bankEntry) {
          await verifyEntry(bankEntry.id);
        }
      } catch (err) { console.error('Failed to auto-verify bank audit entry:', err.message); }
    }

    return res.json({ message: 'Lead verified, receipt generated', receipt });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Suspense ─────────────────────────────────────────────

export const getSuspenseList = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('suspense_donations')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createSuspense = async (req, res) => {
  try {
    const { donor_name, amount, transaction_date, notes } = req.body;
    if (!donor_name || !amount) {
      return res.status(400).json({ message: 'Donor name and amount are required' });
    }

    const { data, error } = await supabase
      .from('suspense_donations')
      .insert({ donor_name, amount, transaction_date, notes })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const addSuspenseNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ message: 'Notes are required' });

    const { data: existing } = await supabase
      .from('suspense_donations')
      .select('notes')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ message: 'Suspense entry not found' });

    const updatedNotes = existing.notes
      ? existing.notes + '\n---\n' + new Date().toLocaleString() + ': ' + notes
      : new Date().toLocaleString() + ': ' + notes;

    const { data, error } = await supabase
      .from('suspense_donations')
      .update({ notes: updatedNotes })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const assignSuspense = async (req, res) => {
  try {
    const { id } = req.params;
    const { fro_worker_id } = req.body;
    if (!fro_worker_id) return res.status(400).json({ message: 'FRO worker ID is required' });

    const { data, error } = await supabase
      .from('suspense_donations')
      .update({ assigned_to_fro_id: fro_worker_id, assigned_at: new Date().toISOString(), status: 'resolved' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const rejectLead = async (req, res) => {
  try {
    const { logId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const { data: log, error: logError } = await supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(id, fro_worker_id, donor_id, status, ngo_id, station, donor_profiles!inner(id, name, mobile_number))')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    if (log.accounts_status !== 'pending') {
      return res.status(400).json({ message: `This lead has already been ${log.accounts_status || 'processed'}` });
    }

    const assignmentId = log.fro_assignments?.id;
    if (!assignmentId) {
      return res.status(400).json({ message: 'Associated assignment not found' });
    }

    const { error: updateLogError } = await supabase
      .from('fro_donor_logs')
      .update({
        accounts_status: 'rejected',
        rejection_reason: reason,
        verified_by: req.user.id,
        verified_at: new Date().toISOString(),
        notes: reason,
      })
      .eq('id', logId);

    if (updateLogError) throw updateLogError;

    const { error: updateAsgnError } = await supabase
      .from('fro_assignments')
      .update({
        status: 'payment_rejected',
        last_contacted_at: new Date().toISOString(),
        notes: reason,
      })
      .eq('id', assignmentId);

    if (updateAsgnError) throw updateAsgnError;

    if (log.fro_assignments?.donor_id) {
      await supabase.from('donor_profiles').update({ updated_at: new Date().toISOString() }).eq('id', log.fro_assignments.donor_id);
    }

    const froWorkerId = log.fro_assignments?.fro_worker_id;
    const assignmentNgoId = log.fro_assignments?.ngo_id;
    const assignmentStation = log.fro_assignments?.station;
    const donorName = log.fro_assignments?.donor_profiles?.name || 'Unknown';
    let froNotified = false;
    let ticketCreated = false;

    const notifTitle = 'Lead Rejected by Accounts';
    const notifBody = `Your lead for ${donorName} (₹${log.amount_collected || 0}) was rejected. Reason: ${reason}`;
    const refId = /^\d+$/.test(String(logId)) ? parseInt(logId) : null;

    if (froWorkerId) {
      let fcmLogged = false;
      try {
        const pushResult = await sendPushNotification(froWorkerId, notifTitle, notifBody, 'lead_rejected', refId);
        fcmLogged = !!pushResult;
      } catch (err) { console.error('FCM send error:', err.message); }

      if (!fcmLogged) {
        try {
          await supabase.from('notification_log').insert({
            worker_id: froWorkerId,
            type: 'lead_rejected',
            title: notifTitle,
            body: notifBody,
            fro_donor_log_id: String(logId),
            sent_at: new Date().toISOString(),
          });
        } catch (err) { console.error('Failed to create notification_log entry:', err.message); }
      }
      froNotified = true;
    }

    // Determine ngo_id (integer): worker_ngo_allocations > assignment's ngo_id > station's ngo_id
    let ngoId = null;
    if (froWorkerId) {
      try {
        const { data: alloc } = await supabase
          .from('worker_ngo_allocations')
          .select('ngo_id')
          .eq('worker_id', froWorkerId)
          .not('ngo_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (alloc?.ngo_id) ngoId = alloc.ngo_id;
      } catch (err) { console.error('Failed to fetch worker ngo allocation:', err.message); }
    }
    if (!ngoId && assignmentNgoId && typeof assignmentNgoId === 'number') {
      ngoId = assignmentNgoId;
    }
    if (!ngoId && assignmentStation) {
      try {
        const { data: stationAssign } = await supabase
          .from('fro_station_assignments')
          .select('ngo_id')
          .eq('station', assignmentStation)
          .not('ngo_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (stationAssign?.ngo_id) ngoId = stationAssign.ngo_id;
      } catch (err) { console.error('Failed to fetch station ngo:', err.message); }
    }

    try {
      await supabase.from('rejected_lead_tickets').insert({
        fro_donor_log_id: logId,
        fro_worker_id: froWorkerId,
        ngo_id: ngoId,
        donor_name: donorName,
        amount: log.amount_collected || 0,
        rejection_reason: reason,
        status: 'pending_review',
      });
      ticketCreated = true;
    } catch (err) { console.error('Failed to create rejected lead ticket:', err.message); }

    if (ngoId) {
      try {
        await supabase.from('alerts').insert({
          ngo_id: ngoId,
          type: 'lead_rejected',
          title: 'Lead Rejected',
          description: `${donorName} (₹${log.amount_collected || 0}) lead rejected. Reason: ${reason}`,
          donor_name: donorName,
        });
      } catch (err) { console.error('Failed to create alert:', err.message); }
    }

    return res.json({ message: 'Lead rejected', froWorkerId, froNotified, ticketCreated });  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Inline Field Update ───────────────────────────────────

const ALLOWED_FIELDS = ['upi_transaction_id', 'transaction_datetime', 'payment_from', 'pan_number', 'notes', 'remark',
  'donor_name', 'donor_mobile', 'donor_city', 'donor_email', 'donor_pan', 'donor_address'];

const DONOR_FIELD_MAP = {
  donor_name: 'name',
  donor_mobile: 'mobile_number',
  donor_city: 'city',
  donor_email: 'email',
  donor_pan: 'pan_number',
  donor_address: 'address_1',
};

export const patchLeadField = async (req, res) => {
  try {
    const { logId } = req.params;
    const { field, value } = req.body;

    if (!field || !ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ message: `Invalid field. Allowed: ${ALLOWED_FIELDS.join(', ')}` });
    }

    const isDonorField = field in DONOR_FIELD_MAP;

    if (isDonorField) {
      const { data: log, error: logError } = await supabase
        .from('fro_donor_logs')
        .select('id, fro_assignments!inner(donor_id)')
        .eq('id', logId)
        .single();

      if (logError || !log) {
        return res.status(404).json({ message: 'Log entry not found' });
      }

      const donorId = log.fro_assignments?.donor_id;
      if (!donorId) {
        return res.status(400).json({ message: 'Donor not associated with this lead' });
      }

      const donorColumn = DONOR_FIELD_MAP[field];
      const { error: updateError } = await supabase
        .from('donor_profiles')
        .update({ [donorColumn]: value === '' ? null : value, updated_at: new Date().toISOString() })
        .eq('id', donorId);

      if (updateError) throw updateError;

      return res.json({ message: 'Field updated', field, value: value === '' ? null : value });
    }

    const { data: log, error: logError } = await supabase
      .from('fro_donor_logs')
      .select('id, accounts_status')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    const updateData = {};
    updateData[field] = value === '' ? null : value;

    const { error: updateError } = await supabase
      .from('fro_donor_logs')
      .update(updateData)
      .eq('id', logId);

    if (updateError) throw updateError;

    return res.json({ message: 'Field updated', field, value: updateData[field] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Receipts ──────────────────────────────────────────────

function generateReceiptNo(projectId, lastNo) {
  const prefix = projectId.toUpperCase().slice(0, 4);
  let num = 1;
  if (lastNo) {
    const match = lastNo.match(/(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }
  return `${prefix}/${String(num).padStart(5, '0')}/${new Date().getFullYear()}`;
}

export const generateReceipt = async (req, res) => {
  try {
    const { logId } = req.params;
    const { pan_number, address, mode, purpose } = req.body;

    const existing = await findReceiptByLogId(logId);
    if (existing) {
      return res.json({ receipt: existing, message: 'Receipt already exists' });
    }

    const { data: log, error: logError } = await supabase
      .from('fro_donor_logs')
      .select(`
        id, amount_collected, pan_number, notes,
        fro_assignments!inner(
          donor_id,
          fro_worker_id,
          donor_profiles!inner(id, name, mobile_number, city, address_1, email, pan_number, project_supported),
          workers!inner(id, name, login_id)
        )
      `)
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    const donorProfile = log.fro_assignments?.donor_profiles;
    const project = donorProfile?.project_supported || 'bsct';
    const donorName = donorProfile?.name || 'Unknown';

    const lastNo = await getLastReceiptNo(project);
    const receiptNo = generateReceiptNo(project, lastNo);

    const receipt = await createReceipt({
      log_id: logId,
      receipt_no: receiptNo,
      project_id: project,
      donor_name: donorName,
      donor_mobile: donorProfile?.mobile_number || null,
      amount: log.amount_collected || 0,
      pan_number: pan_number || log.pan_number || donorProfile?.pan_number || null,
      address: address || donorProfile?.address_1 || null,
      mode: mode || null,
      purpose: purpose || 'General Donation',
      generated_by: req.user.id,
    });

    return res.status(201).json({ receipt, message: 'Receipt generated' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getReceipt = async (req, res) => {
  try {
    const { logId } = req.params;
    const receipt = await findReceiptByLogId(logId);
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    return res.json(receipt);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getReceiptList = async (req, res) => {
  try {
    const receipts = await listAllReceipts(200);
    return res.json(receipts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorHistory = async (req, res) => {
  try {
    const { donorId } = req.params;

    const { data: logs, error } = await supabase
      .from('fro_donor_logs')
      .select(`
        id, action, disposition_detail, amount_collected, accounts_status,
        payment_mode, upi_transaction_id, transaction_datetime, payment_from,
        created_at, verified_at, payment_screenshot_url,
        fro_assignments!inner(donor_id, fro_worker_id, workers!inner(id, name, login_id))
      `)
      .eq('fro_assignments.donor_id', donorId)
      .or('action.eq.donation,and(disposition_detail.eq.lead_done,accounts_status.eq.verified)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const logIds = (logs || []).map(l => l.id);
    const { data: receipts, error: rError } = logIds.length > 0
      ? await supabase.from('receipts').select('*').in('log_id', logIds)
      : { data: [], error: null };

    const receiptMap = {};
    if (!rError && receipts) {
      for (const r of receipts) receiptMap[r.log_id] = r;
    }

    const result = (logs || []).map(l => ({
      log_id: l.id,
      amount: l.amount_collected,
      payment_mode: l.payment_mode,
      upi_transaction_id: l.upi_transaction_id,
      transaction_datetime: l.transaction_datetime,
      payment_from: l.payment_from,
      accounts_status: l.accounts_status,
      created_at: l.created_at,
      verified_at: l.verified_at,
      screenshot_url: l.payment_screenshot_url,
      agent_name: l.fro_assignments?.workers?.name || 'Unknown',
      agent_login: l.fro_assignments?.workers?.login_id || '',
      type: l.action === 'donation' ? 'Donation' : 'Lead',
      receipt_no: receiptMap[l.id]?.receipt_no || null,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDayEndReport = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    const { data: froLogs, error: fErr } = await supabase
      .from('fro_donor_logs')
      .select(`
        amount_collected, accounts_status, verified_at, created_at,
        fro_assignments!inner(fro_worker_id, workers!inner(id, name, login_id))
      `)
      .gte('created_at', reportDate + 'T00:00:00Z')
      .lte('created_at', reportDate + 'T23:59:59Z');
    if (fErr) throw fErr;

    const froMap = {};
    let totalCollected = 0;
    let totalSubmitted = 0;
    for (const log of froLogs || []) {
      const wid = log.fro_assignments?.fro_worker_id;
      const wName = log.fro_assignments?.workers?.name || 'Unknown';
      const wLogin = log.fro_assignments?.workers?.login_id || '';
      const amount = Number(log.amount_collected || 0);
      totalSubmitted += amount;
      if (log.accounts_status === 'verified') totalCollected += amount;
      if (!froMap[wid]) froMap[wid] = { id: wid, name: wName, login: wLogin, submitted: 0, collected: 0 };
      froMap[wid].submitted += amount;
      if (log.accounts_status === 'verified') froMap[wid].collected += amount;
    }

    const { data: suspenseEntries, error: sErr } = await supabase
      .from('bank_audit_entries')
      .select('id, amount, payment_id, bank_audit_sources(name)')
      .eq('status', 'unverified');
    if (sErr) throw sErr;

    const suspenseAmount = (suspenseEntries || []).reduce((s, e) => s + Number(e.amount || 0), 0);

    return res.json({
      date: reportDate,
      froWorkers: Object.values(froMap),
      totalSubmitted,
      totalCollected,
      suspenseCount: (suspenseEntries || []).length,
      suspenseAmount,
      suspenseEntries: suspenseEntries || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
