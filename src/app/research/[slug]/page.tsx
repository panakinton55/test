import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReportDetail } from "@/components/research/ReportDetail";
import { getReport, reports } from "@/data/reports";

export function generateStaticParams() {
  return reports.map((report) => ({ slug: report.slug }));
}

export async function generateMetadata(
  props: PageProps<"/research/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const report = getReport(slug);
  if (!report) {
    return { title: "Research" };
  }
  return {
    title: report.title,
    description: report.summary,
    alternates: { canonical: `/research/${report.slug}` },
    openGraph: {
      title: report.title,
      description: report.summary,
    },
  };
}

export default function Page(props: PageProps<"/research/[slug]">) {
  return (
    <Suspense fallback={<p className="px-6 py-24 text-sm text-muted">読み込んでいます。</p>}>
      <Detail params={props.params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();
  return <ReportDetail report={report} />;
}
