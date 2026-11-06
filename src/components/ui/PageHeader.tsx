import { Container } from "@/components/ui/Container";

export function PageHeader({
  eyebrow,
  title,
  titleJa,
  lede,
}: {
  eyebrow: string;
  title: string;
  titleJa: string;
  lede: string;
}) {
  return (
    <header className="border-b border-line">
      <Container className="py-16 md:py-24">
        <p className="text-[11px] tracking-[0.24em] text-navy uppercase">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-serif text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="font-mincho mt-5 text-xl leading-relaxed text-ink-soft md:text-2xl">
          {titleJa}
        </p>
        <p className="mt-8 max-w-2xl text-[16px] leading-[1.9] text-ink-soft">{lede}</p>
      </Container>
    </header>
  );
}
