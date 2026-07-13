import { getUserById } from '../models/userModel.js';
import { getRecruiterWorkers } from '../models/workerModel.js';
import { getAllLeads, getLeadsByRecruiter } from '../models/leadModel.js';
import supabase from '../config/supabase.js';

export const listRecruiters = async (req, res) => {
  try {
    const recruiters = await getRecruiterWorkers();

    const leads = await getAllLeads();
      const withStats = recruiters.map((r) => {
        const recruiterLeads = leads.filter((l) => l.recruiter_id === r.id || l.created_by === r.id);
        const total = recruiterLeads.length;
        const scheduled = recruiterLeads.filter((l) => l.status === 'scheduled').length;
        return { ...r, leadsCount: total, scheduled };
      });

    return res.json(withStats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRecruiterStats = async (req, res) => {
  try {
    const recruiter = await getRecruiterWorkers();
    const thisRecruiter = recruiter.find(r => r.id === req.params.id);
    if (!thisRecruiter) return res.status(404).json({ message: 'Recruiter not found' });

    const leads = await getLeadsByRecruiter(req.params.id);
    const total = leads.length;
    const byStatus = {};
    leads.forEach((l) => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });
    const joined = byStatus['joined'] || 0;
    const rejected = byStatus['rejected'] || 0;
    const conversionRate = joined + rejected > 0 ? ((joined / (joined + rejected)) * 100).toFixed(1) : 0;

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      last7.push({ date: ds, count: leads.filter((l) => l.created_at?.slice(0, 10) === ds).length });
    }

    return res.json({
      recruiter: thisRecruiter,
      stats: { total, byStatus, conversionRate: parseFloat(conversionRate), joined, rejected, last7 },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRecruiterOverview = async (req, res) => {
  try {
    const recruiters = await getRecruiterWorkers();
    const allLeads = await getAllLeads();

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const recruiterStats = recruiters.map((r) => {
      const rLeads = allLeads.filter((l) => l.recruiter_id === r.id || l.created_by === r.id);
      const total = rLeads.length;
      const byStatus = {};
      rLeads.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });

      const scheduled = byStatus['scheduled'] || 0;
      const pending = (byStatus['hold'] || 0) + (byStatus['followed_up'] || 0) + (byStatus['call_back'] || 0) + (byStatus['ringing'] || 0) + (byStatus['unreachable'] || 0) + (byStatus['busy'] || 0) + (byStatus['switched_off'] || 0);
      const interviewed = byStatus['selected'] || 0;
      const joined = byStatus['joined'] || 0;
      const rejected = byStatus['rejected'] || 0;
      const followUp = (byStatus['followed_up'] || 0) + (byStatus['call_back'] || 0);

      const convBase = joined + rejected;
      const conversionRate = convBase > 0 ? parseFloat(((joined / convBase) * 100).toFixed(1)) : 0;

      const todayLeads = rLeads.filter((l) => l.created_at?.slice(0, 10) === today).length;

      const recentActivity = rLeads
        .filter((l) => l.updated_at)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];

      const lastActivity = recentActivity?.updated_at || recentActivity?.created_at || null;

      const avgResponseTime = calculateAvgResponseTime(rLeads);

      return {
        id: r.id,
        name: r.name,
        department: r.department,
        leadsCount: total,
        scheduled,
        pending,
        interviewed,
        joined,
        rejected,
        followUp,
        conversionRate,
        todayLeads,
        lastActivity,
        avgResponseTime,
        byStatus,
      };
    });

    const totalRecruiters = recruiters.length;
    const totalLeads = allLeads.length;
    const totalScheduled = allLeads.filter((l) => l.status === 'scheduled').length;
    const totalPending = allLeads.filter((l) => ['hold', 'followed_up', 'call_back', 'ringing', 'unreachable', 'busy', 'switched_off'].includes(l.status)).length;
    const totalInterviewed = allLeads.filter((l) => l.status === 'selected').length;
    const totalJoined = allLeads.filter((l) => l.status === 'joined').length;
    const totalRejected = allLeads.filter((l) => l.status === 'rejected').length;
    const totalFollowUp = allLeads.filter((l) => ['followed_up', 'call_back'].includes(l.status)).length;
    const overallConvBase = totalJoined + totalRejected;
    const overallConversionRate = overallConvBase > 0 ? parseFloat(((totalJoined / overallConvBase) * 100).toFixed(1)) : 0;

    const statusBreakdown = {};
    allLeads.forEach((l) => {
      const s = l.status || 'unknown';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en', { weekday: 'short' });
      last7Days.push({
        date: ds,
        label: dayLabel,
        count: allLeads.filter((l) => l.created_at?.slice(0, 10) === ds).length,
      });
    }

    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en', { month: 'short' });
      const monthStart = d.toISOString().slice(0, 10);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const monthLeads = allLeads.filter((l) => {
        const cd = l.created_at?.slice(0, 10);
        return cd >= monthStart && cd <= monthEnd;
      });
      monthlyData.push({
        month: monthLabel,
        total: monthLeads.length,
        scheduled: monthLeads.filter((l) => l.status === 'scheduled').length,
        joined: monthLeads.filter((l) => l.status === 'joined').length,
        rejected: monthLeads.filter((l) => l.status === 'rejected').length,
      });
    }

    const todayActivities = allLeads
      .filter((l) => l.updated_at?.slice(0, 10) === today || l.created_at?.slice(0, 10) === today)
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 20)
      .map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        recruiter: l.created_by_name || 'System',
        time: l.updated_at || l.created_at,
      }));

    const activeRecruiters = recruiterStats.filter((r) => r.leadsCount > 0).length;
    const avgLeadsPerRecruiter = totalRecruiters > 0 ? parseFloat((totalLeads / totalRecruiters).toFixed(1)) : 0;

    const totalLeadAge = allLeads.reduce((sum, l) => {
      const created = new Date(l.created_at);
      const diffDays = (now - created) / (1000 * 60 * 60 * 24);
      return sum + diffDays;
    }, 0);
    const avgHiringTime = totalLeads > 0 ? parseFloat((totalLeadAge / totalLeads).toFixed(1)) : 0;

    return {
      summary: {
        totalRecruiters,
        activeRecruiters,
        totalLeads,
        totalScheduled,
        totalPending,
        totalInterviewed,
        totalJoined,
        totalRejected,
        totalFollowUp,
        overallConversionRate,
      },
      recruiterStats,
      statusBreakdown,
      last7Days,
      monthlyData,
      todayActivities,
      analytics: {
        avgLeadsPerRecruiter,
        avgHiringTime,
        avgResponseTime: calculateAvgResponseTime(allLeads),
        avgDailyLeads: last7Days.length > 0 ? parseFloat((totalLeads / 30).toFixed(1)) : 0,
      },
    };
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

function calculateAvgResponseTime(leads) {
  const withUpdates = leads.filter((l) => l.created_at && l.updated_at && l.created_at !== l.updated_at);
  if (withUpdates.length === 0) return 0;
  const totalHours = withUpdates.reduce((sum, l) => {
    const created = new Date(l.created_at);
    const updated = new Date(l.updated_at);
    const diffMs = updated - created;
    return sum + diffMs / (1000 * 60 * 60);
  }, 0);
  return parseFloat((totalHours / withUpdates.length).toFixed(1));
}
