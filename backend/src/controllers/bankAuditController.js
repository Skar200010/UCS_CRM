import * as BankAudit from '../models/bankAuditModel.js';
import supabase from '../config/supabase.js';

export const listSources = async (req, res) => {
  try {
    const sources = await BankAudit.getSources();
    return res.json(sources);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const addSource = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Source name is required' });
    const source = await BankAudit.createSource(name);
    return res.status(201).json(source);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Source already exists' });
    return res.status(500).json({ message: error.message });
  }
};

export const editSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active, sort_order } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    const source = await BankAudit.updateSource(id, updates);
    return res.json(source);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeSource = async (req, res) => {
  try {
    const { id } = req.params;
    await BankAudit.deleteSource(id);
    return res.json({ message: 'Source deleted' });
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ message: 'Cannot delete source with existing entries' });
    return res.status(500).json({ message: error.message });
  }
};

export const listEntries = async (req, res) => {
  try {
    const { date_from, date_to, source_id, status } = req.query;
    const entries = await BankAudit.getEntries({ date_from, date_to, source_id, status });
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const addEntry = async (req, res) => {
  try {
    const { source_id, amount, payment_id, check_id, transaction_date, remarks } = req.body;
    if (!source_id || !amount || !transaction_date) {
      return res.status(400).json({ message: 'Source, amount, and transaction date are required' });
    }
    const entry = await BankAudit.createEntry({
      source_id,
      amount,
      payment_id: payment_id || null,
      check_id: check_id || null,
      transaction_date,
      remarks: remarks || null,
      created_by: req.user.id,
    });
    return res.status(201).json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const editEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { source_id, amount, payment_id, check_id, transaction_date, remarks } = req.body;
    const updates = {};
    if (source_id !== undefined) updates.source_id = source_id;
    if (amount !== undefined) updates.amount = amount;
    if (payment_id !== undefined) updates.payment_id = payment_id;
    if (check_id !== undefined) updates.check_id = check_id;
    if (transaction_date !== undefined) updates.transaction_date = transaction_date;
    if (remarks !== undefined) updates.remarks = remarks;
    const entry = await BankAudit.updateEntry(id, updates);
    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await BankAudit.deleteEntry(id);
    return res.json({ message: 'Entry deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSummary = async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;
    const summary = await BankAudit.getSourceSummary({ date_from, date_to, status });
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const suggestEntries = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const entries = await BankAudit.suggestEntries(q);
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markEntryVerified = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await BankAudit.verifyEntry(id);
    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const assignEntryToNgo = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const entry = await BankAudit.assignToNgoAdmin(id, notes);
    // Notify NGO admins - try both admin and hoadmin roles (transition period)
    const { data: ngoAdmins } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'hoadmin']);
    for (const u of (ngoAdmins || [])) {
      try {
        await supabase.from('notification_log').insert({
          worker_id: u.id,
          type: 'suspense_assigned',
          title: 'Suspense Entry',
          body: `A suspense entry of ${entry.bank_audit_sources?.name || 'Unknown'} for \u20B9${entry.amount} has been sent for inquiry. Payment ID: ${entry.payment_id || 'N/A'}`,
          sent_at: new Date().toISOString(),
        });
      } catch {}
    }
    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listNgoSuspense = async (req, res) => {
  try {
    const entries = await BankAudit.getSuspenseForNgo();
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const linkSuspenseToDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const { donor_id } = req.body;
    if (!donor_id) return res.status(400).json({ message: 'Donor ID is required' });

    const { data: entry } = await supabase
      .from('bank_audit_entries')
      .select('amount, payment_id')
      .eq('id', id)
      .single();
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    const result = await BankAudit.linkSuspenseToDonor(id, donor_id);

    const { data: assignment } = await supabase
      .from('fro_assignments')
      .select('id, fro_worker_id')
      .eq('donor_id', donor_id)
      .not('status', 'eq', 'reassigned')
      .maybeSingle();

    if (assignment?.fro_worker_id) {
      await supabase.from('fro_donor_logs').insert({
        assignment_id: assignment.id,
        donor_id: donor_id,
        fro_worker_id: assignment.fro_worker_id,
        action: 'donation',
        amount_collected: entry.amount,
        accounts_status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: req.user.id,
        created_by: req.user.id,
        notes: `Auto-credited via suspense linking (Payment: ${entry.payment_id || 'N/A'})`,
      });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markSuspenseUnmatched = async (req, res) => {
  try {
    const { id } = req.params;
    const userName = req.user?.name || req.user?.login_id || 'Unknown';
    const entry = await BankAudit.markSuspenseUnmatched(id, userName);
    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const searchDonorsForSuspense = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const ngoIds = []; // will be scoped by user's NGO access if needed
    const donors = await BankAudit.searchDonorsForSuspense(q, ngoIds);
    return res.json(donors);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listFroSuspense = async (req, res) => {
  try {
    const entries = await BankAudit.getSuspenseForFro(req.user.id);
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resolveSuspenseEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { screenshot_url, donor_details, donor_name, donor_mobile, amount, disposition_category, disposition_detail } = req.body;
    const entry = await BankAudit.resolveSuspense(id, screenshot_url, donor_details);

    // Also create a fro_donor_log entry for this resolved suspense
    if (donor_name) {
      try {
        // Create or find donor profile
        const { data: existingDonor } = await supabase
          .from('donor_profiles')
          .select('id')
          .eq('name', donor_name)
          .maybeSingle();
        let donorId = existingDonor?.id;
        if (!donorId) {
          const { data: newDonor } = await supabase
            .from('donor_profiles')
            .insert({ name: donor_name, mobile_number: donor_mobile || null })
            .select()
            .single();
          donorId = newDonor?.id;
        }

        if (donorId) {
          // Create fro_assignment
          const { data: assignment } = await supabase
            .from('fro_assignments')
            .insert({
              donor_id: donorId,
              fro_worker_id: req.user.id,
              status: disposition_detail === 'lead_done' ? 'lead_done' : 'callback',
            })
            .select()
            .single();

          if (assignment) {
            await supabase.from('fro_donor_logs').insert({
              assignment_id: assignment.id,
              action: disposition_detail === 'lead_done' ? 'donation' : disposition_category || 'follow_up',
              disposition_category: disposition_category || 'other',
              disposition_detail: disposition_detail || 'resolved_suspense',
              amount_collected: amount || entry.amount || 0,
              accounts_status: disposition_detail === 'lead_done' ? 'pending' : 'pending',
            });
          }
        }
      } catch (err) { console.error('Failed to create lead from suspense:', err.message); }
    }

    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const searchFroDispositions = async (req, res) => {
  try {
    const { q } = req.query;
    const entries = await BankAudit.searchFroDispositions(req.user.id, q || '');
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
