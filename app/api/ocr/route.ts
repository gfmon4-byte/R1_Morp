import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { image, userApiKey } = await request.json();

    const apiKey = userApiKey || 
                   request.headers.get('Authorization')?.replace('Bearer ', '') ||
                   request.headers.get('x-gemini-key') ||
                   process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API Key is missing. Please enter it in the settings or add it to .env.local.' },
        { status: 400 }
      );
    }

    const prompt = `Analyze the uploaded running or fitness workout screenshot (e.g. Apple Watch, Garmin, Strava) and extract the following metrics.
Return a raw JSON object containing the fields. Do NOT put the JSON inside markdown code blocks (e.g. \`\`\`json ... \`\`\`). Return ONLY the JSON object.

Extract fields:
1. date: YYYY-MM-DD format. (Note: The current year is 2026. If the year is not visible but the day of week and date are given, infer the year 2026. For example, "Sun, 21 Jun" in 2026 is 2026-06-21).
2. session_type: Map to one of: "Easy Run", "Recovery Run", "Long Run", "Tempo", "Intervals", "Race", "Other". Default to "Easy Run" if it says "Outdoor Run" or "Run" and you are unsure.
3. distance_km: Distance in kilometers as a float number.
4. duration_hh: Hours of duration (integer).
5. duration_mm: Minutes of duration (integer).
6. duration_ss: Seconds of duration (integer).
7. avg_hr: Average Heart Rate in BPM (integer).
8. max_hr: Maximum Heart Rate in BPM (integer).
9. elevation_gain_m: Elevation gain in meters (integer).
10. rpe: Effort score (1 to 10). (e.g. "Effort: 9 All Out" maps to 9).
11. route_name: Location/route name (string, e.g. "Mueang Nakhon Ratchasima").
12. z1_minutes: Time in Zone 1 (in minutes, as a float).
13. z2_minutes: Time in Zone 2 (in minutes, as a float).
14. z3_minutes: Time in Zone 3 (in minutes, as a float).
15. z4_minutes: Time in Zone 4 (in minutes, as a float).
16. z5_minutes: Time in Zone 5 (in minutes, as a float).

Example output format:
{
  "date": "2026-06-21",
  "session_type": "Easy Run",
  "distance_km": 10.09,
  "duration_hh": 1,
  "duration_mm": 9,
  "duration_ss": 18,
  "avg_hr": 184,
  "max_hr": 199,
  "elevation_gain_m": 41,
  "rpe": 9,
  "route_name": "Mueang Nakhon Ratchasima District",
  "z1_minutes": 1.17,
  "z2_minutes": 1.67,
  "z3_minutes": 3.87,
  "z4_minutes": 9.17,
  "z5_minutes": 52.62
}

Return null for any fields that are not present or cannot be extracted.`;

    const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = image.split(',')[1] || image;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${errorText || response.statusText}` },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    const textResult = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      return NextResponse.json({ error: 'Failed to extract text from image.' }, { status: 500 });
    }

    let cleanedText = textResult.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanedText);
    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('OCR Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
