import supabase from '../config/supabase.js';

export async function isEmailProcessed(messageId) {
  const { data, error } = await supabase
    .from('email_import_log')
    .select('id, status')
    .eq('email_message_id', messageId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function logImport({
  email_message_id, email_subject, email_from, received_at,
  parsed_amount, parsed_payment_id, parsed_transaction_date,
  parsed_source, parsed_sender_name, bank_entry_id, status, error_message, raw_snippet,
  account_id, account_name, seen,
}) {
  const { data, error } = await supabase
    .from('email_import_log')
    .insert({
      email_message_id,
      email_subject: email_subject || null,
      email_from: email_from || null,
      received_at: received_at || null,
      parsed_amount: parsed_amount || null,
      parsed_payment_id: parsed_payment_id || null,
      parsed_transaction_date: parsed_transaction_date || null,
      parsed_source: parsed_source || null,
      parsed_sender_name: parsed_sender_name || null,
      bank_entry_id: bank_entry_id || null,
      status: status || 'imported',
      error_message: error_message || null,
      raw_snippet: raw_snippet ? raw_snippet.slice(0, 1000) : null,
      account_id: account_id || null,
      account_name: account_name || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getImportLog(filters = {}) {
  let query = supabase
    .from('email_import_log')
    .select('*, bank_audit_entries!left(id, amount, bank_audit_sources(name))')
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.account_id) query = query.eq('account_id', filters.account_id);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function countByStatus() {
  const { data, error } = await supabase
    .from('email_import_log')
    .select('status');
  if (error) throw error;
  const counts = { imported: 0, failed: 0, skipped: 0 };
  for (const row of data || []) {
    if (counts[row.status] !== undefined) counts[row.status]++;
  }
  return counts;
}
