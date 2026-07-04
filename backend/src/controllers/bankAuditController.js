import * as BankAudit from '../models/bankAuditModel.js';

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
