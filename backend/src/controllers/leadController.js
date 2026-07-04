import {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  transferLead,
  getLeadsDashboard,
} from '../models/leadModel.js';

export const addLead = async (req, res) => {
  try {
    const { name, phone, age, source, status, notes, recruiter_id, created_by_name, dob, scheduled_date } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Lead name is required' });
    }
    const data = {
      name,
      phone: phone || null,
      age: age || null,
      source: source || 'Walk-in',
      status: status || 'hold',
      notes: notes || null,
      recruiter_id: recruiter_id || null,
      created_by: req.user.id,
      created_by_name: created_by_name || req.user.name || null,
      dob: dob || null,
      scheduled_date: scheduled_date || null,
    };
    if (status === 'scheduled') {
      data.scheduled_by = req.user.id;
      data.scheduled_at = new Date().toISOString();
      data.scheduled_by_name = req.user.name || null;
    }
    const lead = await createLead(data);
    return res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listLeads = async (req, res) => {
  try {
    const { recruiter_id, status, search, source } = req.query;
    const filters = { recruiter_id, status, search, source };
    const isTelecaller = req.user.role === 'telecaller' || (req.user.role === 'worker' && (req.user.department || '').toLowerCase().trim() === 'fro');
    if (isTelecaller) filters.created_by = req.user.id;
    if (req.user.role === 'recruiter' && req.query.created_by) filters.created_by = req.query.created_by;
    const leads = await getAllLeads(filters);
    return res.json(leads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLead = async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    return res.json(lead);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const editLead = async (req, res) => {
  try {
    const existing = await getLeadById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Lead not found' });

    const isTelecaller = req.user.role === 'telecaller' || (req.user.role === 'worker' && (req.user.department || '').toLowerCase().trim() === 'fro');
    if ((req.user.role === 'recruiter' || isTelecaller) && existing.created_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own leads' });
    }

    const { name, phone, age, source, status, notes, recruiter_id, dob, scheduled_date } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (source) updates.source = source;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (recruiter_id !== undefined) updates.recruiter_id = recruiter_id;
    if (dob !== undefined) updates.dob = dob;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
    if (status === 'scheduled' && existing.status !== 'scheduled') {
      updates.scheduled_by = req.user.id;
      updates.scheduled_at = new Date().toISOString();
      updates.scheduled_by_name = req.user.name || null;
    }
    const lead = await updateLead(req.params.id, updates);
    return res.json({ message: 'Lead updated successfully', lead });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeLead = async (req, res) => {
  try {
    const result = await deleteLead(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const transferLeadOwner = async (req, res) => {
  try {
    const existing = await getLeadById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Lead not found' });

    if (existing.created_by !== req.user.id) {
      return res.status(403).json({ message: 'You can only transfer leads you own' });
    }

    const { new_owner_id, new_owner_name } = req.body;
    if (!new_owner_id) return res.status(400).json({ message: 'new_owner_id is required' });

    const lead = await transferLead(req.params.id, new_owner_id, new_owner_name || null);
    return res.json({ message: 'Lead transferred successfully', lead });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const dashboard = async (req, res) => {
  try {
    const stats = await getLeadsDashboard();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
