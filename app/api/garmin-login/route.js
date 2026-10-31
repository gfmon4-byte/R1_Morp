export const dynamic = 'force-dynamic';
export const revalidate = 0;

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GarminClient, GarminAuthError, GarminRateLimitError } from 'garminconnect-js';
import { getGarminTokens, saveGarminTokens, getTokenStatus } from '@/lib/garminTokens';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function nativeHeaders(extra = {}) {
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

/**
 * GET: Returns current token health and metadata from Supabase
 */
export async function GET() {
  try {
    const tokens = await getGarminTokens();
    const status = getTokenStatus(tokens);
    return Response.json(status);
  } catch (err) {
    console.error('[garmin-login GET]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST: Handles login, MFA, test connection, and raw token saving
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || (body.otp_code || body.code ? 'mfa' : 'login');

    // ── 1. Action: Direct Login with Email & Password ────────────────────────
    if (action === 'login') {
      const email = (body.email || '').trim();
      const password = body.password || '';

      if (!email || !password) {
        return Response.json(
          { success: false, error: 'Email and password are required' },
          { status: 400 }
        );
      }

      const client = new GarminClient();
      let loginRes;
      try {
        loginRes = await client.login(email, password);
      } catch (err) {
        console.error('[garmin-login] Garmin client.login error:', err);
        if (err instanceof GarminAuthError || err.name === 'GarminAuthError') {
          return Response.json(
            { success: false, error: 'Invalid Garmin email or password. Please check your credentials.' },
            { status: 401 }
          );
        }
        if (err instanceof GarminRateLimitError || err.name === 'GarminRateLimitError') {
          return Response.json(
            { success: false, error: 'Garmin rate limit reached (HTTP 429). Please wait 5–10 minutes before retrying.' },
            { status: 429 }
          );
        }
        return Response.json(
          { success: false, error: `Garmin authentication failed: ${err.message}` },
          { status: 400 }
        );
      }

      // Step A: MFA challenge required
      if (loginRes.state === 'mfa_required') {
        const supabase = getSupabase();
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes TTL

        if (supabase) {
          // Opportunistically clean up expired sessions
          try {
            await supabase
              .from('garmin_login_sessions')
              .delete()
              .lt('expires_at', now.toISOString());
          } catch (cleanErr) {
            console.warn('[garmin-login] Session cleanup warning:', cleanErr.message);
          }

          const { error: insErr } = await supabase
            .from('garmin_login_sessions')
            .insert({
              session_id: sessionId,
              state: loginRes.mfaState,
              created_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
            });

          if (insErr) {
            console.error('[garmin-login] Failed to record MFA session:', insErr);
          }
        }

        return Response.json({
          success: true,
          needsMfa: true,
          needs_mfa: true,
          session_id: sessionId,
          mfaState: sessionId,
          message: 'Garmin 2FA verification required. Please enter the 6-digit code sent to your email or Garmin app.',
        });
      }

      // Step B: Direct success without MFA
      if (loginRes.state === 'success') {
        const tokensObj = {
          di_token: loginRes.oauth2?.access_token,
          di_refresh_token: loginRes.oauth2?.refresh_token,
          di_client_id: 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
          oauth1: loginRes.oauth1,
          oauth2: loginRes.oauth2,
        };

        const { ok, error: saveErr } = await saveGarminTokens(tokensObj);
        if (!ok) {
          return Response.json(
            { success: false, error: `Login succeeded but failed to save tokens to database: ${saveErr}` },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          needsMfa: false,
          needs_mfa: false,
          message: 'Logged in successfully! Fresh tokens stored to database.',
          displayName: email,
          expiresAt: loginRes.oauth2?.expires_at,
        });
      }

      return Response.json(
        { success: false, error: 'Unexpected login state returned from Garmin' },
        { status: 500 }
      );
    }

    // ── 2. Action: Verify 6-digit MFA Code ───────────────────────────────────
    if (action === 'mfa' || body.otp_code || body.code) {
      const sessionId = body.session_id || body.mfaState;
      const code = String(body.code || body.otp_code || '').trim();

      if (!sessionId || !code) {
        return Response.json(
          { success: false, error: 'Session ID and 6-digit verification code are required' },
          { status: 400 }
        );
      }

      const supabase = getSupabase();
      if (!supabase) {
        return Response.json(
          { success: false, error: 'Supabase database is not configured.' },
          { status: 500 }
        );
      }

      const { data: sessionRecord, error: sessErr } = await supabase
        .from('garmin_login_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (sessErr || !sessionRecord) {
        return Response.json(
          {
            success: false,
            session_expired: true,
            error: 'MFA login session expired or invalid (sessions expire after 5 minutes). Please start login again.',
          },
          { status: 400 }
        );
      }

      // Check expiry
      if (sessionRecord.expires_at) {
        const expiresAt = new Date(sessionRecord.expires_at);
        if (Date.now() > expiresAt.getTime()) {
          await supabase.from('garmin_login_sessions').delete().eq('session_id', sessionId);
          return Response.json(
            {
              success: false,
              session_expired: true,
              error: 'MFA session expired. Please start login again.',
            },
            { status: 400 }
          );
        }
      }

      const client = new GarminClient();
      try {
        await client.resumeLogin(sessionRecord.state, code);
      } catch (err) {
        console.error('[garmin-login] resumeLogin error:', err);
        if (err instanceof GarminAuthError || err.name === 'GarminAuthError') {
          return Response.json(
            { success: false, error: 'Invalid MFA verification code. Please check your code and try again.' },
            { status: 401 }
          );
        }
        return Response.json(
          { success: false, error: `MFA verification failed: ${err.message}` },
          { status: 400 }
        );
      }

      const freshTokens = client.getTokens();
      if (!freshTokens?.oauth2?.access_token) {
        return Response.json(
          { success: false, error: 'MFA verification succeeded but received incomplete tokens from Garmin.' },
          { status: 500 }
        );
      }

      const tokensObj = {
        di_token: freshTokens.oauth2.access_token,
        di_refresh_token: freshTokens.oauth2.refresh_token,
        di_client_id: 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
        oauth1: freshTokens.oauth1,
        oauth2: freshTokens.oauth2,
      };

      const { ok, error: saveErr } = await saveGarminTokens(tokensObj);
      if (!ok) {
        return Response.json(
          { success: false, error: `Failed to save tokens to database: ${saveErr}` },
          { status: 500 }
        );
      }

      // Clean up used session
      await supabase.from('garmin_login_sessions').delete().eq('session_id', sessionId).catch(() => {});

      return Response.json({
        success: true,
        message: 'Garmin MFA verified and fresh tokens stored in database!',
        expiresAt: freshTokens.oauth2.expires_at,
      });
    }

    // ── 3. Action: Direct Token JSON Save ────────────────────────────────────
    if (action === 'save_raw_tokens') {
      const { tokensJson } = body;
      if (!tokensJson) {
        return Response.json({ success: false, error: 'Token JSON is required' }, { status: 400 });
      }

      let parsed;
      try {
        parsed = typeof tokensJson === 'object' ? tokensJson : JSON.parse(tokensJson);
      } catch (e) {
        return Response.json({ success: false, error: 'Invalid JSON format: ' + e.message }, { status: 400 });
      }

      if (!parsed.di_token) {
        return Response.json(
          { success: false, error: 'JSON missing required "di_token" field' },
          { status: 400 }
        );
      }

      const { ok, error } = await saveGarminTokens(parsed);
      if (!ok) {
        return Response.json(
          { success: false, error: error || 'Failed to save tokens to database' },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        message: 'Garmin tokens updated in database successfully!',
        status: getTokenStatus(parsed),
      });
    }

    // ── 4. Action: Test Live Connection ──────────────────────────────────────
    if (action === 'test') {
      const tokens = await getGarminTokens();
      if (!tokens || !tokens.di_token) {
        return Response.json({ success: false, error: 'No tokens found in database. Please log in first.' }, { status: 400 });
      }

      try {
        const res = await fetch(
          'https://connectapi.garmin.com/userprofile-service/socialProfile',
          {
            headers: nativeHeaders({
              Authorization: `Bearer ${tokens.di_token}`,
              Accept: 'application/json',
            }),
          }
        );

        if (res.ok) {
          const profile = await res.json().catch(() => ({}));
          return Response.json({
            success: true,
            message: `Connection verified! Connected as ${profile.displayName || profile.userName || 'Runner'}`,
            profile: {
              displayName: profile.displayName,
              userName: profile.userName,
            },
          });
        } else {
          const text = await res.text().catch(() => '');
          return Response.json(
            {
              success: false,
              error: `Garmin API returned ${res.status}: ${text.slice(0, 200)}`,
            },
            { status: 400 }
          );
        }
      } catch (fetchErr) {
        return Response.json(
          { success: false, error: `Connection error: ${fetchErr.message}` },
          { status: 500 }
        );
      }
    }

    return Response.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[garmin-login POST]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
