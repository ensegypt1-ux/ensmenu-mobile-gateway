/**
 * n8n Code node — paste entire file into "Code in JavaScript" after AI Agent.
 *
 * Input: AI Agent node output on $json
 * Output: { success: true, categories: [...] } or { success: false, error, raw }
 *
 * Webhook must respond with Respond to Webhook → JSON (this object), not plain text.
 */

function stripMarkdownFences(text) {
  return String(text)
    .replace(/^\s*```(?:json|JSON)?\s*/gm, '')
    .replace(/\s*```\s*$/gm, '')
    .replace(/```/g, '')
    .trim();
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Parse raw / escaped / fenced / embedded JSON (up to 3 decode passes). */
function parseLooseJson(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object') return input;

  let text = stripMarkdownFences(String(input)).trim();
  if (!text) return null;

  let parsed;
  for (let depth = 0; depth < 3; depth++) {
    parsed = tryParseJson(text);
    if (parsed === undefined) break;
    if (typeof parsed === 'string') {
      text = stripMarkdownFences(parsed).trim();
      continue;
    }
    return parsed;
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    parsed = tryParseJson(objectMatch[0]);
    if (parsed !== undefined) return parsed;
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    parsed = tryParseJson(arrayMatch[0]);
    if (parsed !== undefined) return parsed;
  }

  return null;
}

/** Read AI Agent output from common n8n / OpenAI field shapes. */
function readAgentOutput(json) {
  if (!json || typeof json !== 'object') return { text: '', object: null };

  // Already parsed menu object on output
  if (json.output && typeof json.output === 'object' && !Array.isArray(json.output)) {
    const out = json.output;
    if (Array.isArray(out.categories) || Array.isArray(out.sections) || Array.isArray(out.items)) {
      return { text: '', object: out };
    }
  }

  // Plain string on output (most common misconfiguration)
  if (typeof json.output === 'string' && json.output.trim()) {
    return { text: json.output, object: null };
  }

  // n8n AI Agent: output[0].content[0].text
  if (Array.isArray(json.output)) {
    const chunks = [];
    for (const item of json.output) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.text === 'string' && item.text.trim()) {
        chunks.push(item.text);
      }
      if (Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block && typeof block.text === 'string' && block.text.trim()) {
            chunks.push(block.text);
          }
        }
      }
      if (typeof item.output === 'string' && item.output.trim()) {
        chunks.push(item.output);
      }
    }
    if (chunks.length) return { text: chunks.join('\n'), object: null };
  }

  for (const key of ['text', 'response', 'message', 'result', 'answer']) {
    const val = json[key];
    if (typeof val === 'string' && val.trim()) return { text: val, object: null };
    if (val && typeof val === 'object') return { text: '', object: val };
  }

  if (Array.isArray(json.categories) || Array.isArray(json.sections) || Array.isArray(json.items)) {
    return { text: '', object: json };
  }

  return { text: '', object: null };
}

function hasMenuShape(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    Array.isArray(value.categories) ||
    Array.isArray(value.sections) ||
    Array.isArray(value.items)
  );
}

function unwrapMenuPayload(parsed) {
  if (parsed === null || parsed === undefined) return null;

  if (typeof parsed === 'string') {
    return unwrapMenuPayload(parseLooseJson(parsed));
  }

  if (hasMenuShape(parsed)) return parsed;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const inner = unwrapMenuPayload(item);
      if (inner) return inner;
    }
    return null;
  }

  if (typeof parsed !== 'object') return null;

  if (parsed.success === true && Array.isArray(parsed.categories)) {
    return parsed;
  }

  for (const key of ['menu', 'data', 'text', 'output', 'result']) {
    if (parsed[key] !== undefined) {
      const inner = unwrapMenuPayload(parsed[key]);
      if (inner) return inner;
    }
  }

  return null;
}

function toSuccessShape(payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.success === true && Array.isArray(payload.categories)) {
    return {
      success: true,
      categories: payload.categories,
    };
  }

  const unwrapped = unwrapMenuPayload(payload);
  if (!unwrapped) return null;

  if (unwrapped.success === true && Array.isArray(unwrapped.categories)) {
    return {
      success: true,
      categories: unwrapped.categories,
    };
  }

  const categories = unwrapped.categories || unwrapped.sections;
  if (Array.isArray(categories)) {
    return { success: true, categories };
  }

  if (Array.isArray(unwrapped.items)) {
    return {
      success: true,
      categories: [
        {
          nameAr: 'غير مصنف',
          nameEn: 'Uncategorized',
          items: unwrapped.items,
        },
      ],
    };
  }

  return null;
}

// ─── Main (n8n Code node entry) ───────────────────────────────────────────

const { text: agentText, object: agentObject } = readAgentOutput($json);

let originalOutput;
if (agentObject) {
  originalOutput = agentObject;
} else {
  originalOutput = agentText || JSON.stringify($json.output ?? $json);
}

const parsed = typeof originalOutput === 'object'
  ? originalOutput
  : parseLooseJson(originalOutput);

const menu = toSuccessShape(parsed);

if (!menu) {
  return [
    {
      json: {
        success: false,
        error: 'INVALID_JSON',
        raw: typeof originalOutput === 'string'
          ? originalOutput
          : JSON.stringify(originalOutput),
      },
    },
  ];
}

return [{ json: menu }];
