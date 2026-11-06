export type GuardInput = {
  prompt: string;
  parameters: Record<string, string | number | boolean>;
};

export type GuardResult = { ok: true } | { ok: false; rule: string };

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const BIDI_CHARS = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\uFEFF]/;
const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const AWS_ACCESS_KEY = /\bAKIA[0-9A-Z]{16}\b/;
const API_TOKEN = /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/;
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}={0,2}\b/;
const CONNECTION_STRING = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s/]+:[^\s@]+@/i;
const CREDENTIAL_ASSIGNMENT = /\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*\S+/i;
const PROMPT_OVERRIDE = /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i;
const DISREGARD_PROMPT = /disregard\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message)/i;
const REVEAL_PROMPT = /reveal\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions|chain\s+of\s+thought)/i;
const SCRIPT = /<\s*\/?\s*script\b|javascript\s*:/i;
const SQL = /\b(?:union\s+select|drop\s+table|delete\s+from|insert\s+into)\b|\bor\s+1\s*=\s*1\b/i;
const SHELL = /(?:^|[\n\r;&|`])\s*(?:rm|curl|wget|bash|sh|nc|powershell)\b/i;
const TEMPLATE = /\{\{[\s\S]+?\}\}|\$\{[\s\S]+?\}/;

function luhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) return false;
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum > 0 && sum % 10 === 0;
}

function hasPaymentCard(value: string): boolean {
  const matches = value.match(/\b\d(?:[ -]?\d){12,18}\b/g);
  if (!matches) return false;
  return matches.some((match) => {
    const digits = match.replace(/[ -]/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhn(digits);
  });
}

function ruleForText(value: string, allowNewlines: boolean): string | null {
  if (!allowNewlines && /[\r\n]/.test(value)) return 'unsafe.parameter_newline';
  if (value.normalize('NFC') !== value) return 'unsafe.normalization';
  if (CONTROL_CHARS.test(value)) return 'unsafe.control_char';
  if (BIDI_CHARS.test(value)) return 'unsafe.bidi';
  if (PRIVATE_KEY.test(value)) return 'secret.private_key';
  if (AWS_ACCESS_KEY.test(value)) return 'secret.aws_access_key';
  if (API_TOKEN.test(value)) return 'secret.api_token';
  if (BEARER.test(value)) return 'secret.bearer';
  if (CONNECTION_STRING.test(value)) return 'secret.connection_string';
  if (CREDENTIAL_ASSIGNMENT.test(value)) return 'secret.credential_assignment';
  if (hasPaymentCard(value)) return 'secret.payment_card';
  if (PROMPT_OVERRIDE.test(value) || DISREGARD_PROMPT.test(value) || REVEAL_PROMPT.test(value)) {
    return 'injection.prompt_override';
  }
  if (SCRIPT.test(value)) return 'injection.script';
  if (SQL.test(value)) return 'injection.sql';
  if (SHELL.test(value)) return 'injection.shell';
  if (TEMPLATE.test(value)) return 'injection.template';
  return null;
}

export function enforceGuardrails(input: GuardInput): GuardResult {
  const promptRule = ruleForText(input.prompt, true);
  if (promptRule) return { ok: false, rule: promptRule };
  for (const [key, value] of Object.entries(input.parameters)) {
    const keyRule = ruleForText(key, false);
    if (keyRule) return { ok: false, rule: keyRule };
    if (typeof value === 'string') {
      const valueRule = ruleForText(value, false);
      if (valueRule) return { ok: false, rule: valueRule };
    }
  }
  return { ok: true };
}
