import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GarminClient, GarminAuthError, GarminRateLimitError } from 'garminconnect-js';
import { getGarminTokens, saveGarminTokens, getTokenStatus, type TokenStatus, type GarminTokens } from './garminTokens';

function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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

export interface AuthResult {
  success: boolean;
  needsMfa?: boolean;
  sessionId?: string;
  message?: string;
  error?: string;
  displayName?: string;
  expiresAt?: number | string | null;
  profile?: any;
}

/**
 * Get current token health from Supabase DB
 */
export async function getGarminTokenStatus(): Promise<TokenStatus> {
  try {
    const tokens = await getGarminTokens();
    return getTokenStatus(tokens);
  } catch (err: any) {
    console.error('[garminAuth] getGarminTokenStatus error:', err);
    return getTokenStatus(null);
  }
}

/**
 * Step 1: Login with Garmin email and password
 */
export async function loginGarmin(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = (email || '').trim();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const client = new GarminClient();
  let loginRes: any;
  try {
    loginRes = await client.login(cleanEmail, password);
  } catch (err: any) {
    console.error('[garminAuth] client.login error:', err);
    if (err instanceof GarminAuthError || err.name === 'GarminAuthError') {
      return {
        success: false,
        error: 'Invalid Garmin email or password. Please check your credentials.',
      };
    }
    if (err instanceof GarminRateLimitError || err.name === 'GarminRateLimitError') {
      return {
        success: false,
        error: 'Garmin rate limit reached (HTTP 429). Please wait 5–10 minutes before retrying.',
      };
    }
    return {
      success: false,
      error: `Garmin authentication failed: ${err.message}`,
    };
  }

  // Case A: 2FA / MFA required
  if (loginRes.state === 'mfa_required') {
    const supabase = getAdminSupabase();
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes TTL

    if (supabase) {
      try {
        await supabase
          .from('garmin_login_sessions')
          .delete()
          .lt('expires_at', now.toISOString());
      } catch (cleanErr: any) {
        console.warn('[garminAuth] Session cleanup warning:', cleanErr.message);
      }

      const { error: insErr } = await supabase.from('garmin_login_sessions').insert({
        session_id: sessionId,
        state: loginRes.mfaState,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (insErr) {
        console.error('[garminAuth] Failed to record MFA session:', insErr);
      }
    }

    return {
      success: true,
      needsMfa: true,
      sessionId,
      message: 'Garmin 2FA verification required. Please enter the 6-digit code sent to your email or Garmin app.',
    };
  }

  // Case B: Direct success without MFA
  if (loginRes.state === 'success') {
    const tokensObj: GarminTokens = {
      di_token: loginRes.oauth2?.access_token,
      di_refresh_token: loginRes.oauth2?.refresh_token,
      di_client_id: 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
      oauth1: loginRes.oauth1,
      oauth2: loginRes.oauth2,
    };

    const { ok, error: saveErr } = await saveGarminTokens(tokensObj);
    if (!ok) {
      return {
        success: false,
        error: `Login succeeded but failed to save tokens to database: ${saveErr}`,
      };
    }

    return {
      success: true,
      needsMfa: false,
      message: 'Logged in successfully! Fresh tokens stored to database.',
      displayName: cleanEmail,
      expiresAt: loginRes.oauth2?.expires_at,
    };
  }

  return { success: false, error: 'Unexpected login state returned from Garmin' };
}

/**
 * Step 2: Verify MFA code and complete login
 */
export async function verifyGarminMfa(sessionId: string, code: string): Promise<AuthResult> {
  const cleanCode = String(code || '').trim();
  const cleanSessionId = String(sessionId || '').trim();

  if (!cleanSessionId || !cleanCode) {
    return { success: false, error: 'Session ID and 6-digit verification code are required' };
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase database is not configured.' };
  }

  const { data: sessionRecord, error: sessErr } = await supabase
    .from('garmin_login_sessions')
    .select('*')
    .eq('session_id', cleanSessionId)
    .maybeSingle();

  if (sessErr || !sessionRecord) {
    return {
      success: false,
      error: 'MFA login session expired or invalid (sessions expire after 5 minutes). Please start login again.',
    };
  }

  if (sessionRecord.expires_at) {
    const expiresAt = new Date(sessionRecord.expires_at);
    if (Date.now() > expiresAt.getTime()) {
      await supabase.from('garmin_login_sessions').delete().eq('session_id', cleanSessionId);
      return {
        success: false,
        error: 'MFA session expired. Please start login again.',
      };
    }
  }

  const client = new GarminClient();
  try {
    await client.resumeLogin(sessionRecord.state, cleanCode);
  } catch (err: any) {
    console.error('[garminAuth] resumeLogin error:', err);
    if (err instanceof GarminAuthError || err.name === 'GarminAuthError') {
      return {
        success: false,
        error: 'Invalid MFA verification code. Please check your code and try again.',
      };
    }
    return {
      success: false,
      error: `MFA verification failed: ${err.message}`,
    };
  }

  const freshTokens = client.getTokens();
  if (!freshTokens?.oauth2?.access_token) {
    return {
      success: false,
      error: 'MFA verification succeeded but received incomplete tokens from Garmin.',
    };
  }

  const tokensObj: GarminTokens = {
    di_token: freshTokens.oauth2.access_token,
    di_refresh_token: freshTokens.oauth2.refresh_token,
    di_client_id: 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
    oauth1: freshTokens.oauth1,
    oauth2: freshTokens.oauth2,
  };

  const { ok, error: saveErr } = await saveGarminTokens(tokensObj);
  if (!ok) {
    return {
      success: false,
      error: `Failed to save tokens to database: ${saveErr}`,
    };
  }

  // Cleanup used session
  try {
    await supabase.from('garmin_login_sessions').delete().eq('session_id', cleanSessionId);
  } catch (delErr: any) {
    console.warn('[garminAuth] Failed to delete session:', delErr?.message);
  }

  return {
    success: true,
    message: 'Garmin MFA verified and fresh tokens stored in database!',
    expiresAt: freshTokens.oauth2.expires_at,
  };
}

/**
 * Test live connection to Garmin API using stored DB token
 */
export async function testGarminConnection(): Promise<AuthResult> {
  const tokens = await getGarminTokens();
  if (!tokens || !tokens.di_token) {
    return { success: false, error: 'No tokens found in database. Please log in first.' };
  }

  try {
    const res = await fetch('https://connectapi.garmin.com/userprofile-service/socialProfile', {
      headers: nativeHeaders({
        Authorization: `Bearer ${tokens.di_token}`,
        Accept: 'application/json',
      }),
    });

    if (res.ok) {
      const profile = await res.json().catch(() => ({}));
      return {
        success: true,
        message: `Connection verified! Connected as ${profile.displayName || profile.userName || 'Runner'}`,
        profile: {
          displayName: profile.displayName,
          userName: profile.userName,
        },
      };
    } else {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        error: `Garmin API returned ${res.status}: ${text.slice(0, 200)}`,
      };
    }
  } catch (fetchErr: any) {
    return {
      success: false,
      error: `Connection error: ${fetchErr.message}`,
    };
  }
}
