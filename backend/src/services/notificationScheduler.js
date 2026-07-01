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
  const todayDateStr = getDateString(new Date());

  for (const ngoId of ngoIds) {
    const workers = await getAllWorkers(ngoId);
    const birthdayWorkers = workers.filter((w) => {
      if (!w.dob) return false;
      const dob = new Date(w.dob);
      const md = `${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
      const targetMD = dateStr.slice(5);
      return md === targetMD;
    });
    if (birthdayWorkers.length === 0) continue;

    const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
    if (ngoTokens.length === 0) continue;

    const { data: existingLogs } = await supabase
      .from('notification_log')
      .select('worker_id, reference_id')
      .eq('type', 'birthday')
      .gte('sent_at', `${todayDateStr}T00:00:00+05:30`)
      .lte('sent_at', `${todayDateStr}T23:59:59+05:30`);

    const dedupSet = new Set((existingLogs || []).map((l) => `${l.worker_id}:${l.reference_id}`));

    for (const bdayWorker of birthdayWorkers) {
      const notifications = [];

      for (const t of ngoTokens) {
        const key = `${t.worker_id}:${bdayWorker.id}`;
        if (dedupSet.has(key)) continue;
        dedupSet.add(key);

        if (isTomorrow && t.worker_id === bdayWorker.id) {
          const title = '🎂 Birthday Tomorrow!';
          const aiMsg = await generateAiMessage(
            `Write a warm reminder that your birthday is tomorrow. Keep it under 100 characters. Make it caring.`
          );
          const body = aiMsg || `🎉 Your birthday is tomorrow! Get ready to celebrate!`;
          notifications.push({ workerId: t.worker_id, title, body, type: 'birthday', referenceId: bdayWorker.id });
        } else if (isToday) {
          if (t.worker_id === bdayWorker.id) {
            const title = '🎂 Happy Birthday!';
            const aiMsg = await generateAiMessage(
              `Write a warm birthday wish for ${bdayWorker.name}. Keep it under 100 characters. Make it joyful.`
            );
            const body = aiMsg || `🎉 Happy Birthday ${bdayWorker.name}! Wishing you a wonderful day!`;
            notifications.push({ workerId: t.worker_id, title, body, type: 'birthday', referenceId: bdayWorker.id });
          } else {
            const title = '🎂 Birthday Today!';
            const aiMsg = await generateAiMessage(
              `Tell everyone that ${bdayWorker.name}'s birthday is today and ask them to send wishes. Keep it under 100 characters.`
            );
            const body = aiMsg || `🎉 It's ${bdayWorker.name}'s birthday today! Send them your wishes!`;
            notifications.push({ workerId: t.worker_id, title, body, type: 'birthday', referenceId: bdayWorker.id });
          }
        }
      }

      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
    }
  }
}

async function sendNewJoinerNotifications(tokens) {
  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  const todayDateStr = getDateString(new Date());

  for (const ngoId of ngoIds) {
    const workers = await getAllWorkers(ngoId);
    const newJoiners = workers.filter((w) => {
      if (!w.created_at) return false;
      const joinedDate = new Date(w.created_at);
      return getDateString(joinedDate) === todayDateStr;
    });
    if (newJoiners.length === 0) continue;

    const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
    if (ngoTokens.length === 0) continue;

    const { data: existingLogs } = await supabase
      .from('notification_log')
      .select('worker_id, reference_id')
      .eq('type', 'new_joiner')
      .gte('sent_at', `${todayDateStr}T00:00:00+05:30`)
      .lte('sent_at', `${todayDateStr}T23:59:59+05:30`);

    const dedupSet = new Set((existingLogs || []).map((l) => `${l.worker_id}:${l.reference_id}`));

    for (const joiner of newJoiners) {
      const notifications = [];

      for (const t of ngoTokens) {
        const key = `${t.worker_id}:${joiner.id}`;
        if (dedupSet.has(key)) continue;
        dedupSet.add(key);

        if (t.worker_id === joiner.id) {
          const title = '👋 Welcome!';
          const aiMsg = await generateAiMessage(
            `Write a warm welcome message for ${joiner.name} who just joined the organization today. Keep it under 100 characters. Make it exciting and personal.`
          );
          const body = aiMsg || `👋 Welcome to the team, ${joiner.name}! We're thrilled to have you!`;
          notifications.push({ workerId: t.worker_id, title, body, type: 'new_joiner', referenceId: joiner.id });
        } else {
          const title = '👋 New Team Member!';
          const aiMsg = await generateAiMessage(
            `Tell everyone that ${joiner.name} has joined the organization today and ask them to give a warm welcome. Keep it under 100 characters.`
          );
          const body = aiMsg || `👋 Please welcome ${joiner.name} who joins us today!`;
          notifications.push({ workerId: t.worker_id, title, body, type: 'new_joiner', referenceId: joiner.id });
        }
      }

      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
    }
  }
}

async function sendAnniversaryNotifications(tokens) {
  const ngoIds = [...new Set(tokens.map((t) => t.workers?.ngo_id).filter(Boolean))];
  const today = new Date();
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentYear = today.getFullYear();
  const todayDateStr = getDateString(today);

  const { data: todayLog } = await supabase
    .from('notification_log')
    .select('id')
    .eq('type', 'anniversary')
    .gte('sent_at', `${todayDateStr}T00:00:00+05:30`)
    .lte('sent_at', `${todayDateStr}T23:59:59+05:30`)
    .limit(1)
    .maybeSingle();
  if (todayLog) return;

  for (const ngoId of ngoIds) {
    const workers = await getAllWorkers(ngoId);
    const celebrants = workers.filter((w) => {
      if (!w.created_at) return false;
      const joined = new Date(w.created_at);
      const joinMD = `${String(joined.getMonth() + 1).padStart(2, '0')}-${String(joined.getDate()).padStart(2, '0')}`;
      if (joinMD !== todayMD) return false;
      const years = currentYear - joined.getFullYear();
      return years >= 1;
    });
    if (celebrants.length === 0) continue;

    const ngoTokens = tokens.filter((t) => t.workers?.ngo_id === ngoId);
    if (ngoTokens.length === 0) continue;

    const yearStart = `${currentYear}-01-01T00:00:00+05:30`;
    const yearEnd = `${currentYear}-12-31T23:59:59+05:30`;
    const { data: existingLogs } = await supabase
      .from('notification_log')
      .select('worker_id, reference_id')
      .eq('type', 'anniversary')
      .gte('sent_at', yearStart)
      .lte('sent_at', yearEnd);

    const dedupSet = new Set((existingLogs || []).map((l) => `${l.worker_id}:${l.reference_id}`));

    for (const celebrant of celebrants) {
      const joined = new Date(celebrant.created_at);
      const years = currentYear - joined.getFullYear();
      const notifications = [];

      for (const t of ngoTokens) {
        const key = `${t.worker_id}:${celebrant.id}`;
        if (dedupSet.has(key)) continue;
        dedupSet.add(key);

        if (t.worker_id === celebrant.id) {
          const title = '🎉 Work Anniversary!';
          const aiMsg = await generateAiMessage(
            `Write a warm congratulatory message for completing ${years} year${years > 1 ? 's' : ''} at the organization. Keep it under 100 characters. Make it personal and proud.`
          );
          const body = aiMsg || `🎉 Happy ${years} year work anniversary to you! We're so grateful for you!`;
          notifications.push({ workerId: t.worker_id, title, body, type: 'anniversary', referenceId: celebrant.id });
        } else {
          const title = '🎉 Work Anniversary!';
          const aiMsg = await generateAiMessage(
            `Tell everyone that ${celebrant.name} completes ${years} year${years > 1 ? 's' : ''} with the organization today and ask them to congratulate. Keep it under 100 characters.`
          );
          const body = aiMsg || `🎉 ${celebrant.name} completes ${years} year${years > 1 ? 's' : ''} with us today! Congratulate them!`;
          notifications.push({ workerId: t.worker_id, title, body, type: 'anniversary', referenceId: celebrant.id });
        }
      }

      if (notifications.length > 0) {
        await sendPushToMultiple(notifications);
      }
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
    await sendNewJoinerNotifications(tokens);
    await sendAnniversaryNotifications(tokens);
    await sendEventNotifications(tokens, tomorrowStr, 1);
    await sendEventNotifications(tokens, todayStr, 0);
    await sendNoticeNotifications(tokens);
    await sendAchievementNotifications(tokens);

    console.log(`Notification cycle completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Notification cycle error:', error.message);
  }
}

cron.schedule('30 10 * * *', () => runNotificationCycle());
console.log('Scheduled: 10:30 AM notification check');

cron.schedule('0 13 * * *', () => runNotificationCycle());
console.log('Scheduled: 1:00 PM notification check');

cron.schedule('0 18 * * *', () => runNotificationCycle());
console.log('Scheduled: 6:00 PM notification check');

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
    if (diff >= 15 && diff <= 25) window = '20';
    else if (diff >= 5 && diff <= 12) window = '10';
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
    if (minsAfter >= 3 && minsAfter <= 7) window = '5';
    else if (minsAfter >= 8 && minsAfter <= 13) window = '10';
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

cron.schedule('* * * * *', () => sendScheduledNotifications());
console.log('Scheduled: every-minute check for admin-scheduled notifications');

cron.schedule('* * * * *', () => sendPunchInReminders());
console.log('Scheduled: every-minute check for punch-in reminders');

cron.schedule('* * * * *', () => sendPunchOutReminders());
console.log('Scheduled: every-minute check for punch-out reminders');

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

cron.schedule('* * * * *', () => autoReportMissedSchedules());
console.log('Scheduled: every-minute check for missed schedules (10 min overdue)');

cron.schedule('* * * * *', () => autoReturnTransfers());
console.log('Scheduled: every-minute check for expired lead transfers');

export { runNotificationCycle, sendScheduledNotifications, sendPunchInReminders, sendPunchOutReminders };
