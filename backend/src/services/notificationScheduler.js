import cron from 'node-cron';
import groq from '../config/groq.js';
import supabase from '../config/supabase.js';
import { getAllWorkers } from '../models/workerModel.js';
import { getUpcomingEvents } from '../models/eventModel.js';
import { getRecentNotices } from '../models/noticeModel.js';
import { getRecentAchievements } from '../models/achievementModel.js';
import { getAllFcmTokens } from '../models/notificationModel.js';
import { getPendingScheduledNotifications, markNotificationSent } from '../models/notificationAdminModel.js';
import { getSetting } from '../models/settingsModel.js';
import { sendPushToMultiple } from './fcmService.js';
import { reverseTransfer } from '../models/froAssignmentModel.js';

let lastNoticeCheck = new Date(0).toISOString();
let lastAchievementCheck = new Date(0).toISOString();

function getDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function generateAiMessage(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a friendly HR assistant. Generate short, warm notification messages under 120 characters. Return ONLY the message text, no quotes, no prefixes.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 80,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Groq AI error:', error.message);
    return null;
  }
}

async function sendBirthdayNotifications(tokens, dateStr, dayOffset) {
  const isToday = dayOffset === 0;
  const isTomorrow = dayOffset === 1;
  if (!isToday && !isTomorrow) return;

  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  for (const ngoId of ngoIds) {
    const workers = await getAllWorkers(ngoId);
    const birthdayWorkers = workers.filter((w) => {
      if (!w.dob) return false;
      const dob = new Date(w.dob);
      const md = `${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
      const targetMD = dateStr.slice(5);
      return md === targetMD;
    });

    for (const worker of birthdayWorkers) {
      const tokenData = tokens.find((t) => t.worker_id === worker.id);
      if (!tokenData) continue;

      let title, body;
      if (isTomorrow) {
        title = '🎂 Birthday Tomorrow!';
        const aiMsg = await generateAiMessage(
          `Write a warm reminder that ${worker.name}'s birthday is tomorrow. Keep it under 100 characters. Make it caring.`
        );
        body = aiMsg || `🎉 ${worker.name}'s birthday is tomorrow! Get ready to celebrate!`;
      } else {
        title = '🎂 Happy Birthday!';
        const aiMsg = await generateAiMessage(
          `Write a warm birthday wish for ${worker.name}. Keep it under 100 characters. Make it joyful.`
        );
        body = aiMsg || `🎉 Happy Birthday ${worker.name}! Wishing you a wonderful day!`;
      }

      await sendPushToMultiple([{
        workerId: worker.id, title, body, type: 'birthday', referenceId: worker.id,
      }]);
    }
  }
}

async function sendEventNotifications(tokens, dateStr, dayOffset) {
  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  for (const ngoId of ngoIds) {
    const events = await getUpcomingEvents(ngoId, dateStr, dateStr);
    for (const event of events) {
      const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
      const notifications = [];
      for (const t of ngoTokens) {
        let title, body;
        if (dayOffset === 1) {
          title = '📅 Event Tomorrow!';
          const aiMsg = await generateAiMessage(
            `Write a reminder that the event "${event.title}" is tomorrow. Keep it under 100 characters. Include the event name.`
          );
          body = aiMsg || `📅 Reminder: "${event.title}" is tomorrow${event.event_time ? ` at ${event.event_time.slice(0, 5)}` : ''}!`;
        } else {
          title = '📅 Event Today!';
          const aiMsg = await generateAiMessage(
            `Write a reminder that the event "${event.title}" is happening today. Keep it under 100 characters. Include the event name.`
          );
          body = aiMsg || `📅 "${event.title}" is today${event.event_time ? ` at ${event.event_time.slice(0, 5)}` : ''}! Don't miss it!`;
        }
        notifications.push({ workerId: t.worker_id, title, body, type: 'event', referenceId: event.id });
      }
      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
    }
  }
}

async function sendNoticeNotifications(tokens) {
  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  for (const ngoId of ngoIds) {
    const notices = await getRecentNotices(ngoId, lastNoticeCheck);
    for (const notice of notices) {
      const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
      const notifications = [];
      for (const t of ngoTokens) {
        const title = '📢 New Notice';
        const aiMsg = await generateAiMessage(
          `Summarize this notice briefly: "${notice.title}: ${notice.content}". Keep it under 100 characters.`
        );
        const body = aiMsg || `📢 ${notice.title}`;
        notifications.push({ workerId: t.worker_id, title, body, type: 'notice', referenceId: notice.id });
      }
      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
    }
  }
  lastNoticeCheck = new Date().toISOString();
}

async function sendAchievementNotifications(tokens) {
  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  for (const ngoId of ngoIds) {
    const achievements = await getRecentAchievements(ngoId, lastAchievementCheck);
    for (const ach of achievements) {
      const workerName = ach.workers?.name || 'A worker';
      const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
      const notifications = [];
      for (const t of ngoTokens) {
        const title = '🏆 Achievement Unlocked!';
        const aiMsg = await generateAiMessage(
          `Celebrate that ${workerName} earned "${ach.title}". Keep it under 100 characters. Make it exciting.`
        );
        const body = aiMsg || `🏆 ${workerName} earned "${ach.title}"!`;
        notifications.push({ workerId: t.worker_id, title, body, type: 'achievement', referenceId: ach.id });
      }
      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
    }
  }
  lastAchievementCheck = new Date().toISOString();
}

async function runNotificationCycle() {
  try {
    const tokens = await getAllFcmTokens();
    if (!tokens || tokens.length === 0) return;

    const today = new Date();
    const todayStr = getDateString(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getDateString(tomorrow);

    await sendBirthdayNotifications(tokens, tomorrowStr, 1);
    await sendBirthdayNotifications(tokens, todayStr, 0);
    await sendEventNotifications(tokens, tomorrowStr, 1);
    await sendEventNotifications(tokens, todayStr, 0);
    await sendNoticeNotifications(tokens);
    await sendAchievementNotifications(tokens);

    console.log(`Notification cycle completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Notification cycle error:', error.message);
  }
}

if (!process.env.VERCEL) {
  cron.schedule('30 10 * * *', () => runNotificationCycle());
  console.log('Scheduled: 10:30 AM notification check');

  cron.schedule('0 13 * * *', () => runNotificationCycle());
  console.log('Scheduled: 1:00 PM notification check');

  cron.schedule('0 18 * * *', () => runNotificationCycle());
  console.log('Scheduled: 6:00 PM notification check');
}

async function sendScheduledNotifications() {
  try {
    const pending = await getPendingScheduledNotifications();
    if (!pending || pending.length === 0) return;
    const tokens = await getAllFcmTokens();
    if (!tokens || tokens.length === 0) return;
    for (const notification of pending) {
      const notifications = tokens.map((t) => ({
        workerId: t.worker_id,
        title: notification.title,
        body: notification.body,
        type: 'admin',
        referenceId: null,
      }));
      await sendPushToMultiple(notifications);
      await markNotificationSent(notification.id);
      console.log(`Scheduled notification "${notification.title}" sent at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('Send scheduled notifications error:', error.message);
  }
}

async function sendPunchInReminders() {
  try {
    const officeStart = await getSetting('office_start_time');
    if (!officeStart) return;
    const [startHour, startMinute] = officeStart.split(':').map(Number);
    const shiftTotalMinutes = startHour * 60 + startMinute;

    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(new Date().getTime() + istOffset);
    const currentTotalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

    const diff = shiftTotalMinutes - currentTotalMinutes;
    let window;
    if (diff >= 20 && diff < 21) window = '20';
    else if (diff >= 10 && diff < 11) window = '10';
    else return;

    const todayDateStr = getDateString(ist);
    const tokens = await getAllFcmTokens();
    if (!tokens || tokens.length === 0) return;

    for (const t of tokens) {
      const title = `⏰ ${window} min to shift!`;

      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('worker_id', t.worker_id)
        .eq('type', 'punch_reminder')
        .eq('title', title)
        .gte('sent_at', `${todayDateStr}T00:00:00+05:30`)
        .lte('sent_at', `${todayDateStr}T23:59:59+05:30`)
        .maybeSingle();

      if (existing) continue;

      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('worker_id', t.worker_id)
        .eq('date', todayDateStr)
        .maybeSingle();

      if (attendance) continue;

      const workerName = t.name || t.workers?.name || 'there';
      const prompt = `Remind ${workerName} that their shift starts in ${window} minutes. Tell them to get ready and punch in on time. Keep it under 100 characters. Warm and motivating.`;
      const aiMsg = await generateAiMessage(prompt);
      const body = aiMsg || `Hey ${workerName}, your shift starts in ${window} minutes! Please punch in on time.`;

      await sendPushToMultiple([{
        workerId: t.worker_id, title, body, type: 'punch_reminder', referenceId: null,
      }]);
    }

    console.log(`Punch-in ${window}min reminders sent at ${ist.toISOString()}`);
  } catch (error) {
    console.error('Punch-in reminder error:', error.message);
  }
}

async function sendPunchOutReminders() {
  try {
    const officeEnd = await getSetting('office_end_time');
    if (!officeEnd) return;
    const [endHour, endMinute] = officeEnd.split(':').map(Number);
    const endTotalMinutes = endHour * 60 + endMinute;

    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(new Date().getTime() + istOffset);
    const currentTotalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

    const diff = endTotalMinutes - currentTotalMinutes;
    const minsAfter = -diff;
    let window;
    if (minsAfter >= 5 && minsAfter < 6) window = '5';
    else if (minsAfter >= 10 && minsAfter < 11) window = '10';
    else return;

    const todayDateStr = getDateString(ist);
    const tokens = await getAllFcmTokens();
    if (!tokens || tokens.length === 0) return;

    for (const t of tokens) {
      const title = `⏰ Shift ended ${window} min ago!`;

      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('worker_id', t.worker_id)
        .eq('type', 'punch_out_reminder')
        .eq('title', title)
        .gte('sent_at', `${todayDateStr}T00:00:00+05:30`)
        .lte('sent_at', `${todayDateStr}T23:59:59+05:30`)
        .maybeSingle();

      if (existing) continue;

      const { data: attendanceRecord } = await supabase
        .from('attendance')
        .select('id, punch_in_time, punch_out_time')
        .eq('worker_id', t.worker_id)
        .eq('date', todayDateStr)
        .maybeSingle();

      if (!attendanceRecord || !attendanceRecord.punch_in_time || attendanceRecord.punch_out_time) continue;

      const workerName = t.name || t.workers?.name || 'there';
      const prompt = `${workerName}'s shift ended ${window} minutes ago and they haven't punched out. Write a brief playful reminder like "oops looks like you forgot to punch out". Keep it under 100 characters. Warm tone.`;
      const aiMsg = await generateAiMessage(prompt);
      const body = aiMsg || `Oops ${workerName}, shift ended ${window} min ago! Please punch out!`;

      await sendPushToMultiple([{
        workerId: t.worker_id, title, body, type: 'punch_out_reminder', referenceId: null,
      }]);
    }

    console.log(`Punch-out ${window}min reminders sent at ${ist.toISOString()}`);
  } catch (error) {
    console.error('Punch-out reminder error:', error.message);
  }
}

if (!process.env.VERCEL) {
  cron.schedule('* * * * *', () => sendScheduledNotifications());
  console.log('Scheduled: every-minute check for admin-scheduled notifications');

  cron.schedule('* * * * *', () => sendPunchInReminders());
  console.log('Scheduled: every-minute check for punch-in reminders');

  cron.schedule('* * * * *', () => sendPunchOutReminders());
  console.log('Scheduled: every-minute check for punch-out reminders');
}

async function autoReturnTransfers() {
  try {
    const { data: expired } = await supabase
      .from('fro_transfers')
      .select('id')
      .eq('returned', false)
      .lte('auto_return_at', new Date().toISOString());

    if (!expired || expired.length === 0) return;

    for (const t of expired) {
      const count = await reverseTransfer(t.id);
      if (count > 0) {
        console.log(`[autoReturnTransfers] Transfer ${t.id}: ${count} leads returned to original FRO`);
      }
    }
  } catch (error) {
    console.error('[autoReturnTransfers] Error:', error.message);
  }
}

async function resetCycledDonors() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    const { data: expired, error } = await supabase
      .from('fro_assignments')
      .select('id, donor_id, fro_worker_id, ngo_id')
      .in('status', ['donation_collected', 'lead_done'])
      .lt('last_contacted_at', cutoff);

    if (error) throw error;
    if (!expired || expired.length === 0) return;

    const ids = expired.map(a => a.id);
    const { error: updErr } = await supabase
      .from('fro_assignments')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .in('id', ids);

    if (updErr) throw updErr;

    console.log(`[resetCycledDonors] Reset ${ids.length} donation_collected donors to pending for follow-up`);
  } catch (error) {
    console.error('[resetCycledDonors] Error:', error.message);
  }
}

if (!process.env.VERCEL) {
  cron.schedule('0 0 * * *', () => resetCycledDonors());
  console.log('Scheduled: midnight check for 30-day donor follow-up cycle');
}

async function autoReportMissedSchedules() {
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: contacts, error } = await supabase
      .from('fro_scheduled_contacts')
      .select('*, fro_assignments!inner(id, donor_id, ngo_id, fro_worker_id)')
      .eq('is_completed', false)
      .eq('reminded', false)
      .lt('scheduled_at', tenMinAgo);

    if (error) throw error;
    if (!contacts || contacts.length === 0) return;

    const workerIds = [...new Set(contacts.map(c => c.fro_assignments?.fro_worker_id).filter(Boolean))];
    const donorIds = [...new Set(contacts.map(c => c.fro_assignments?.donor_id).filter(Boolean))];

    const [donorsRes, workersRes] = await Promise.all([
      donorIds.length > 0 ? supabase.from('donor_profiles').select('id, name').in('id', donorIds) : { data: [] },
      workerIds.length > 0 ? supabase.from('workers').select('id, name').in('id', workerIds) : { data: [] },
    ]);

    const donorMap = {};
    for (const d of donorsRes.data || []) donorMap[d.id] = d.name || 'Unknown';
    const workerMap = {};
    for (const w of workersRes.data || []) workerMap[w.id] = w.name || 'Unknown';

    for (const c of contacts) {
      const a = c.fro_assignments;
      if (!a) continue;
      const donorName = donorMap[a.donor_id] || 'Unknown';
      const froName = workerMap[a.fro_worker_id] || 'Unknown';

      const { error: insErr } = await supabase
        .from('alerts')
        .insert([{
          ngo_id: a.ngo_id,
          type: 'missed_schedule',
          title: 'Missed Schedule',
          description: `${froName} missed a scheduled call to ${donorName} (scheduled at ${new Date(c.scheduled_at).toLocaleString('en-IN')}).`,
          fro_name: froName,
          donor_name: donorName,
          reference_id: c.id,
        }]);

      if (insErr) {
        console.error('[autoReportMissedSchedules] insert alert error:', insErr.message);
        continue;
      }

      await supabase
        .from('fro_scheduled_contacts')
        .update({ reminded: true })
        .eq('id', c.id);
    }

    if (contacts.length > 0) {
      console.log(`[autoReportMissedSchedules] Reported ${contacts.length} missed schedules`);
    }
  } catch (error) {
    console.error('[autoReportMissedSchedules] Error:', error.message);
  }
}

if (!process.env.VERCEL) {
  cron.schedule('* * * * *', () => autoReportMissedSchedules());
  console.log('Scheduled: every-minute check for missed schedules (10 min overdue)');

  cron.schedule('* * * * *', () => autoReturnTransfers());
  console.log('Scheduled: every-minute check for expired lead transfers');
}

export { runNotificationCycle, sendScheduledNotifications, sendPunchInReminders, sendPunchOutReminders };
