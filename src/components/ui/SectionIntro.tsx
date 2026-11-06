export function SectionIntro({
  index,
  eyebrow,
  title,
  lede,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="flex items-baseline gap-3 text-[11px] tracking-[0.22em] text-navy uppercase">
        <span className="tabular-nums">{index}</span>
        <span>{eyebrow}</span>
      </p>
      <h2 className="font-mincho mt-4 text-[1.7rem] leading-[1.4] text-ink md:text-[2.15rem]">
        {title}
      </h2>
      {lede ? (
        <p className="mt-5 text-[15.5px] leading-[1.9] text-ink-soft">{lede}</p>
      ) : null}
    </div>
  );
}
