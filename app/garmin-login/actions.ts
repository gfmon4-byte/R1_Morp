'use server';

import {
  loginGarmin,
  verifyGarminMfa,
  testGarminConnection,
  getGarminTokenStatus,
  type AuthResult,
} from '@/lib/garminAuth';
import type { TokenStatus } from '@/lib/garminTokens';

/**
 * Server Action: Get token status from Supabase DB
 */
export async function getStatusAction(): Promise<TokenStatus> {
  return getGarminTokenStatus();
}

/**
 * Server Action: Log in with Garmin credentials
 */
export async function loginAction(email: string, password: string): Promise<AuthResult> {
  return loginGarmin(email, password);
}

/**
 * Server Action: Verify 6-digit MFA code
 */
export async function verifyMfaAction(sessionId: string, code: string): Promise<AuthResult> {
  return verifyGarminMfa(sessionId, code);
}

/**
 * Server Action: Test live connection to Garmin Connect
 */
export async function testConnectionAction(): Promise<AuthResult> {
  return testGarminConnection();
}

