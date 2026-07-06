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

    const prompt = `Analyze the uploaded InBody body composition report image and extract the following metrics.
Return a raw JSON object containing the fields. Do NOT put the JSON inside markdown code blocks (e.g. \`\`\`json ... \`\`\`). Return ONLY the JSON object.

Extract fields:
1. date: YYYY-MM-DD format (derived from "Test Date / Time" or "Test Date", e.g. "01.01.2010 08:17" should be parsed as "2010-01-01").
2. weight: Weight in kg as a float number (e.g. 57.5). Look under "Body Composition Analysis" or "Muscle-Fat Analysis".
3. smm: Skeletal Muscle Mass in kg as a float number (e.g. 21.3). Look under "Muscle-Fat Analysis" (SMM).
4. bfm: Body Fat Mass in kg as a float number (e.g. 18.3). Look under "Body Composition Analysis" or "Muscle-Fat Analysis" (Body Fat Mass).
5. tbw: Total Body Water in L as a float number (e.g. 28.7). Look under "Body Composition Analysis" (Total Body Water).
6. protein: Protein in kg as a float number (e.g. 7.7). Look under "Body Composition Analysis" (Protein).
7. mineral: Mineral in kg as a float number (e.g. 2.77). Look under "Body Composition Analysis" (Mineral).

Example output format:
{
  "date": "2010-01-01",
  "weight": 57.5,
  "smm": 21.3,
  "bfm": 18.3,
  "tbw": 28.7,
  "protein": 7.7,
  "mineral": 2.77
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
    console.error('InBody OCR Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
