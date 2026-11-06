import { dispatchSchema, type DispatchBody } from '../guard/schema.js';
import { enforceGuardrails } from '../guard/sanitize.js';

export type GuardFailure =
  | { ok: false; code: 'payload_invalid'; issues: { path: string; code: string }[] }
  | { ok: false; code: 'guardrail_blocked'; rule: string };

export function guardPayload(rawBody: string): { ok: true; body: DispatchBody } | GuardFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, code: 'payload_invalid', issues: [{ path: '', code: 'invalid_json' }] };
  }
  const result = dispatchSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      code: 'payload_invalid',
      issues: result.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path.map((part) => String(part)).join('.'),
        code: issue.code,
      })),
    };
  }
  const guarded = enforceGuardrails({
    prompt: result.data.prompt,
    parameters: result.data.parameters,
  });
  if (!guarded.ok) return { ok: false, code: 'guardrail_blocked', rule: guarded.rule };
  return { ok: true, body: result.data };
}
