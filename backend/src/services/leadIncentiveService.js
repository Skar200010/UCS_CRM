import db, { sql } from '../config/db.js';
import { getActiveSlabs } from '../models/incentiveSlabModel.js';
import { getSettings } from '../models/incentiveSettingsModel.js';

// Query: all active FRO workers
const ACTIVE_FROS_SQL = `
  SELECT id, name FROM workers
  WHERE is_active = true AND lower(coalesce(department, '')) = 'fro'
  ORDER BY name
`;

// Query: verified lead_done logs for a FRO on a specific date
// Uses verified_at as the counting date (when accounts verified it)
const FRO_LEADS_SQL = `
  SELECT
    id,
    donor_id,
    amount_collected,
    verified_at,
    created_at,
    transaction_datetime
  FROM fro_donor_logs
  WHERE fro_worker_id = $1
    AND action = 'disposition'
    AND disposition_detail = 'lead_done'
    AND accounts_status = 'verified'
    AND verified_at >= $2
    AND verified_at < $3
  ORDER BY verified_at DESC
`;

// Determine which slab a FRO's target falls into
function getSlabForTarget(target, slabs) {
  const t = Number(target) || 0;
  for (const slab of slabs) {
    if (t >= Number(slab.min_amount) && t < Number(slab.max_amount)) {
      return slab;
    }
  }
  // If target exceeds all slabs, use the last (highest) slab
  if (slabs.length > 0 && t >= Number(slabs[slabs.length - 1].min_amount)) {
    return slabs[slabs.length - 1];
  }
  // Fallback: first slab
  return slabs[0] || null;
}

// Get FRO's monthly target (manual fro_monthly_targets takes priority, then incentive_targets)
async function getFroTarget(froId, month) {
  // Try fro_monthly_targets first (manual, NGO-admin set)
  const { data: froData } = await db
    .from('fro_monthly_targets')
    .select('target_amount')
    .eq('fro_worker_id', froId)
    .eq('month', month)
    .maybeSingle();
  if (froData && Number(froData.target_amount) > 0) {
    return Number(froData.target_amount);
  }

  // Fallback to incentive_targets (auto-generated)
  const { data: incData } = await db
    .from('incentive_targets')
    .select('target_amount')
    .eq('worker_id', froId)
    .eq('month', month)
    .maybeSingle();
  if (incData && Number(incData.target_amount) > 0) {
    return Number(incData.target_amount);
  }

  return 0;
}

// Calculate lead incentive for a single FRO on a given date
async function calculateFroLeadIncentive(froId, date, slabs, settings) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  // Get month string for target lookup (YYYY-MM-01)
  const monthDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const monthStr = monthDate.toISOString().slice(0, 10);

  // Fetch FRO's target and determine slab
  const target = await getFroTarget(froId, monthStr);
  const slab = getSlabForTarget(target, slabs);

  // Fetch verified leads for this date
  const { data: leads } = await db
    .from('fro_donor_logs')
    .select('id, donor_id, amount_collected, verified_at')
    .eq('fro_worker_id', froId)
    .eq('action', 'disposition')
    .eq('disposition_detail', 'lead_done')
    .eq('accounts_status', 'verified')
    .gte('verified_at', startDate.toISOString())
    .lte('verified_at', endDate.toISOString())
    .order('verified_at', { ascending: false });

  const allLeads = leads || [];
  const minLead = Number(settings.min_lead_amount) || 300;
  const leadRate = Number(settings.lead_rate) || 20;

  // Filter qualified leads (amount >= min_lead_amount)
  const qualifiedLeads = allLeads.filter(l => Number(l.amount_collected) >= minLead);
  const totalAmount = qualifiedLeads.reduce((sum, l) => sum + (Number(l.amount_collected) || 0), 0);

  const leadIncentive = qualifiedLeads.length * leadRate;
  const slabBonus = slab ? Number(slab.incentive_amount) || 0 : 0;

  return {
    target,
    slab,
    total_leads: allLeads.length,
    qualified_leads: qualifiedLeads.length,
    total_amount: totalAmount,
    lead_incentive: leadIncentive,
    slab_bonus: slabBonus,
    leads: allLeads.map(l => ({
      id: l.id,
      donor_id: l.donor_id,
      amount: Number(l.amount_collected) || 0,
      qualified: Number(l.amount_collected) >= minLead,
      verified_at: l.verified_at,
    })),
  };
}

// Get full daily summary for all FROs
export const getDailySummary = async (date) => {
  const [slabs, settings, frosResult] = await Promise.all([
    getActiveSlabs(),
    getSettings(),
    db.from('workers').select('id, name').eq('is_active', true).ilike('department', 'fro').order('name'),
  ]);

  const fros = frosResult.data || [];
  const results = [];

  for (const fro of fros) {
    const calc = await calculateFroLeadIncentive(fro.id, date, slabs, settings);
    results.push({
      fro_id: fro.id,
      fro_name: fro.name,
      ...calc,
      slab_bonus: calc.slab_bonus,
      champion_bonus: 0,
      total_incentive: calc.lead_incentive + calc.slab_bonus,
    });
  }

  // Determine champion: FRO with highest total_amount from qualified leads
  const sorted = [...results].sort((a, b) => b.total_amount - a.total_amount);
  const champion = sorted[0] && sorted[0].total_amount > 0 ? sorted[0] : null;

  if (champion) {
    champion.champion_bonus = settings.champion_bonus;
    champion.total_incentive += settings.champion_bonus;
  }

  // Sort final results by total_incentive descending
  results.sort((a, b) => b.total_incentive - a.total_incentive);

  return {
    date,
    slabs,
    settings,
    fros: results,
    champion: champion ? {
      fro_id: champion.fro_id,
      fro_name: champion.fro_name,
      total_amount: champion.total_amount,
      bonus: settings.champion_bonus,
    } : null,
  };
};

// Get single FRO detail with individual leads
export const getFroDetail = async (froId, date) => {
  const [slabs, settings, froResult] = await Promise.all([
    getActiveSlabs(),
    getSettings(),
    db.from('workers').select('id, name').eq('id', froId).maybeSingle(),
  ]);

  if (!froResult.data) return null;

  const calc = await calculateFroLeadIncentive(froId, date, slabs, settings);

  // Enrich leads with donor names
  const leadIds = calc.leads.map(l => l.donor_id).filter(Boolean);
  let donorMap = {};
  if (leadIds.length > 0) {
    const { data: donors } = await db
      .from('donor_profiles')
      .select('id, name')
      .in('id', leadIds);
    for (const d of donors || []) {
      donorMap[d.id] = d.name;
    }
  }

  const enrichedLeads = calc.leads.map(l => ({
    ...l,
    donor_name: donorMap[l.donor_id] || 'Unknown',
  }));

  return {
    fro_id: froId,
    fro_name: froResult.data.name,
    date,
    target: calc.target,
    slab: calc.slab,
    total_leads: calc.total_leads,
    qualified_leads: calc.qualified_leads,
    total_amount: calc.total_amount,
    lead_incentive: calc.lead_incentive,
    slab_bonus: calc.slab_bonus,
    champion_bonus: 0,
    total_incentive: calc.lead_incentive + calc.slab_bonus,
    leads: enrichedLeads,
  };
};
