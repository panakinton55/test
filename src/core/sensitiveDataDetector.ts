import type { CustomDetectorRule, Finding, SensitiveCategory } from "../domain.js";
import { isUnsafeRegex } from "../utils/regexSafety.js";

const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

const ADDRESS_PATTERN = new RegExp(`(?:〒\\d{3}-?\\d{4}|(?:${PREFECTURES.join("|")})[^\\n]{0,40}?[市区町村郡])`, "g");

export function detectSensitiveData(input: string, customRules: CustomDetectorRule[] = []): Finding[] {
  const text = input.normalize("NFKC");
  const found: Finding[] = [];
  collect(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email", found);
  collect(
    text,
    /(?:\+81[-\s]?(?:70|80|90)[-\s]?\d{4}[-\s]?\d{4}|0(?:70|80|90)[-\s]?\d{4}[-\s]?\d{4}|0\d{1,4}[-\s]\d{1,4}[-\s]\d{3,4})/g,
    "phone_number",
    found,
  );
  collectCreditCards(text, found);
  collect(text, /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "jwt", found);
  collect(text, /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}={0,2}/gi, "bearer_token", found);
  collect(text, /\bask_[A-Za-z0-9_-]{20,}\b/g, "bearer_token", found);
  collect(text, /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "aws_access_key", found);
  collect(text, /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g, "private_key", found);
  collect(text, ADDRESS_PATTERN, "address", found);
  collectMyNumbers(text, found);
  collectCustom(text, customRules, found);
  return resolveOverlaps(found);
}

export function isValidMyNumber(digits: string): boolean {
  if (!/^\d{12}$/.test(digits)) return false;
  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let index = 0; index < 11; index += 1) {
    sum += Number(digits.charAt(index)) * (weights[index] ?? 0);
  }
  const mod = sum % 11;
  const expected = mod <= 1 ? 0 : 11 - mod;
  return Number(digits.charAt(11)) === expected;
}

function collect(text: string, expression: RegExp, category: SensitiveCategory, found: Finding[], ruleId?: string): void {
  expression.lastIndex = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index === undefined || match[0].length === 0) continue;
    found.push({
      category,
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      ...(ruleId ? { ruleId } : {}),
    });
  }
}

function collectCreditCards(text: string, found: Finding[]): void {
  const expression = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;
  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) continue;
    const raw = match[0];
    const digits = raw.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) continue;
    found.push({ category: "credit_card", start: match.index, end: match.index + raw.length, value: raw });
  }
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let current = digits.charCodeAt(index) - 48;
    if (current < 0 || current > 9) return false;
    if (alternate) {
      current *= 2;
      if (current > 9) current -= 9;
    }
    sum += current;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function collectMyNumbers(text: string, found: Finding[]): void {
  collect(text, /(?:マイナンバー|個人番号)\s*[:：]?\s*(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d{9,12})/g, "my_number", found);
  const standalone = /(?<!\d)(\d{12})(?!\d)/g;
  for (const match of text.matchAll(standalone)) {
    const digits = match[1];
    if (!digits || !isValidMyNumber(digits) || match.index === undefined) continue;
    found.push({ category: "my_number", start: match.index, end: match.index + digits.length, value: digits });
  }
  const grouped = /(?<!\d)(\d{4})[-\s](\d{4})[-\s](\d{4})(?!\d)/g;
  for (const match of text.matchAll(grouped)) {
    const digits = `${match[1] ?? ""}${match[2] ?? ""}${match[3] ?? ""}`;
    if (!isValidMyNumber(digits) || match.index === undefined) continue;
    found.push({ category: "my_number", start: match.index, end: match.index + match[0].length, value: match[0] });
  }
}

function collectCustom(text: string, rules: CustomDetectorRule[], found: Finding[]): void {
  for (const rule of rules) {
    if (rule.keyword) {
      const haystack = text.toLowerCase();
      const needle = rule.keyword.normalize("NFKC").toLowerCase();
      if (!needle) continue;
      let from = 0;
      while (from < haystack.length) {
        const index = haystack.indexOf(needle, from);
        if (index < 0) break;
        found.push({
          category: "custom",
          start: index,
          end: index + needle.length,
          value: text.slice(index, index + needle.length),
          ruleId: rule.ruleId,
        });
        from = index + needle.length;
      }
    }
    if (!rule.pattern || isUnsafeRegex(rule.pattern)) continue;
    try {
      collect(text, new RegExp(rule.pattern, "g"), "custom", found, rule.ruleId);
    } catch {
      // Invalid patterns are rejected when a policy is saved. Ignore them here.
    }
  }
}

function resolveOverlaps(found: Finding[]): Finding[] {
  const sorted = [...found].sort((left, right) => left.start - right.start || right.end - left.end || rank(right) - rank(left));
  const chosen: Finding[] = [];
  let cursor = 0;
  for (const item of sorted) {
    if (item.start < cursor) continue;
    chosen.push(item);
    cursor = item.end;
  }
  return chosen;
}

function rank(finding: Finding): number {
  if (finding.category === "private_key" || finding.category === "credit_card" || finding.category === "jwt") return 3;
  if (finding.category === "aws_access_key" || finding.category === "bearer_token" || finding.category === "my_number") return 2;
  return 1;
}
