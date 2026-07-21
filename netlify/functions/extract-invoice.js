// Receives a base64-encoded vendor bill (PDF or image) and returns
// structured fields extracted by Gemini. Nothing is written to disk —
// the file exists only in this function's memory for the request.

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY_LOCAL || process.env.GEMINI_API_KEY || '').trim();

const EXTRACTION_PROMPT = `You are reading an Indian GST vendor tax invoice (may be a multi-page PDF where later pages are an e-Way bill — ignore those, use only the tax invoice page).

Extract the data and respond with STRICT JSON only — no markdown fences, no commentary, matching exactly this shape:

{
  "vendor_name": "",
  "vendor_gstin": "",
  "invoice_number": "",
  "invoice_date": "YYYY-MM-DD",
  "line_items": [
    { "description": "", "hsn_sac": "", "quantity": 0, "unit": "", "rate": 0, "amount": 0 }
  ],
  "cgst_percent": 0,
  "cgst_amount": 0,
  "sgst_percent": 0,
  "sgst_amount": 0,
  "round_off": 0,
  "total": 0
}

Rules:
- Dates must be converted to YYYY-MM-DD.
- If CGST/SGST are not both present (e.g. it's IGST instead), still fill cgst/sgst fields with 0 and add an "igst_percent" and "igst_amount" field.
- Numbers must be plain numbers, no currency symbols or commas.
- If a field truly cannot be found, use an empty string ("") or 0, never omit the key.`;

exports.handler = async (event, context) => {
  // Require a logged-in RFLABS Identity user before doing anything else.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `GEMINI_API_KEY not configured (length seen: ${GEMINI_API_KEY.length})` }),
    };
  }

  try {
    const { fileBase64, mimeType } = JSON.parse(event.body);
    if (!fileBase64 || !mimeType) {
      return { statusCode: 400, body: JSON.stringify({ error: 'fileBase64 and mimeType are required' }) };
    }

    const geminiUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent' +
      `?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: mimeType, data: fileBase64 } },
            ],
          },
        ],
      }),
    });

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'Gemini did not return usable content',
          detail: geminiJson,
          keyLengthSeen: GEMINI_API_KEY.length,
        }),
      };
    }

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const extracted = JSON.parse(cleaned);

    return {
      statusCode: 200,
      body: JSON.stringify({ extracted }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
