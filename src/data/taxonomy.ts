export const researchAreas = [
  {
    id: "market-intelligence",
    index: "01",
    name: "Market Intelligence",
    nameJa: "市場",
    summary: "市場の境界、成長の質、プレイヤーが分かれる構造を読み解く。",
  },
  {
    id: "competitive-intelligence",
    index: "02",
    name: "Competitive Intelligence",
    nameJa: "競合",
    summary: "企業、製品、事業モデルの違いと、差が残る箇所を並べる。",
  },
  {
    id: "technology-research",
    index: "03",
    name: "Technology Research",
    nameJa: "技術",
    summary: "新興技術が、何を可能にし、何をまだ制約しているかを見る。",
  },
  {
    id: "industry-analysis",
    index: "04",
    name: "Industry Analysis",
    nameJa: "産業",
    summary: "産業の層、取引の単位、置き換わりと共存の条件を整理する。",
  },
] as const;

export type ResearchCategory = (typeof researchAreas)[number]["id"];

export function getArea(id: ResearchCategory) {
  const area = researchAreas.find((item) => item.id === id);
  if (!area) {
    throw new Error(`Unknown research category: ${id}`);
  }
  return area;
}

export function isResearchCategory(value: string): value is ResearchCategory {
  return researchAreas.some((item) => item.id === value);
}
