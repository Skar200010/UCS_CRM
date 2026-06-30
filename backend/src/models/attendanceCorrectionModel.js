import supabase from '../config/supabase.js';

export const createTicket = async (data) => {
  const { data: ticket, error } = await supabase
    .from('attendance_corrections')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return ticket;
};

export const getTicketById = async (id) => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*, workers(name, login_id, email)')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getWorkerTickets = async (worker_id) => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*')
    .eq('worker_id', worker_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getPendingTickets = async () => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*, workers(name, login_id, email, department)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getHrVerifiedTickets = async () => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*, workers(name, login_id, email, department)')
    .eq('status', 'hr_verified')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getAllTickets = async () => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .select('*, workers(name, login_id, email, department)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const updateTicket = async (id, updates) => {
  const { data, error } = await supabase
    .from('attendance_corrections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getPendingTicketCount = async () => {
  const { count, error } = await supabase
    .from('attendance_corrections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count;
};
