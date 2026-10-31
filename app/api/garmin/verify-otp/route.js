export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { POST as garminLoginPOST } from '@/app/api/garmin-login/route';

export async function POST(request) {
  return garminLoginPOST(request);
}
