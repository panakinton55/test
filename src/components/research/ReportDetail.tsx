import Link from "next/link";
import { getCategoryLabel, reports, type Report } from "@/data/reports";
import { formatDate } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Price } from "@/components/research/Price";
import { ReportFigure } from "@/components/research/ReportFigure";

export function ReportDetail({ report }: { report: Report }) {
  const category = getCategoryLabel(report.category);
  const purchaseHref = `/contact?topic=purchase&report=${report.slug}`;
  const related = reports.filter((item) => item.slug !== report.slug).slice(0, 3);

  return (
    <article>
      <header className="border-b border-line">
        <Container className="py-14 md:py-20">
          <nav aria-label="パンくず" className="text-[12px] tracking-[0.12em] text-muted uppercase">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/research" className="hover:text-navy">
                  Research
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/research?category=${report.category}`} className="hover:text-navy">
                  {category}
                </Link>
              </li>
            </ol>
          </nav>
          <h1 className="mt-6 max-w-4xl font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.03em]">
            {report.title}
          </h1>
          <p className="font-mincho mt-4 text-xl text-ink-soft md:text-2xl">{report.titleJa}</p>
          <p className="mt-6 max-w-2xl text-[16px] leading-[1.9] text-ink-soft">{report.summary}</p>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] tracking-[0.16em] text-muted uppercase">Published</dt>
              <dd className="mt-1">
                <time dateTime={report.publishedAt}>{formatDate(report.publishedAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.16em] text-muted uppercase">Category</dt>
              <dd className="mt-1">{category}</dd>
            </div>
          </dl>
        </Container>
      </header>

      <Container className="grid gap-12 py-14 lg:grid-cols-12 lg:py-20">
        <div className="order-2 lg:order-1 lg:col-span-8">
          <Section title="エグゼクティブサマリー">
            {report.executiveSummary.map((paragraph) => (
              <p key={paragraph} className="prose-ja text-ink-soft">
                {paragraph}
              </p>
            ))}
          </Section>

          <Section title="調査目的">
            <BulletList items={report.objectives} />
          </Section>

          <Section title="分析対象">
            <BulletList items={report.scope} />
          </Section>

          <Section title="主要な分析項目">
            <ol className="grid gap-3 sm:grid-cols-2">
              {report.analysisItems.map((item, index) => (
                <li key={item} className="border-t border-line pt-3">
                  <span className="text-[11px] tracking-[0.14em] text-muted tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-[15px]">{item}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="レポートの目次">
            <ol className="grid gap-6">
              {report.toc.map((chapter, index) => (
                <li key={chapter.title} className="grid gap-2 border-t border-line pt-4 md:grid-cols-[7rem_1fr]">
                  <p className="text-[12px] tracking-[0.14em] text-navy tabular-nums">
                    Chapter {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <p className="font-mincho text-lg">{chapter.title}</p>
                    <ul className="mt-2 grid gap-1 text-[14px] leading-relaxed text-ink-soft">
                      {chapter.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="サンプル図">
            <ReportFigure kind={report.figure} label={report.figureLabel} caption={report.figureCaption} />
          </Section>

          <Section title="限界">
            <p className="prose-ja text-ink-soft">{report.limits}</p>
          </Section>
        </div>

        <aside className="order-1 lg:order-2 lg:col-span-4">
          <div className="border border-line p-6 lg:sticky lg:top-24">
            <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Price</p>
            <p className="mt-4 text-ink">
              <Price amount={report.priceJpy} tone="large" />
            </p>
            <div className="mt-6">
              <ButtonLink href={purchaseHref} caps={false} className="w-full">
                購入について問い合わせる
              </ButtonLink>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              オンライン決済はまだ接続していません。購入ボタンは、このレポートを件名にした問い合わせフォームへ移動します。
            </p>
          </div>
        </aside>
      </Container>

      <section className="border-t border-line py-16 md:py-20">
        <Container>
          <h2 className="font-mincho text-2xl">ほかのレポート</h2>
          <ul className="mt-6 border-t border-line">
            {related.map((item) => (
              <li key={item.slug} className="border-b border-line">
                <Link
                  href={`/research/${item.slug}`}
                  className="flex flex-col gap-1 py-5 hover:text-navy md:flex-row md:items-baseline md:justify-between"
                >
                  <span className="font-serif text-2xl tracking-[-0.02em]">{item.title}</span>
                  <span className="text-[12px] tracking-[0.12em] text-muted uppercase">
                    {getCategoryLabel(item.category)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-mincho text-[1.45rem] leading-snug md:text-[1.7rem]">{title}</h2>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[0.75rem_1fr] gap-3 text-[15.5px] leading-[1.85] text-ink-soft">
          <span aria-hidden="true" className="mt-[0.7em] h-px bg-navy" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
