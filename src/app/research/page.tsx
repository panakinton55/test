import type { Metadata } from "next";
import { ResearchCatalog } from "@/components/research/ResearchCatalog";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Research",
  description:
    "市場、競合、技術、産業の調査レポート一覧。AI Research Studio が公開情報をもとに構造を整理したレポートを掲載しています。",
  alternates: { canonical: "/research" },
};

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        eyebrow="Index"
        title="Research"
        titleJa="調査レポート"
        lede="市場、競合、技術、産業。それぞれについて、境界と構造を先に固定したレポートを掲載しています。価格を置いていないものは、範囲を決めたうえで個別にお見積りします。"
      />
      <Container className="py-14 md:py-20">
        <ResearchCatalog />
      </Container>
    </>
  );
}
