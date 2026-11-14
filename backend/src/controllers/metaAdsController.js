import db from '../config/db.js';
import {
  META_LEAD_SOURCE,
  META_NGOS,
  discoverMetaForms,
  fetchCampaignInsights,
  fetchCampaigns,
  getCampaignPerformance,
  getInsightsSummary,
  getMetaConfig,
  getMetaFunnel,
  getSyncState,
  isMetaAdsConfigured,
  isMetaInsightsConfigured,
  isMetaLeadCaptureConfigured,
  listMetaAdAccounts as fetchAdAccounts,
  metaLeadCount,
  metaDateRange,
  ngoToAccount,
  syncInsights,
  verifyMetaSignature,
} from '../services/metaAdsService.js';
import {
  pollMetaLeadForms,
  processMetaWebhookPayload,
} from '../services/metaLeadIngestService.js';

const daysOf = (value, fallback = 30) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), 365);

async function collectStatus() {
  const cfg = getMetaConfig();
  const configured = isMetaAdsConfigured();
  const checks = {
    token: Boolean(cfg.accessToken),
    app_secret: Boolean(cfg.appSecret),
    verify_token: Boolean(cfg.verifyToken),
    ad_account: Boolean(cfg.adAccountId),
  };

  let counts = { forms: 0, mapped_forms: 0, leads: 0, leads_7d: 0 };
  try {
    const { rows } = await db._pool.query(
      `select
         (select count(*)::int from meta_lead_forms) as forms,
         (select count(*)::int from meta_lead_forms where ngo is not null and ngo <> '') as mapped_forms,
         (select count(*)::int from leads where source = $1) as leads,
         (select count(*)::int from leads where source = $1 and created_at >= now() - interval '7 days') as leads_7d`,
      [META_LEAD_SOURCE],
    );
    if (rows[0]) counts = rows[0];
  } catch {
    // Schema not applied yet — the status endpoint must still answer.
  }

  const [leadSync, insightSync] = await Promise.all([
    getSyncState('leads').catch(() => null),
    getSyncState('insights').catch(() => null),
  ]);

  const insightsReady = isMetaInsightsConfigured();
  return {
    connected: insightsReady || checks.token,
    configured,
    lead_capture: checks.token,
    insights: insightsReady,
    api_version: cfg.apiVersion,
    ad_account_id: cfg.adAccountId || null,
    checks,
    counts,
    lead_sync: leadSync,
    insight_sync: insightSync,
    message: configured
      ? (checks.ad_account ? 'Meta Ads connected' : 'Add META_ADS_AD_ACCOUNT_ID to load campaigns and insights.')
      : 'Meta Ads not configured. Add META_ADS_ACCESS_TOKEN, META_ADS_APP_SECRET and META_ADS_VERIFY_TOKEN.',
  };
}

export async function metaAdsStatus(req, res) {
  try {
    return res.json(await collectStatus());
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function listMetaAdAccounts(req, res) {
  try {
    if (!isMetaAdsConfigured()) return res.json([]);
    const accounts = await fetchAdAccounts();
    return res.json(accounts);
  } catch (e) {
    console.error('Meta ad accounts failed:', e?.message || e);
    return res.json([]);
  }
}

export async function listMetaCampaigns(req, res) {
  try {
    const days = daysOf(req.query.days);
    const perf = await getCampaignPerformance({ days });
    const perfBy = new Map(perf.map((p) => [String(p.campaign_id), p]));

    let graphCampaigns = [];
    if (isMetaInsightsConfigured()) {
      try {
        graphCampaigns = await fetchCampaigns();
      } catch (e) {
        console.error('Meta campaigns fetch failed:', e?.message || e);
      }
    }

    if (graphCampaigns.length) {
      return res.json(graphCampaigns.map((c) => {
        const p = perfBy.get(String(c.id)) || {};
        return {
          id: c.id,
          campaign_id: String(c.id),
          campaign_name: c.name || p.campaign_name || String(c.id),
          name: c.name || p.campaign_name || String(c.id),
          status: c.status || null,
          objective: c.objective || p.objective || null,
          daily_budget: c.daily_budget || null,
          lifetime_budget: c.lifetime_budget || null,
          start_time: c.start_time || null,
          stop_time: c.stop_time || null,
          spend: p.spend || 0,
          impressions: p.impressions || 0,
          clicks: p.clicks || 0,
          reach: p.reach || 0,
          meta_leads: p.meta_leads || 0,
          crm_leads: p.crm_leads || 0,
          ctr: p.ctr || 0,
          cpc: p.cpc || 0,
          cpl: p.cpl || 0,
          crm_cpl: p.crm_cpl || 0,
        };
      }));
    }

    return res.json(perf.map((p) => ({
      ...p,
      id: p.campaign_id,
      name: p.campaign_name,
      status: null,
    })));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function getMetaCampaignInsights(req, res) {
  try {
    const days = daysOf(req.query.days);
    const campaignId = req.params.id;

    if (isMetaInsightsConfigured()) {
      try {
        const raw = await fetchCampaignInsights(campaignId, { days });
        const rows = raw.map((r) => ({
          date: r.date_start,
          spend: Number(r.spend) || 0,
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          reach: Number(r.reach) || 0,
          ctr: Number(r.ctr) || 0,
          cpc: Number(r.cpc) || 0,
          cpm: Number(r.cpm) || 0,
          leads: metaLeadCount(r.actions),
        }));
        const totals = rows.reduce((acc, r) => {
          acc.spend += r.spend;
          acc.impressions += r.impressions;
          acc.clicks += r.clicks;
          acc.reach += r.reach;
          acc.leads += r.leads;
          return acc;
        }, { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 });
        return res.json({ campaign_id: campaignId, rows, totals });
      } catch (e) {
        console.error('Meta campaign insights failed:', e?.message || e);
      }
    }

    const range = metaDateRange(days);
    const { rows } = await db._pool.query(
      `select date_start::text as date, spend, impressions, clicks, reach, ctr, cpc, cpm, meta_leads, crm_leads
         from meta_campaign_insights_daily
        where campaign_id = $1 and date_start >= $2::date
        order by date_start asc`,
      [campaignId, range.since],
    );
    return res.json({
      campaign_id: campaignId,
      rows: rows.map((r) => ({
        ...r,
        spend: Number(r.spend) || 0,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        reach: Number(r.reach) || 0,
        ctr: Number(r.ctr) || 0,
        cpc: Number(r.cpc) || 0,
        cpm: Number(r.cpm) || 0,
        leads: Number(r.meta_leads) || 0,
      })),
      cached: true,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function getMetaInsightsSummary(req, res) {
  try {
    return res.json(await getInsightsSummary({ days: daysOf(req.query.days) }));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function getMetaFunnelHandler(req, res) {
  try {
    return res.json(await getMetaFunnel({ days: daysOf(req.query.days) }));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function syncMetaInsights(req, res) {
  try {
    if (!isMetaInsightsConfigured()) {
      return res.status(400).json({ message: 'Meta Ads is not configured with an ad account id' });
    }
    const result = await syncInsights({ days: daysOf(req.body?.days ?? req.query.days) });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function syncMetaLeads(req, res) {
  try {
    const result = await pollMetaLeadForms({ sinceDays: daysOf(req.body?.sinceDays, 7) });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function listMetaForms(req, res) {
  try {
    if (String(req.query.refresh || '') === '1' && isMetaLeadCaptureConfigured()) {
      await discoverMetaForms().catch((e) => {
        console.error('Meta form discovery failed:', e?.message || e);
      });
    }
    const { data, error } = await db
      .from('meta_lead_forms')
      .select('*')
      .order('form_name', { ascending: true });
    if (error) throw error;
    return res.json((data || []).map((f) => ({ ...f, mapped: Boolean(f.ngo) })));
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function remapFormLeads(formId, account) {
  const { rows } = await db._pool.query(
    'select id, notes from leads where meta_form_id = $1',
    [String(formId)],
  );
  let changed = 0;
  for (const row of rows) {
    const cleaned = String(row.notes || '')
      .split('\n')
      .filter((line) => !/^\[Account:\s*[^\]]*\]$/i.test(line.trim()))
      .join('\n')
      .trim();
    const next = account ? `${cleaned}${cleaned ? '\n' : ''}[Account: ${account}]` : cleaned;
    if (next !== (row.notes || '')) {
      await db._pool.query('update leads set notes = $2 where id = $1', [row.id, next]);
      changed += 1;
    }
  }
  return changed;
}

export async function saveMetaForm(req, res) {
  try {
    const formId = String(req.body?.form_id || '').trim();
    if (!formId) return res.status(400).json({ message: 'form_id is required' });

    const rawNgo = String(req.body?.ngo || '').trim().toUpperCase();
    const ngo = META_NGOS.includes(rawNgo) ? rawNgo : null;
    if (req.body?.ngo && !ngo) {
      return res.status(400).json({ message: `ngo must be one of ${META_NGOS.join(', ')}` });
    }
    const account = ngoToAccount(ngo);
    const active = req.body?.active === undefined ? true : Boolean(req.body.active);

    const payload = {
      form_id: formId,
      ngo,
      account,
      active,
      updated_at: new Date().toISOString(),
    };
    if (req.body?.form_name !== undefined) payload.form_name = req.body.form_name || null;
    if (req.body?.page_id !== undefined) payload.page_id = req.body.page_id || null;

    const { data, error } = await db
      .from('meta_lead_forms')
      .upsert(payload, { onConflict: 'form_id' })
      .select()
      .single();
    if (error) throw error;

    const remapped = await remapFormLeads(formId, account);
    return res.json({ ...data, mapped: Boolean(ngo), remapped });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function deleteMetaForm(req, res) {
  try {
    const formId = String(req.params.formId || '').trim();
    if (!formId) return res.status(400).json({ message: 'form_id is required' });
    const { data, error } = await db
      .from('meta_lead_forms')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('form_id', formId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Form not found' });
    return res.json({ ...data, mapped: Boolean(data.ngo) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

// ---- Webhook (public) ------------------------------------------------------

export function verifyMetaAdsWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = getMetaConfig().verifyToken;
  if (mode === 'subscribe' && expected && token === expected) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
}

export async function metaAdsWebhookEntry(req, res) {
  const cfg = getMetaConfig();
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  if (cfg.appSecret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!verifyMetaSignature(rawBody, signature)) {
      return res.status(401).json({ received: false });
    }
  }

  // Meta retries any webhook that takes too long. Acknowledge immediately and
  // fetch the lead from Graph in the background (Graph calls can take seconds).
  res.status(200).json({ received: true });
  setImmediate(() => {
    processMetaWebhookPayload(req.body || {}).catch((e) => {
      console.error('Meta webhook processing failed:', e?.message || e);
    });
  });
}
