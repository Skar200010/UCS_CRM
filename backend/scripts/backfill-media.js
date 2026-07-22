import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadAndStore(mediaId, mimeType, messageId) {
  const { data: accounts } = await supabase
    .from('whatsapp_accounts')
    .select('access_token')
    .eq('is_active', true)
    .limit(1);

  if (!accounts?.[0]) {
    console.log(`  No active account for media ${mediaId}`);
    return false;
  }

  const token = accounts[0].access_token;

  try {
    const infoRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const info = await infoRes.json();

    if (!infoRes.ok || !info.url) {
      console.log(`  Failed to get URL for ${mediaId}: ${info.error?.message || 'No URL'}`);
      return false;
    }

    const dlRes = await fetch(info.url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!dlRes.ok) {
      console.log(`  Failed to download ${mediaId}: ${dlRes.status}`);
      return false;
    }

    const blob = await dlRes.blob();
    const ext = ((mimeType || 'image/jpeg').split('/')[1] || 'bin').split(';')[0].trim();
    const fileName = `backfill_${messageId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, blob, { contentType: mimeType || 'image/jpeg', upsert: true });

    if (uploadError) {
      console.log(`  Upload failed for ${mediaId}: ${uploadError.message}`);
      return false;
    }

    const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      await supabase.from('messages').update({ media_url: urlData.publicUrl }).eq('id', messageId);
      console.log(`  ✅ Stored: ${urlData.publicUrl}`);
      return true;
    }

    return false;
  } catch (err) {
    console.log(`  Error processing ${mediaId}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Fetching messages with media_id but no media_url...\n');

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, message_type, media_id, media_mime_type, created_at')
    .not('media_id', 'is', null)
    .is('media_url', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query error:', error.message);
    return;
  }

  console.log(`Found ${messages.length} messages to process\n`);

  let success = 0;
  let failed = 0;

  for (const msg of messages) {
    const date = new Date(msg.created_at).toLocaleDateString();
    console.log(`[${date}] ${msg.message_type}: media_id=${msg.media_id}`);
    const ok = await downloadAndStore(msg.media_id, msg.media_mime_type, msg.id);
    if (ok) success++; else failed++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone! ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
