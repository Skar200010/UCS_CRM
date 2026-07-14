import bcrypt from 'bcryptjs';
import supabase from '../config/supabase.js';
import { getWorkerByLoginId } from '../models/workerModel.js';

export async function whatsappLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let worker = await getWorkerByLoginId(email);
    if (!worker) {
      const { data } = await supabase
        .from('workers')
        .select('*')
        .or(`email.eq.${email},login_id.eq.${email}`)
        .maybeSingle();
      worker = data;
    }
    if (!worker) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!worker.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { data: assignment } = await supabase
      .from('fro_whatsapp_assignments')
      .select('*, whatsapp_accounts!inner(id, name, project, phone_number_id)')
      .eq('fro_worker_id', worker.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!assignment) {
      return res.status(403).json({ message: 'No WhatsApp account assigned to this user. Contact admin to assign one.' });
    }

    return res.json({
      success: true,
      worker: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
      },
      account: assignment.whatsapp_accounts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
