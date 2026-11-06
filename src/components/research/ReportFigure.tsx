import type { FigureKind } from "@/data/reports";

const disclaimer =
  "この図は構成の見取り図であり、実測値や順位を示すものではありません。";

export function ReportFigure({
  kind,
  label,
  caption,
  compact = false,
}: {
  kind: FigureKind;
  label: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <figure>
      <div className={compact ? "" : "border border-line bg-paper-2 px-5 py-6 md:px-8 md:py-8"}>
        <p className="text-[10px] tracking-[0.22em] text-muted uppercase">{label}</p>
        <div className="mt-5 text-ink">
          <Figure kind={kind} />
        </div>
      </div>
      {compact ? null : (
        <figcaption className="mt-3 text-[12.5px] leading-relaxed text-muted">
          {caption}
          {caption.endsWith("。") ? "" : "。"}
          {disclaimer}
        </figcaption>
      )}
    </figure>
  );
}

function Figure({ kind }: { kind: FigureKind }) {
  if (kind === "cnapp") return <CnappStructure />;
  if (kind === "competitive") return <CompetitiveAxes />;
  if (kind === "adoption") return <AdoptionConditions />;
  return <IndustryLayers />;
}

function CnappStructure() {
  const layers = [
    ["CSPM", "設定とポスチャ"],
    ["CWPP", "ワークロード"],
    ["CIEM", "権限とアイデンティティ"],
    ["Code to Cloud", "開発から実行環境まで"],
  ];

  return (
    <div className="border border-navy/80 bg-white p-4 md:p-5" aria-hidden="true">
      <p className="text-[11px] tracking-[0.18em] text-navy uppercase">CNAPP</p>
      <p className="font-mincho mt-1 text-sm text-ink-soft">一つの購買単位に束ねられる保護領域</p>
      <ul className="mt-4 grid gap-2">
        {layers.map(([name, note]) => (
          <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border border-line px-3 py-3">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-[12px] leading-relaxed text-muted">{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompetitiveAxes() {
  const cells = [
    ["単一領域 × ポイント", "一つの保護領域を、独立した製品として持つ"],
    ["複数領域 × ポイント", "隣の領域を、別製品のまま併売する"],
    ["単一領域 × 基盤", "一つの領域を、他製品が載る土台として開く"],
    ["複数領域 × 基盤", "複数領域を、一つの契約と画面にまとめる"],
  ];

  return (
    <div aria-hidden="true">
      <div className="mb-3 flex justify-between text-[11px] tracking-[0.14em] text-muted uppercase">
        <span>Point product</span>
        <span>Platform</span>
      </div>
      <div className="grid grid-cols-2 border border-navy/70">
        {cells.map(([title, note], index) => (
          <div
            key={title}
            className={`min-h-28 bg-white p-3 md:p-4 ${index % 2 === 0 ? "border-r border-line" : ""} ${index < 2 ? "border-b border-line" : ""}`}
          >
            <p className="text-[13px] leading-snug font-medium">{title}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-muted">
        <span>縦軸は上段が単一に近く、下段が複数領域</span>
        <span className="tracking-[0.14em] uppercase">Scope</span>
      </div>
    </div>
  );
}

function AdoptionConditions() {
  const rows = [
    ["01", "業務", "どの作業が短くなり、どの確認が人に残るか"],
    ["02", "データ", "参照できる情報の権限、鮮度、所在が説明できるか"],
    ["03", "ガバナンス", "出力の責任と記録が、既存の規程に接続するか"],
  ];

  return (
    <ol className="grid gap-px bg-line" aria-hidden="true">
      {rows.map(([index, title, note]) => (
        <li key={index} className="grid grid-cols-[auto_1fr] gap-4 bg-white px-4 py-4">
          <span className="pt-0.5 text-[11px] tracking-[0.16em] text-navy tabular-nums">{index}</span>
          <span>
            <span className="block text-sm font-medium">{title}</span>
            <span className="mt-1 block text-[13px] leading-relaxed text-muted">{note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function IndustryLayers() {
  const layers = [
    ["業務知識", "現場の例外と、ソフトウェアに写せる手順"],
    ["業務システム", "日々の記録、承認、請求が動く層"],
    ["共通基盤", "認証、データ、課金など業種をまたぐ層"],
  ];

  return (
    <ol className="grid gap-3" aria-hidden="true">
      {layers.map(([title, note], index) => (
        <li key={title} className="border border-line bg-white">
          <div className="h-1 bg-navy" style={{ opacity: 1 - index * 0.28 }} />
          <div className="px-4 py-3">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ReportMark({ kind }: { kind: FigureKind }) {
  return (
    <div className="flex h-full w-full items-center bg-paper-2 p-3 text-navy" aria-hidden="true">
      {kind === "cnapp" ? <MarkStack /> : null}
      {kind === "competitive" ? <MarkGrid /> : null}
      {kind === "adoption" ? <MarkRows /> : null}
      {kind === "industry" ? <MarkLayers /> : null}
    </div>
  );
}

function MarkStack() {
  return (
    <div className="grid w-full gap-1">
      <span className="h-2 w-full bg-navy" />
      <span className="h-2 w-[86%] bg-navy/80" />
      <span className="h-2 w-[72%] bg-navy/60" />
      <span className="h-2 w-[58%] bg-navy/40" />
    </div>
  );
}

function MarkGrid() {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 border border-navy/50">
      <span className="border-r border-b border-navy/30 bg-navy/15" />
      <span className="border-b border-navy/30" />
      <span className="border-r border-navy/30 bg-navy/30" />
      <span className="bg-navy/50" />
    </div>
  );
}

function MarkRows() {
  return (
    <div className="grid w-full gap-1.5">
      <span className="h-2.5 w-full bg-navy" />
      <span className="h-2.5 w-full bg-charcoal/70" />
      <span className="h-2.5 w-full bg-navy/35" />
    </div>
  );
}

function MarkLayers() {
  return (
    <div className="grid w-full gap-1">
      <span className="h-4 w-full border border-navy bg-white" />
      <span className="h-4 w-full border border-navy bg-navy/10" />
      <span className="h-4 w-full bg-navy" />
    </div>
  );
}
