/**

 * Extracts structured menu JSON from n8n webhook responses.

 * Handles Code node output: { success: true, categories: [...] }

 * and legacy AI Agent raw text / double-encoded JSON.

 */



export type N8nMenuImportPayload =

  | { success: true; categories: unknown[] }

  | { success: false; error: string; raw?: string };



export function isN8nImportFailure(

  value: unknown,

): value is { success: false; error: string; raw?: string } {

  return (

    !!value &&

    typeof value === 'object' &&

    (value as { success?: boolean }).success === false &&

    typeof (value as { error?: unknown }).error === 'string'

  );

}



export function extractJsonFromN8n(raw: string): unknown | null {

  const trimmed = raw.trim();

  if (!trimmed) return null;



  const direct = parseLooseJson(trimmed);

  if (direct !== undefined) {

    if (isN8nImportFailure(direct)) return null;



    const fromSuccess = unwrapSuccessShape(direct);

    if (fromSuccess !== null) return fromSuccess;



    const unwrapped = unwrapMenuPayload(direct);

    if (unwrapped !== null) return unwrapped;

  }



  const fenced = stripMarkdownFences(trimmed);

  if (fenced !== trimmed) {

    const fromFenced = parseLooseJson(fenced);

    if (fromFenced !== undefined) {

      if (isN8nImportFailure(fromFenced)) return null;

      const fromSuccess = unwrapSuccessShape(fromFenced);

      if (fromSuccess !== null) return fromSuccess;

      const unwrapped = unwrapMenuPayload(fromFenced);

      if (unwrapped !== null) return unwrapped;

    }

  }



  const objectMatch = trimmed.match(/\{[\s\S]*\}/);

  if (objectMatch) {

    const nested = parseLooseJson(objectMatch[0]);

    if (nested !== undefined) {

      if (isN8nImportFailure(nested)) return null;

      const fromSuccess = unwrapSuccessShape(nested);

      if (fromSuccess !== null) return fromSuccess;

      const unwrapped = unwrapMenuPayload(nested);

      if (unwrapped !== null) return unwrapped;

    }

  }



  return null;

}



function stripMarkdownFences(text: string): string {

  return text

    .replace(/^\s*```(?:json|JSON)?\s*/gm, '')

    .replace(/\s*```\s*$/gm, '')

    .replace(/```/g, '')

    .trim();

}



function tryParseJson(value: string): unknown | undefined {

  try {

    return JSON.parse(value) as unknown;

  } catch {

    return undefined;

  }

}



/** JSON.parse up to 3 times for double/triple-encoded strings. */

function parseLooseJson(value: string): unknown | undefined {

  let text = stripMarkdownFences(value).trim();

  if (!text) return undefined;



  let parsed: unknown;

  for (let depth = 0; depth < 3; depth++) {

    parsed = tryParseJson(text);

    if (parsed === undefined) break;

    if (typeof parsed === 'string') {

      text = stripMarkdownFences(parsed).trim();

      continue;

    }

    return parsed;

  }



  return undefined;

}



function unwrapSuccessShape(parsed: unknown): unknown | null {

  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;



  if (record.success === true && Array.isArray(record.categories)) {

    return { categories: record.categories };

  }



  return null;

}



function unwrapMenuPayload(parsed: unknown): unknown | null {

  if (parsed === null || parsed === undefined) return null;



  if (typeof parsed === 'string') {

    const inner = parseLooseJson(parsed);

    if (inner !== undefined) return unwrapMenuPayload(inner);

    return null;

  }



  if (hasMenuShape(parsed)) return parsed;



  if (Array.isArray(parsed)) {

    for (const item of parsed) {

      const inner = unwrapMenuPayload(item);

      if (inner !== null) return inner;

    }

    return null;

  }



  if (typeof parsed !== 'object') return null;



  const record = parsed as Record<string, unknown>;



  if (typeof record.text === 'string') {

    const fromText = parseLooseJson(record.text.trim());

    if (fromText !== undefined) {

      const inner = unwrapMenuPayload(fromText);

      if (inner !== null) return inner;

    }

  }



  if (typeof record.output === 'string') {

    const fromOutput = parseLooseJson(record.output.trim());

    if (fromOutput !== undefined) {

      const inner = unwrapMenuPayload(fromOutput);

      if (inner !== null) return inner;

    }

  }



  const output = record.output;

  if (Array.isArray(output)) {

    for (const item of output) {

      if (!item || typeof item !== 'object') continue;

      const content = (item as { content?: unknown }).content;

      if (!Array.isArray(content)) continue;

      for (const block of content) {

        if (!block || typeof block !== 'object') continue;

        const text = (block as { text?: unknown }).text;

        if (typeof text !== 'string') continue;

        const fromBlock = parseLooseJson(text.trim());

        if (fromBlock !== undefined) {

          const inner = unwrapMenuPayload(fromBlock);

          if (inner !== null) return inner;

        }

      }

    }

  }



  if (record.data && typeof record.data === 'object') {

    const inner = unwrapMenuPayload(record.data);

    if (inner !== null) return inner;

  }



  if (record.menu && typeof record.menu === 'object') {

    const inner = unwrapMenuPayload(record.menu);

    if (inner !== null) return inner;

  }



  return null;

}



function hasMenuShape(value: unknown): boolean {

  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;

  return (

    Array.isArray(record.categories) ||

    Array.isArray(record.sections) ||

    Array.isArray(record.items)

  );

}


