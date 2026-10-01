/**
 * lib/garminTokens.ts
 *
 * Centralised Garmin token store & automatic silent token refresher for Vercel/Next.js.
 *
 * Priority (read):
 *   1. Supabase `garmin_tokens` table  (production / Vercel)
 *   2. process.env.GARMIN_TOKENS_JSON  (env-var fallback)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';

export interface GarminTokens {
  di_token?: string;
  di_refresh_token?: string;
  di_client_id?: string;
  [key: string]: any;
}

export interface TokenStatus {
  hasToken: boolean;
  status: 'missing' | 'valid' | 'expired' | 'expiring_soon';
  expiresAt: string | null;
  expiresInHours: number | null;
  hasRefreshToken: boolean;
  clientId: string;
  garminGuid: string | null;
}

function nativeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'User-Agent': 'GCM-Android-5.23',
    'X-Garmin-User-Agent':
      'com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0',
    'X-Garmin-Paired-App-Version': '10861',
    'X-Garmin-Client-Platform': 'Android',
    'X-App-Ver': '10861',
    'X-Lang': 'en',
    'X-GCExperience': 'GC5',
    'Accept-Language': 'en-US,en;q=0.9',
    ...extra,
  };
}

function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export function decodeJwtPayload(token?: string): Record<string, any> | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Refreshes an expired or expiring access token using the long-lived refresh token.
 * Saves the resulting fresh tokens into Supabase automatically.
 */
export async function refreshGarminTokens(tokens: GarminTokens): Promise<GarminTokens> {
  if (!tokens || !tokens.di_refresh_token) {
    throw new Error('No refresh token available to renew session');
  }

  const clientId = tokens.di_client_id || 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2';
  const basicAuth = Buffer.from(`${clientId}:`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: tokens.di_refresh_token,
  });

  const res = await fetch(DI_TOKEN_URL, {
    method: 'POST',
    headers: nativeHeaders({
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    }),
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const updatedTokens: GarminTokens = {
    ...tokens,
    di_token: data.access_token,
    di_refresh_token: data.refresh_token || tokens.di_refresh_token,
    di_client_id: clientId,
  };

  await saveGarminTokens(updatedTokens);
  return updatedTokens;
}

/**
 * Returns the best available Garmin token object, or null.
 * Automatically performs silent renewal if token is expiring within 15 minutes.
 */
export async function getGarminTokens(autoRefresh = true): Promise<GarminTokens | null> {
  let tokens: GarminTokens | null = null;

  // 1. Supabase
  const supabase = getAdminSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('garmin_tokens')
        .select('tokens_json')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data?.tokens_json?.di_token) {
        tokens = data.tokens_json as GarminTokens;
      }
    } catch (err: any) {
      console.warn('[garminTokens] Supabase read error:', err.message);
    }
  }

  // 2. Env var fallback
  if (!tokens && process.env.GARMIN_TOKENS_JSON) {
    try {
      let raw = process.env.GARMIN_TOKENS_JSON.trim();
      if (
        (raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('"') && raw.endsWith('"'))
      ) {
        raw = raw.slice(1, -1);
      }
      const parsed = JSON.parse(raw);
      if (parsed?.di_token) tokens = parsed;
    } catch {
      // ignore
    }
  }

  if (!tokens || !tokens.di_token) return null;

  // 3. Silent Auto-Refresh if expiring soon or expired
  if (autoRefresh && tokens.di_refresh_token) {
    const payload = decodeJwtPayload(tokens.di_token);
    const exp = payload?.exp;
    const nowSec = Math.floor(Date.now() / 1000);

    // If expired or less than 15 minutes left
    if (exp && nowSec > exp - 900) {
      try {
        tokens = await refreshGarminTokens(tokens);
      } catch (refreshErr: any) {
        console.warn('[garminTokens] Silent auto-refresh failed:', refreshErr.message);
      }
    }
  }

  return tokens;
}

/**
 * Persists tokens to Supabase (upsert id=1) and updates the in-process env var.
 */
export async function saveGarminTokens(tokens: GarminTokens): Promise<{ ok: boolean; error?: string }> {
  if (!tokens || !tokens.di_token) {
    return { ok: false, error: 'tokens must contain di_token' };
  }

  // Always update in-memory env
  process.env.GARMIN_TOKENS_JSON = JSON.stringify(tokens);

  const supabase = getAdminSupabase();
  if (!supabase) {
    return { ok: false, error: 'Supabase not configured — tokens saved in memory only' };
  }

  try {
    const { error } = await supabase
      .from('garmin_tokens')
      .upsert(
        { id: 1, tokens_json: tokens, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );

    if (error) throw error;
    return { ok: true };
  } catch (err: any) {
    console.error('[garminTokens] Supabase write error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Returns an object describing the current token health.
 */
export function getTokenStatus(tokens: GarminTokens | null): TokenStatus {
  if (!tokens || !tokens.di_token) {
    return {
      hasToken: false,
      status: 'missing',
      expiresAt: null,
      expiresInHours: null,
      hasRefreshToken: false,
      clientId: 'Garmin Client',
      garminGuid: null,
    };
  }

  const payload = decodeJwtPayload(tokens.di_token);
  const exp = payload?.exp;
  const nowSec = Math.floor(Date.now() / 1000);

  if (!exp) {
    return {
      hasToken: true,
      status: 'valid',
      expiresAt: null,
      expiresInHours: null,
      hasRefreshToken: !!tokens.di_refresh_token,
      clientId: tokens.di_client_id || payload?.client_id || 'Garmin Client',
      garminGuid: payload?.garmin_guid || null,
    };
  }

  const diffSec = exp - nowSec;
  const expiresAt = new Date(exp * 1000).toISOString();
  const expiresInHours = Math.round((diffSec / 3600) * 10) / 10;

  let status: 'valid' | 'expired' | 'expiring_soon' = 'valid';
  if (diffSec <= 0) status = 'expired';
  else if (diffSec < 900) status = 'expiring_soon';

  return {
    hasToken: true,
    status,
    expiresAt,
    expiresInHours,
    hasRefreshToken: !!tokens.di_refresh_token,
    clientId: tokens.di_client_id || payload?.client_id || 'Garmin Client',
    garminGuid: payload?.garmin_guid || null,
  };
}
