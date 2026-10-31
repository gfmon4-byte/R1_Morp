export const dynamic = 'force-dynamic';
export const revalidate = 0;

import {
  getGarminTokenStatus,
  loginGarmin,
  verifyGarminMfa,
  testGarminConnection,
} from '@/lib/garminAuth';
import { saveGarminTokens, getTokenStatus } from '@/lib/garminTokens';

/**
 * GET: Returns current token health and metadata from Supabase DB
 */
export async function GET() {
  try {
    const status = await getGarminTokenStatus();
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

    if (action === 'login') {
      const res = await loginGarmin(body.email, body.password);
      const statusCode = res.success ? 200 : res.error?.includes('429') ? 429 : 401;
      return Response.json(res, { status: statusCode });
    }

    if (action === 'mfa' || body.otp_code || body.code) {
      const sessionId = body.session_id || body.mfaState;
      const code = body.code || body.otp_code;
      const res = await verifyGarminMfa(sessionId, code);
      const statusCode = res.success ? 200 : 400;
      return Response.json(res, { status: statusCode });
    }

    if (action === 'test') {
      const res = await testGarminConnection();
      const statusCode = res.success ? 200 : 400;
      return Response.json(res, { status: statusCode });
    }

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

    return Response.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[garmin-login POST]', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
