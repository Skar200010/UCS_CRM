import { supabase } from './supabase';

let cachedToken: string | null = null;
let cachedWabaId: string | null = null;
let cachedPhoneNumberId: string | null = null;
let fetchPromise: Promise<void> | null = null;

export async function loadMetaCredentials(): Promise<void> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
      if (!profile) return;
      const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', profile.tenant_id).single();
      if (tenant?.settings) {
        const s = tenant.settings as any;
        cachedToken = s.wa_access_token || null;
        cachedWabaId = s.waba_id || null;
      }
      const { data: phone } = await supabase.from('whatsapp_phone_numbers').select('phone_number_id').eq('tenant_id', profile.tenant_id).eq('is_primary', true).maybeSingle();
      cachedPhoneNumberId = phone?.phone_number_id || null;
    } catch {
      // Silently fail - keep existing cache
    }
  })();
  return fetchPromise;
}

export function getCachedToken(): string | null { return cachedToken; }
export function getCachedWabaId(): string | null { return cachedWabaId; }
export function getCachedPhoneNumberId(): string | null { return cachedPhoneNumberId; }

export function hasCachedCredentials(): boolean {
  return !!(cachedToken && cachedWabaId);
}

export async function saveMetaCredentials(token: string, wabaId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error('Profile not found');
  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', profile.tenant_id).single();
  const settings = (tenant?.settings || {}) as any;
  settings.wa_access_token = token || null;
  settings.waba_id = wabaId || null;
  const { error } = await supabase.from('tenants').update({ settings }).eq('id', profile.tenant_id);
  if (error) throw error;
  cachedToken = token || null;
  cachedWabaId = wabaId || null;
  fetchPromise = null;
}

export async function clearMetaCredentials(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
  if (!profile) return;
  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', profile.tenant_id).single();
  const settings = (tenant?.settings || {}) as any;
  delete settings.wa_access_token;
  delete settings.waba_id;
  await supabase.from('tenants').update({ settings }).eq('id', profile.tenant_id);
  cachedToken = null;
  cachedWabaId = null;
  fetchPromise = null;
}

export function invalidateCredentialsCache(): void {
  fetchPromise = null;
}
