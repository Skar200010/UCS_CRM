import * as EventHead from '../models/eventHeadModel.js';

// ─── EVENTS ───
export const createEventHandler = async (req, res) => {
  try {
    const event = await EventHead.createEventHeadEvent({ ...req.body, created_by: req.user.id });
    return res.status(201).json(event);
  } catch (error) {
    console.error('createEventHandler error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listEventHeadEvents = async (req, res) => {
  try {
    const events = await EventHead.getAllEventHeadEvents();
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.getEventHeadEventById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, req.body);
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteEventHeadEvent = async (req, res) => {
  try {
    const result = await EventHead.deleteEventHeadEvent(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateEventHeadStatus = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: req.body.status });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadDashboard = async (req, res) => {
  try {
    const dash = await EventHead.getEventHeadDashboard();
    return res.json(dash);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByMonth = async (req, res) => {
  try {
    const events = await EventHead.getEventHeadEventsByMonth(req.params.month, req.params.year);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByNgo = async (req, res) => {
  try {
    const events = await EventHead.getEventHeadEventsByNgo(req.params.ngoId);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByState = async (req, res) => {
  try {
    const events = await EventHead.getEventHeadEventsByState(req.params.state);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const submitEventHeadApproval = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Submitted', approval_status: 'Submitted' });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const approveEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Approved', approval_status: 'Approved' });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const rejectEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Rejected', approval_status: 'Rejected' });
    return res.json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── ASSETS ───
export const createAsset = async (req, res) => {
  try {
    const asset = await EventHead.createAsset(req.body);
    return res.status(201).json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listAssets = async (req, res) => {
  try {
    const assets = await EventHead.getAllAssets();
    return res.json(assets);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAsset = async (req, res) => {
  try {
    const asset = await EventHead.getAssetById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editAsset = async (req, res) => {
  try {
    const asset = await EventHead.updateAsset(req.params.id, req.body);
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeAsset = async (req, res) => {
  try {
    const result = await EventHead.deleteAsset(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const issueAssetItem = async (req, res) => {
  try {
    const asset = await EventHead.issueAsset(req.params.id, req.body.quantity);
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const returnAssetItem = async (req, res) => {
  try {
    const asset = await EventHead.returnAsset(req.params.id);
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAssetUtilization = async (req, res) => {
  try {
    const data = await EventHead.getAllAssets();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── MATERIALS ───
export const createMaterial = async (req, res) => {
  try {
    const material = await EventHead.createMaterial(req.body);
    return res.status(201).json(material);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listMaterials = async (req, res) => {
  try {
    const materials = await EventHead.getAllMaterials();
    return res.json(materials);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editMaterial = async (req, res) => {
  try {
    const material = await EventHead.updateMaterial(req.params.id, req.body);
    return res.json(material);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeMaterial = async (req, res) => {
  try {
    const result = await EventHead.deleteMaterial(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getMaterialStock = async (req, res) => {
  try {
    const stock = await EventHead.getMaterialStock();
    return res.json(stock);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const adjustMaterialStock = async (req, res) => {
  try {
    const material = await EventHead.adjustMaterialStock(req.params.id, req.body.adjustment);
    return res.json(material);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── DISTRIBUTIONS ───
export const createDistribution = async (req, res) => {
  try {
    const dist = await EventHead.createDistribution(req.params.eventId, req.body);
    return res.status(201).json(dist);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listDistributions = async (req, res) => {
  try {
    const dists = await EventHead.getDistributionsByEvent(req.params.eventId);
    return res.json(dists);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── BENEFICIARIES ───
export const listBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await EventHead.getAllDistributions();
    return res.json(beneficiaries);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const createBeneficiary = async (req, res) => {
  try {
    return res.json({ message: 'Beneficiary created' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── VOLUNTEERS ───
export const createVolunteer = async (req, res) => {
  try {
    const volunteer = await EventHead.createVolunteer(req.body);
    return res.status(201).json(volunteer);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listVolunteers = async (req, res) => {
  try {
    const volunteers = await EventHead.getAllVolunteers();
    return res.json(volunteers);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editVolunteer = async (req, res) => {
  try {
    const volunteer = await EventHead.updateVolunteer(req.params.id, req.body);
    return res.json(volunteer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── EXPENSES ───
export const createExpense = async (req, res) => {
  try {
    const expense = await EventHead.createExpense(req.params.eventId, req.body);
    return res.status(201).json(expense);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listExpenses = async (req, res) => {
  try {
    const expenses = await EventHead.getExpensesByEvent(req.params.eventId);
    return res.json(expenses);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeExpense = async (req, res) => {
  try {
    const result = await EventHead.deleteExpense(req.params.eventId, req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── VEHICLES ───
export const createVehicle = async (req, res) => {
  try {
    const vehicle = await EventHead.createVehicle(req.body);
    return res.status(201).json(vehicle);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listVehicles = async (req, res) => {
  try {
    const vehicles = await EventHead.getAllVehicles();
    return res.json(vehicles);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const assignVehicle = async (req, res) => {
  try {
    const vehicle = await EventHead.assignVehicle(req.body);
    return res.status(201).json(vehicle);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── MEDIA ───
export const uploadMedia = async (req, res) => {
  try {
    const media = await EventHead.createMedia(req.params.eventId, { name: req.file?.originalname || req.body.name, url: req.body.url || `/uploads/${req.file?.filename}`, type: req.file?.mimetype || req.body.type });
    return res.status(201).json(media);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listMedia = async (req, res) => {
  try {
    const media = await EventHead.getMediaByEvent(req.params.eventId);
    return res.json(media);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeMedia = async (req, res) => {
  try {
    const result = await EventHead.deleteMedia(req.params.eventId, req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── ATTENDANCE ───
export const createAttendance = async (req, res) => {
  try {
    const att = await EventHead.createAttendance(req.params.eventId, req.body);
    return res.status(201).json(att);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listAttendance = async (req, res) => {
  try {
    const attendance = await EventHead.getAttendanceByEvent(req.params.eventId);
    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── CHECKLIST ───
export const getChecklist = async (req, res) => {
  try {
    const items = await EventHead.getChecklistByEvent(req.params.eventId);
    return res.json(items);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateChecklistItem = async (req, res) => {
  try {
    const item = await EventHead.upsertChecklistItem(req.params.eventId, { id: req.params.itemId, ...req.body });
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── PARTNERS ───
export const listPartners = async (req, res) => {
  try {
    const partners = await EventHead.getAllPartners();
    return res.json(partners);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── DONORS ───
export const listDonors = async (req, res) => {
  try {
    const donors = await EventHead.getAllDonors();
    return res.json(donors);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── REPORTS ───
export const generateEventReport = async (req, res) => {
  try {
    const event = await EventHead.getEventHeadEventById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const expenses = await EventHead.getExpensesByEvent(req.params.eventId);
    const attendance = await EventHead.getAttendanceByEvent(req.params.eventId);
    const media = await EventHead.getMediaByEvent(req.params.eventId);
    const checklist = await EventHead.getChecklistByEvent(req.params.eventId);
    const distributions = await EventHead.getDistributionsByEvent(req.params.eventId);
    const report = { event, expenses, attendance, media, checklist, distributions, generated_at: new Date() };
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── APPROVALS LIST ───
export const listApprovals = async (req, res) => {
  try {
    const events = await EventHead.getAllEventHeadEvents();
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
