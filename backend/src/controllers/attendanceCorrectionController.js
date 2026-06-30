import {
  createTicket,
  getTicketById,
  getWorkerTickets,
  getPendingTickets,
  getHrVerifiedTickets,
  getAllTickets,
  updateTicket,
  getPendingTicketCount,
} from '../models/attendanceCorrectionModel.js';
import { getAttendanceById, updateAttendance } from '../models/attendanceModel.js';

export const raiseTicket = async (req, res) => {
  try {
    const { attendance_id, date, field, requested_time, reason } = req.body;
    if (!attendance_id || !date || !field || !requested_time || !reason) {
      return res.status(400).json({ message: 'attendance_id, date, field, requested_time, and reason are required' });
    }
    if (!['punch_in', 'punch_out'].includes(field)) {
      return res.status(400).json({ message: 'field must be "punch_in" or "punch_out"' });
    }
    const existing = await getAttendanceById(attendance_id);
    if (!existing) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    if (existing.worker_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only raise tickets for your own attendance' });
    }
    const openTickets = await getWorkerTickets(req.user.id);
    const hasPending = openTickets.some(t => t.attendance_id === attendance_id && t.field === field && t.status === 'pending');
    if (hasPending) {
      return res.status(400).json({ message: 'You already have a pending ticket for this attendance record and field' });
    }
    const ticket = await createTicket({
      worker_id: req.user.id,
      attendance_id,
      date,
      field,
      requested_time,
      reason,
      status: 'pending',
    });
    return res.status(201).json({ message: 'Ticket raised successfully', ticket });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const myTickets = async (req, res) => {
  try {
    const tickets = await getWorkerTickets(req.user.id);
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listPending = async (req, res) => {
  try {
    const tickets = await getPendingTickets();
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listHrVerified = async (req, res) => {
  try {
    const tickets = await getHrVerifiedTickets();
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listAllTickets = async (req, res) => {
  try {
    const tickets = await getAllTickets();
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTicket = async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const verifyTicket = async (req, res) => {
  try {
    const { hr_remark } = req.body;
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status !== 'pending') return res.status(400).json({ message: `Ticket is already ${ticket.status}` });
    const updated = await updateTicket(req.params.id, { status: 'hr_verified', hr_remark: hr_remark || null });
    return res.json({ message: 'Ticket verified by HR', ticket: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const approveTicket = async (req, res) => {
  try {
    const { admin_remark } = req.body;
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status !== 'hr_verified') return res.status(400).json({ message: 'Ticket must be HR-verified before approval' });

    const attendance = await getAttendanceById(ticket.attendance_id);
    if (!attendance) return res.status(404).json({ message: 'Associated attendance record not found' });

    const updates = {};
    if (ticket.field === 'punch_in') {
      updates.punch_in_time = ticket.requested_time;
      if (attendance.punch_out_time) {
        const pi = new Date(ticket.requested_time).getTime();
        const po = new Date(attendance.punch_out_time).getTime();
        const diffMs = po - pi;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        updates.hours_worked = `${hours}h ${minutes}m`;
      }
    } else {
      updates.punch_out_time = ticket.requested_time;
      if (attendance.punch_in_time) {
        const pi = new Date(attendance.punch_in_time).getTime();
        const po = new Date(ticket.requested_time).getTime();
        const diffMs = po - pi;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        updates.hours_worked = `${hours}h ${minutes}m`;
      }
    }

    await updateAttendance(ticket.attendance_id, updates);
    const updated = await updateTicket(req.params.id, { status: 'approved', admin_remark: admin_remark || null });
    return res.json({ message: 'Ticket approved and attendance updated', ticket: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const rejectTicket = async (req, res) => {
  try {
    const { remark } = req.body;
    const ticket = await getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status === 'approved' || ticket.status === 'rejected') {
      return res.status(400).json({ message: `Ticket is already ${ticket.status}` });
    }
    const updates = { status: 'rejected' };
    const role = req.user.role;
    if (role === 'super_admin') updates.admin_remark = remark || null;
    else updates.hr_remark = remark || null;
    const updated = await updateTicket(req.params.id, updates);
    return res.json({ message: 'Ticket rejected', ticket: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const pendingCount = async (req, res) => {
  try {
    const count = await getPendingTicketCount();
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
