export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { POST as garminLoginPOST, GET as garminLoginGET } from '@/app/api/garmin-login/route';

export async function GET(request) {
  return garminLoginGET(request);
}

export async function POST(request) {
  return garminLoginPOST(request);
}
