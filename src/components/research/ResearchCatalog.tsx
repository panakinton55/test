"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { reports } from "@/data/reports";
import { isResearchCategory, researchAreas } from "@/data/taxonomy";
import { ReportList } from "@/components/research/ReportList";

export function ResearchCatalog() {
  return (
    <Suspense fallback={<ReportList reports={reports} />}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("category") ?? "all";
  const category = requested !== "all" && isResearchCategory(requested) ? requested : "all";
  const visible =
    category === "all" ? reports : reports.filter((report) => report.category === category);

  function select(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next === "all") query.delete("category");
    else query.set("category", next);
    const suffix = query.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div role="group" aria-label="カテゴリで絞り込む" className="flex flex-wrap gap-x-5 gap-y-3">
          <FilterButton active={category === "all"} onClick={() => select("all")}>
            All
          </FilterButton>
          {researchAreas.map((area) => (
            <FilterButton
              key={area.id}
              active={category === area.id}
              onClick={() => select(area.id)}
            >
              {area.name}
            </FilterButton>
          ))}
        </div>
        <p className="text-[13px] text-muted tabular-nums">
          {visible.length} {visible.length === 1 ? "report" : "reports"}
        </p>
      </div>
      <ReportList reports={visible} />
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-left text-[13px] tracking-[0.04em] transition-colors duration-150 ${
        active ? "text-navy underline decoration-navy/40 underline-offset-8" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
