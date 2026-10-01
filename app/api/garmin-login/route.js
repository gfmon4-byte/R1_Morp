import { spawn } from 'child_process';
import path from 'path';
import { getGarminTokens, saveGarminTokens, getTokenStatus } from '@/lib/garminTokens';

const ROOT_DIR = process.cwd();

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

/** Helper to run the stateless python auth script */
async function runPythonAuth(payload) {
  return new Promise((resolve) => {
    let resolved = false;
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

    let child;
    try {
      child = spawn(pythonBin, ['scripts/garmin_web_auth.py'], {
        cwd: ROOT_DIR,
        env: process.env,
      });
    } catch (err) {
      return resolve({
        code: 1,
        data: {
          status: 'error',
          message: `Cannot start Python (${err.message}). Vercel Serverless environment only runs Node.js. Please run 'python scripts/login_garmin.py' on your computer to save tokens to database.`,
        },
      });
    }

    let stdout = '';
    let stderr = '';

    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      resolve({
        code: 1,
        data: {
          status: 'error',
          message: `Python is not available on this server (${err.message}). Vercel Serverless environment only runs Node.js. Please run 'python scripts/login_garmin.py' on your computer to save tokens directly to database.`,
        },
      });
    });

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({ code, data: parsed });
      } catch {
        resolve({
          code,
          data: {
            status: 'error',
            message: stdout.trim() || stderr.trim() || `Process exited with code ${code}`,
          },
        });
      }
    });

    try {
      child.stdin.write(JSON.stringify(payload) + '\n');
      child.stdin.end();
    } catch (writeErr) {
      if (!resolved) {
        resolved = true;
        resolve({
          code: 1,
          data: { status: 'error', message: `Stdin write error: ${writeErr.message}` },
        });
      }
    }
  });
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
    const action = body.action || 'login';

    // ── 1. Action: Direct Login with Email & Password ────────────────────────
    if (action === 'login') {
      const { email, password } = body;
      if (!email || !password) {
        return Response.json(
          { success: false, error: 'Email and password are required' },
          { status: 400 }
        );
      }

      const res = await runPythonAuth({ action: 'login', email, password });
      if (res.data?.status === 'needs_mfa') {
        return Response.json({
          success: true,
          needsMfa: true,
          needs_mfa: true,
          mfaState: res.data.mfa_state,
          session_id: res.data.mfa_state,
          message: res.data.message || 'Garmin 2FA verification required.',
        });
      }

      if (res.data?.status === 'success') {
        return Response.json({
          success: true,
          needsMfa: false,
          needs_mfa: false,
          message: res.data.message || 'Logged in successfully! Tokens stored to database.',
          displayName: res.data.display_name,
          expiresAt: res.data.expires_at,
        });
      }

      return Response.json({
        success: false,
        error: res.data?.message || 'Authentication failed. Please check your credentials.',
      }, { status: 400 });
    }

    // ── 2. Action: Verify 6-digit MFA Code ───────────────────────────────────
    if (action === 'mfa' || body.otp_code) {
      const mfaState = body.mfaState || body.session_id;
      const code = body.code || body.otp_code;
      if (!code || !mfaState) {
        return Response.json(
          { success: false, error: 'MFA state and 6-digit verification code are required' },
          { status: 400 }
        );
      }

      const res = await runPythonAuth({ action: 'mfa', mfa_state: mfaState, code: String(code).trim() });
      if (res.data?.status === 'success') {
        return Response.json({
          success: true,
          message: res.data.message || 'MFA verified and tokens stored to database!',
          displayName: res.data.display_name,
          expiresAt: res.data.expires_at,
        });
      }

      return Response.json({
        success: false,
        error: res.data?.message || 'MFA verification failed. Please try again.',
      }, { status: 400 });
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
