import { formatJpy } from "@/lib/format";

export function Price({
  amount,
  tone = "default",
}: {
  amount?: number;
  tone?: "default" | "large";
}) {
  if (amount == null) {
    return <span className={tone === "large" ? "text-lg" : ""}>価格はお問い合わせ</span>;
  }

  return (
    <span className={tone === "large" ? "text-[1.65rem] leading-none" : ""}>
      <span className="tabular-nums">{formatJpy(amount)}</span>
      <span className="ml-2 text-[12px] tracking-[0.08em] text-muted">税別</span>
    </span>
  );
}
