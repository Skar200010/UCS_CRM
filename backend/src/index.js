import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import supabase from './config/supabase.js';
import authRoutes from './routes/authRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import ngoRoutes from './routes/ngoRoutes.js';
import userRoutes from './routes/userRoutes.js';
import hrRoutes from './routes/hrRoutes.js';
import letterRoutes from './routes/letterRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import achievementRoutes from './routes/achievementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import notificationAdminRoutes from './routes/notificationAdminRoutes.js';
import onboardingRoutes from './routes/onboardingRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import recruiterRoutes from './routes/recruiterRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import incentiveRoutes from './routes/incentiveRoutes.js';
import callLogRoutes from './routes/callLogRoutes.js';
import causeRoutes from './routes/causeRoutes.js';
import dataSourceRoutes from './routes/dataSourceRoutes.js';
import dataImportRoutes from './routes/dataImportRoutes.js';
import ngoAdminRoutes from './routes/ngoAdminRoutes.js';
import froRoutes from './routes/froRoutes.js';
import accountsRoutes from './routes/accountsRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import attendanceCorrectionRoutes from './routes/attendanceCorrectionRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const froDist = path.resolve(__dirname, '../../fro-panel/dist');
const ngoAdminDist = path.resolve(__dirname, '../../ngo-admin-panel/dist');
const accountsDist = path.resolve(__dirname, '../../accounts-panel/dist');

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hrs', hrRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/notifications', notificationAdminRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/call-logs', callLogRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/incentive', incentiveRoutes);
app.use('/api/causes', causeRoutes);
app.use('/api/data-sources', dataSourceRoutes);
app.use('/api/data-import', dataImportRoutes);
app.use('/api/ngo-admin', ngoAdminRoutes);
app.use('/api/fro', froRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/advances', loanRoutes);
app.use('/api/attendance-corrections', attendanceCorrectionRoutes);

if (fs.existsSync(froDist)) {
  app.use('/assets', express.static(path.join(froDist, 'assets')));
  app.get(/^\/(?!api\/|admin$|admin\/|accounts$|accounts\/).*$/, (req, res) => {
    res.sendFile(path.join(froDist, 'index.html'));
  });
  app.get('/', (req, res) => {
    res.sendFile(path.join(froDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Attendance API is running' });
  });
}

if (fs.existsSync(ngoAdminDist)) {
  app.use('/admin/assets', express.static(path.join(ngoAdminDist, 'assets')));
  app.get('/admin*', (req, res) => {
    res.sendFile(path.join(ngoAdminDist, 'index.html'));
  });
}

if (fs.existsSync(accountsDist)) {
  app.use('/accounts/assets', express.static(path.join(accountsDist, 'assets')));
  app.get('/accounts*', (req, res) => {
    res.sendFile(path.join(accountsDist, 'index.html'));
  });
}

app.post('/api/cron/notifications', async (req, res) => {
  try {
    const { runNotificationCycle, sendScheduledNotifications, sendPunchInReminders, sendPunchOutReminders } =
      await import('./services/notificationScheduler.js');
    await Promise.all([
      runNotificationCycle().catch(() => {}),
      sendScheduledNotifications().catch(() => {}),
      sendPunchInReminders().catch(() => {}),
      sendPunchOutReminders().catch(() => {}),
    ]);
    res.json({ success: true, message: 'All notification checks completed' });
  } catch (error) {
    console.error('Notifications cron error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

app.get('/api/debug', async (req, res) => {
  const tables = ['rejected_lead_tickets', 'alerts', 'notification_log', 'fcm_tokens'];
  const results = {};
  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).select('id').limit(1);
      results[t] = error ? `error: ${error.message}` : 'ok';
    } catch (e) { results[t] = `exception: ${e.message}`; }
  }
  res.json({ version: 'd6f25bd', node: process.version, tables: results, vercel: !!process.env.VERCEL });
});

async function checkLeavesTable() {
  try {
    await supabase.from('leaves').select('id').limit(1);
  } catch {
    console.warn(
      '\n=== MISSING TABLE: leaves ===\n' +
      'The "leaves" table does not exist in your Supabase database.\n' +
      'Run the SQL in backend/migrations/ in your Supabase SQL Editor.\n' +
      '========================\n'
    );
  }
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    checkLeavesTable();
    import('./services/notificationScheduler.js');
  });
}

export default app;
