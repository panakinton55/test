export const site = {
  name: "AI Research Studio",
  imprint: "AI RESEARCH STUDIO",
  tagline: "Research. Analyze. Decide.",
  concept: "Turning complex market intelligence into clear business decisions.",
  descriptionEn:
    "Independent research on markets, companies and emerging technologies.",
  descriptionJa:
    "市場・競合・テクノロジーを分析し、より良いビジネス意思決定を支援する。",
  summary:
    "AI Research Studio は、市場・企業・テクノロジーに関する複雑な情報を調査・分析し、企業やビジネスパーソンの意思決定を支援する独立系リサーチスタジオです。",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "ja_JP",
  year: 2026,
} as const;

export const navigation = [
  { href: "/research", label: "Research", labelJa: "調査" },
  { href: "/services", label: "Services", labelJa: "サービス" },
  { href: "/about", label: "About", labelJa: "考え方" },
  { href: "/contact", label: "Contact", labelJa: "問い合わせ" },
] as const;

export type NavHref = (typeof navigation)[number]["href"];
