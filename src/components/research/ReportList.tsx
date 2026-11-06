import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCategoryLabel, type Report } from "@/data/reports";
import { formatDate } from "@/lib/format";
import { Price } from "@/components/research/Price";
import { ReportMark } from "@/components/research/ReportFigure";

export function ReportList({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <p className="border-y border-line py-16 text-center text-ink-soft">
        このカテゴリのレポートは、まだ掲載していません。
      </p>
    );
  }

  return (
    <ul className="border-t border-line">
      {reports.map((report) => (
        <li key={report.slug} className="border-b border-line">
          <Link
            href={`/research/${report.slug}`}
            className="group grid gap-5 py-7 transition-colors duration-150 hover:bg-paper-2 md:grid-cols-[7.5rem_1fr_11rem] md:items-start md:gap-8 md:px-3"
          >
            <div className="h-20 w-full border border-line md:h-24">
              <ReportMark kind={report.figure} />
            </div>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.16em] text-navy uppercase">
                <span>{getCategoryLabel(report.category)}</span>
                <time dateTime={report.publishedAt} className="tracking-normal text-muted normal-case">
                  {formatDate(report.publishedAt)}
                </time>
              </span>
              <span className="mt-2 block font-serif text-[1.65rem] leading-tight tracking-[-0.02em] text-ink">
                {report.title}
              </span>
              <span className="font-mincho mt-1 block text-[15px] text-ink-soft">{report.titleJa}</span>
              <span className="mt-3 block max-w-2xl text-[14.5px] leading-[1.85] text-ink-soft">
                {report.summary}
              </span>
            </span>
            <span className="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-between md:self-stretch">
              <span className="text-sm text-ink">
                <Price amount={report.priceJpy} />
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] tracking-[0.14em] text-navy uppercase">
                Detail
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                  strokeWidth={1.5}
                />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
