export function isUnsafeRegex(pattern: string): boolean {
  if (pattern.length === 0 || pattern.length > 128) return true;
  if (/(\*|\+|\{)\s*(\*|\+|\{)/.test(pattern)) return true;
  try {
    const expression = new RegExp(pattern);
    if (expression.test("")) return true;
  } catch {
    return true;
  }
  return false;
}
