import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import groq from '../config/groq.js';
import emailConfig from '../config/emailConfig.js';
import supabase from '../config/supabase.js';
import { isEmailProcessed, logImport } from '../models/emailImportLogModel.js';
import { getSources } from '../models/bankAuditModel.js';
import { createEntry } from '../models/bankAuditModel.js';
import { getActiveAccounts, updateLastPolled } from '../models/emailAccountModel.js';

let lastPollResult = { success: null, message: 'Not run yet', count: 0, timestamp: null, error: null };

const BANK_EMAIL_DOMAINS = [
  { domain: 'axisbank.com', source: 'Axis Bank' },
  { domain: 'hdfcbank.com', source: 'HDFC Bank' },
  { domain: 'icicibank.com', source: 'ICICI Bank' },
  { domain: 'sbicard.com', source: 'SBI' },
  { domain: 'onlinesbi.com', source: 'SBI' },
  { domain: 'sbi.co.in', source: 'SBI' },
  { domain: 'yesbank.in', source: 'Yes Bank' },
  { domain: 'kotak.com', source: 'Kotak Mahindra' },
  { domain: 'rblbank.com', source: 'RBL Bank' },
  { domain: 'idfcfirstbank.com', source: 'IDFC First Bank' },
  { domain: 'indusind.com', source: 'IndusInd Bank' },
  { domain: 'federalbank.co.in', source: 'Federal Bank' },
  { domain: 'canarabank.com', source: 'Canara Bank' },
  { domain: 'pnb.co.in', source: 'PNB' },
  { domain: 'bankofbaroda.com', source: 'Bank of Baroda' },
  { domain: 'unionbankofindia.com', source: 'Union Bank' },
  { domain: 'bankofindia.co.in', source: 'Bank of India' },
  { domain: 'centralbankofindia.co.in', source: 'Central Bank' },
  { domain: 'dbs.com', source: 'DBS Bank' },
  { domain: 'gpay.com', source: 'GPay' },
  { domain: 'googlepay', source: 'GPay' },
  { domain: 'razorpay.com', source: 'Razorpay' },
  { domain: 'paytm.com', source: 'Paytm' },
  { domain: 'phonepe.com', source: 'PhonePe' },
];

function detectSourceFromSender(emailFrom) {
  if (!emailFrom) return null;
  const lower = emailFrom.toLowerCase();
  for (const entry of BANK_EMAIL_DOMAINS) {
    if (lower.includes(entry.domain)) return entry.source;
  }
  return null;
}

function normalizeSourceName(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  const map = {
    'gpay': 'GPay',
    'google pay': 'GPay',
    'googlepay': 'GPay',
    'g-pay': 'GPay',
    'phonepe': 'PhonePe',
    'phone pe': 'PhonePe',
    'paytm': 'Paytm',
    'razorpay': 'Razorpay',
    'axis bank': 'Axis Bank',
    'axis': 'Axis Bank',
    'saraswat bank': 'Saraswat Bank',
    'saraswat': 'Saraswat Bank',
    'hdfc': 'HDFC Bank',
    'hdfc bank': 'HDFC Bank',
    'icici': 'ICICI Bank',
    'icici bank': 'ICICI Bank',
    'sbi': 'SBI',
    'state bank of india': 'SBI',
    'yes bank': 'Yes Bank',
    'kotak': 'Kotak Mahindra',
    'kotak mahindra': 'Kotak Mahindra',
    'idfc': 'IDFC First Bank',
    'idfc first': 'IDFC First Bank',
    'indusind': 'IndusInd Bank',
    'federal bank': 'Federal Bank',
    'canara bank': 'Canara Bank',
    'pnb': 'PNB',
    'bank of baroda': 'Bank of Baroda',
    'union bank': 'Union Bank',
    'bank of india': 'Bank of India',
    'central bank': 'Central Bank',
    'dbs bank': 'DBS Bank',
    'rbl bank': 'RBL Bank',
    'check': 'Check',
    'cheque': 'Check',
    'cash': 'Cash',
    'bank transfer': 'Bank Transfer',
    'neft': 'Bank Transfer',
    'imps': 'Bank Transfer',
    'rtgs': 'Bank Transfer',
    'upi': 'UPI',
  };
  return map[n] || name.trim();
}

async function getOrCreateSourceId(sources, name) {
  const normalized = normalizeSourceName(name);
  if (!normalized) return null;
  let match = sources.find(s => s.name.toLowerCase() === normalized.toLowerCase());
  if (match) return match.id;
  const { data: newSource, error } = await supabase
    .from('bank_audit_sources')
    .insert({ name: normalized, sort_order: 99 })
    .select()
    .single();
  if (error) return null;
  sources.push(newSource);
  return newSource.id;
}

async function extractPaymentDetails(emailText, emailSubject, emailFrom) {
  const textToAnalyze = [
    emailSubject ? `Subject: ${emailSubject}` : '',
    emailFrom ? `From: ${emailFrom}` : '',
    emailText ? `Body:\n${emailText.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n');

  if (!textToAnalyze) return null;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a payment receipt parser. Extract payment details from the email text.

The email could be from:
- Bank transaction alerts (Axis Bank, HDFC, ICICI, SBI etc) - look for "credited", "deposited", "transaction", "NEFT", "IMPS", "RTGS", "UPI ref"
- Payment gateways (GPay, Razorpay, Paytm, PhonePe) - look for "payment received", "money received", "transfer"
- Donor payment confirmation emails

Return ONLY valid JSON with these fields (use null for missing):
{
  "amount": number or null,
  "payment_id": "transaction ID / UPI ref / payment reference or null",
  "transaction_date": "YYYY-MM-DD or null",
  "sender_name": "name of the person who paid or null",
  "payment_source": "Axis Bank / HDFC Bank / ICICI Bank / SBI / GPay / Razorpay / Paytm / PhonePe / etc or null",
  "confidence": "high / medium / low"
}

Rules:
- Amount should be a number (remove currency symbols, commas)
- Payment source: detect from email content - if it mentions a bank name like Axis/HDFC/SBI/ICICI, use that
- For bank transfer emails, set payment_source to the bank name
- Transaction date: prefer date from email if present, else use null
- sender_name: the person who made the payment (for banks, look for "from" or sender name in narration)
- If the email does NOT appear to be a payment/transaction notification, set all fields to null and confidence to "low"`,
        },
        { role: 'user', content: textToAnalyze },
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Groq parse error:', error.message);
    return null;
  }
}

async function pollSingleAccount(account, sources, fromDate) {
  const config = {
    host: account.imap_host || 'imap.gmail.com',
    port: account.imap_port || 993,
    secure: true,
    auth: { user: account.email, pass: account.app_password },
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };

  const client = new ImapFlow(config);
  let processed = 0;
  let skipped = 0;

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const searchQuery = { seen: false };
    if (fromDate) {
      const since = new Date(fromDate);
      since.setHours(0, 0, 0, 0);
      searchQuery.receivedAfter = since;
    }
    const messages = await client.search(searchQuery);
    if (!messages || messages.length === 0) {
      await client.logout();
      return { processed: 0, skipped: 0, error: null, message: 'No new emails' };
    }

    for await (const msg of client.fetch(messages, { source: true })) {
      try {
        const parsed = await simpleParser(msg.source);
        const messageId = parsed.messageId || msg.uid?.toString();
        if (!messageId) { skipped++; continue; }

        const existing = await isEmailProcessed(messageId);
        if (existing) { skipped++; continue; }

        const emailSubject = parsed.subject || '';
        const emailFrom = parsed.from?.text || '';
        const emailText = parsed.text || parsed.html || '';
        const receivedAt = parsed.date || new Date().toISOString();

        const senderSource = detectSourceFromSender(emailFrom);
        const details = await extractPaymentDetails(emailText, emailSubject, emailFrom);

        if (details && details.confidence !== 'low' && details.amount != null) {
          let sourceName = details.payment_source;
          if (!sourceName && senderSource) sourceName = senderSource;

          let sourceId = sourceName ? await getOrCreateSourceId(sources, sourceName) : null;
          const paymentSource = sourceName || senderSource || 'GPay';

          const transactionDate = details.transaction_date
            ? details.transaction_date
            : receivedAt ? receivedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

          const entry = await createEntry({
            source_id: sourceId || 1,
            amount: details.amount,
            payment_id: details.payment_id || null,
            transaction_date: transactionDate,
            remarks: `[${account.name}] Auto-imported from email: ${emailSubject}`,
            created_by: null,
          });

          await logImport({
            email_message_id: messageId,
            email_subject: emailSubject,
            email_from: emailFrom,
            received_at: receivedAt,
            parsed_amount: details.amount,
            parsed_payment_id: details.payment_id,
            parsed_transaction_date: transactionDate,
            parsed_source: paymentSource,
            parsed_sender_name: details.sender_name,
            bank_entry_id: entry.id,
            status: 'imported',
            raw_snippet: emailText.slice(0, 500),
          });

          processed++;
        } else {
          await logImport({
            email_message_id: messageId,
            email_subject: emailSubject,
            email_from: emailFrom,
            received_at: receivedAt,
            status: 'skipped',
            error_message: senderSource ? `Bank alert (${senderSource}) but no amount found` : (details ? 'Low confidence or no payment data' : 'Failed to parse'),
            raw_snippet: emailText.slice(0, 500),
          });
          skipped++;
        }
      } catch (msgError) {
        console.error(`[emailImporter] ${account.name}: message error:`, msgError.message);
        skipped++;
      }
    }

    await client.logout();
    await updateLastPolled(account.id);
    return { processed, skipped, error: null, message: `${processed} imported, ${skipped} skipped` };
  } catch (error) {
    try { await client.logout(); } catch {}
    return { processed, skipped, error: error.message, message: `IMAP error: ${error.message}` };
  }
}

export async function pollEmailInbox(fromDate) {
  const accounts = await getActiveAccounts();

  if (!accounts || accounts.length === 0) {
    if (emailConfig.enabled && emailConfig.imap.auth.user && emailConfig.imap.auth.pass) {
      accounts.push({
        id: null,
        name: 'Default',
        email: emailConfig.imap.auth.user,
        app_password: emailConfig.imap.auth.pass,
        imap_host: emailConfig.imap.host,
        imap_port: emailConfig.imap.port,
      });
    } else {
      lastPollResult = { success: null, message: 'No email accounts configured. Add one in Email Import settings.', count: 0, timestamp: new Date().toISOString(), error: null };
      return lastPollResult;
    }
  }

  const sources = await getSources();
  if (!sources || sources.length === 0) {
    console.warn('[emailImporter] No bank audit sources found');
  }

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const details = [];

  for (const account of accounts) {
    console.log(`[emailImporter] Polling ${account.name} (${account.email})...`);
    const result = await pollSingleAccount(account, sources, fromDate);
    totalProcessed += result.processed;
    totalSkipped += result.skipped;
    if (result.error) totalErrors++;
    details.push({ name: account.email, result });
  }

  lastPollResult = {
    success: totalErrors === 0,
    message: `Accounts: ${accounts.length} | Imported: ${totalProcessed} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`,
    count: totalProcessed,
    timestamp: new Date().toISOString(),
    error: totalErrors > 0 ? `${totalErrors} account(s) had errors` : null,
    details,
  };
  return lastPollResult;
}

export function getLastPollResult() {
  return lastPollResult;
}
