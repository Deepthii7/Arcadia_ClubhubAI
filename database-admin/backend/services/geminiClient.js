const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function generateJsonContent({
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 4500,
  prompt,
  responseSchema,
}) {
  if (!apiKey || typeof fetchImpl !== "function") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });

    if (!response.ok) return null;
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((part) => typeof part === "string")
      .join("");
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateJsonContent };
