// Optional Claude API helper (set ANTHROPIC_API_KEY to enable).
export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function ask(prompt, { maxTokens = 4000 } = {}) {
  if (!aiAvailable()) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).map((c) => c.text || '').join('');
}

export function extractJson(text) {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  return JSON.parse(text.slice(start, end + 1));
}
