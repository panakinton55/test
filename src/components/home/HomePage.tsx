import Link from "next/link";
import { getFeaturedReport, getCategoryLabel, reports } from "@/data/reports";
import { principles } from "@/data/principles";
import { researchAreas } from "@/data/taxonomy";
import { services } from "@/data/services";
import { site } from "@/data/site";
import { formatDate } from "@/lib/format";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { Price } from "@/components/research/Price";
import { ReportFigure } from "@/components/research/ReportFigure";

export function HomePage() {
  const featured = getFeaturedReport();
  const others = reports.filter((report) => report.slug !== featured.slug);

  return (
    <>
      <section className="border-b border-line">
        <Container className="pt-16 pb-14 md:pt-24 md:pb-20">
          <h1>
            <span className="block text-[13px] tracking-[0.22em] text-navy sm:tracking-[0.28em]">
              {site.imprint}
            </span>
            <span
              className="mt-8 block max-w-5xl font-serif text-[clamp(3.1rem,8.4vw,6.6rem)] leading-[0.94] tracking-[-0.035em] text-ink"
              lang="en"
            >
              Research.
              <br />
              Analyze.
              <br />
              <span className="italic text-navy">Decide.</span>
            </span>
          </h1>
          <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <p className="max-w-md text-lg leading-relaxed text-ink-soft lg:col-span-5" lang="en">
              {site.descriptionEn}
            </p>
            <p className="font-mincho text-[1.08rem] leading-[1.9] text-ink sm:text-[1.25rem] lg:col-span-6 lg:col-start-7 lg:text-[1.4rem]">
              <span className="block">市場・競合・テクノロジーを分析し、</span>
              <span className="block">より良いビジネス意思決定を支援する。</span>
            </p>
          </div>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/research">Explore Research</ButtonLink>
            <ButtonLink href="/services" variant="line">
              Our Services
            </ButtonLink>
          </div>
        </Container>
        <div className="border-t border-line">
          <Container className="grid grid-cols-2 lg:grid-cols-4">
            {researchAreas.map((area) => (
              <Link
                key={area.id}
                href={`/research?category=${area.id}`}
                className="border-b border-line py-5 pr-4 transition-colors duration-150 hover:text-navy lg:border-b-0 lg:py-6 lg:pr-6"
              >
                <span className="block text-[11px] tracking-[0.16em] text-muted tabular-nums">{area.index}</span>
                <span className="mt-2 block text-[13px] leading-snug tracking-[0.02em] md:text-sm">
                  {area.name}
                </span>
              </Link>
            ))}
          </Container>
        </div>
      </section>

      <section id="featured" className="border-b border-line py-20 md:py-28">
        <Container>
          <SectionIntro
            index="01"
            eyebrow="Featured Research"
            title="いま読むレポート"
            lede="掲載中の調査から、市場の構造を先に固定した一本を置いています。"
          />
          <article className="mt-12 grid border border-line lg:grid-cols-12">
            <div className="border-b border-line p-6 lg:col-span-7 lg:border-r lg:border-b-0 lg:p-10">
              <p className="text-[11px] tracking-[0.18em] text-navy uppercase">
                {getCategoryLabel(featured.category)}
              </p>
              <h3 className="mt-4 font-serif text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] tracking-[-0.03em]">
                <Link href={`/research/${featured.slug}`} className="hover:text-navy">
                  {featured.title}
                </Link>
              </h3>
              <p className="font-mincho mt-3 text-lg text-ink-soft">{featured.titleJa}</p>
              <p className="mt-6 max-w-xl text-[15px] leading-[1.9] text-ink-soft">{featured.summary}</p>
              <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
                <p className="text-sm text-ink">
                  <Price amount={featured.priceJpy} />
                </p>
                <time dateTime={featured.publishedAt} className="text-[13px] text-muted">
                  {formatDate(featured.publishedAt)}
                </time>
              </div>
              <div className="mt-8">
                <ButtonLink href={`/research/${featured.slug}`} variant="line">
                  Read the brief
                </ButtonLink>
              </div>
            </div>
            <div className="p-6 lg:col-span-5 lg:p-8">
              <ReportFigure
                kind={featured.figure}
                label={featured.figureLabel}
                caption={featured.figureCaption}
              />
            </div>
          </article>
          <ul className="mt-8 border-t border-line">
            {others.map((report) => (
              <li key={report.slug} className="border-b border-line">
                <Link
                  href={`/research/${report.slug}`}
                  className="grid gap-2 py-5 transition-colors duration-150 hover:text-navy md:grid-cols-[1fr_auto_auto] md:items-baseline md:gap-8"
                >
                  <span className="font-serif text-2xl tracking-[-0.02em]">{report.title}</span>
                  <span className="text-[12px] tracking-[0.12em] text-muted uppercase">
                    {getCategoryLabel(report.category)}
                  </span>
                  <time dateTime={report.publishedAt} className="text-[13px] text-muted">
                    {formatDate(report.publishedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="areas" className="border-b border-line py-20 md:py-28">
        <Container>
          <SectionIntro
            index="02"
            eyebrow="Research Areas"
            title="四つの調査領域"
            lede="市場、競合、技術、産業。問いに合わせて領域を切り、必要ならまたぎます。"
          />
          <ol className="mt-12 grid border-t border-line md:grid-cols-2">
            {researchAreas.map((area) => (
              <li key={area.id} className="border-b border-line py-8 md:px-8 md:odd:border-r md:odd:pl-0 md:even:pr-0">
                <p className="text-[11px] tracking-[0.18em] text-muted tabular-nums">{area.index}</p>
                <h3 className="mt-3 font-serif text-[1.8rem] leading-tight tracking-[-0.02em]">{area.name}</h3>
                <p className="font-mincho mt-2 text-lg text-navy">{area.nameJa}</p>
                <p className="mt-4 max-w-md text-[15px] leading-[1.85] text-ink-soft">{area.summary}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="services" className="border-b border-line py-20 md:py-28">
        <Container>
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <SectionIntro
                index="03"
                eyebrow="What We Do"
                title="調査を、判断の単位に切る"
                lede="決まったレポートと、課題に合わせた個別調査の両方を扱います。"
              />
            </div>
            <div className="md:col-span-5 md:justify-self-end">
              <ButtonLink href="/services" variant="line">
                Our Services
              </ButtonLink>
            </div>
          </div>
          <ol className="mt-12 border-t border-line">
            {services.map((service) => (
              <li key={service.id} className="grid gap-3 border-b border-line py-6 lg:grid-cols-[5rem_1fr_1.4fr] lg:gap-8 lg:py-7">
                <span className="text-[12px] tracking-[0.16em] text-muted tabular-nums">{service.index}</span>
                <span>
                  <span className="block font-serif text-2xl tracking-[-0.02em]">{service.name}</span>
                  <span className="font-mincho mt-1 block text-ink-soft">{service.nameJa}</span>
                </span>
                <span className="text-[15px] leading-[1.85] text-ink-soft">{service.summary}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="approach" className="border-b border-line bg-paper-2 py-20 md:py-28">
        <Container>
          <SectionIntro
            index="04"
            eyebrow="Our Approach"
            title="根拠の置き方を、先に決める"
            lede="結論の強さより、何を事実とし、何を解釈とし、何をまだ言わないかを優先します。"
          />
          <ol className="mt-12 grid gap-px bg-line md:grid-cols-2">
            {principles.map((principle) => (
              <li key={principle.index} className="bg-paper-2 p-6 md:p-8">
                <p className="text-[11px] tracking-[0.18em] text-navy tabular-nums">{principle.index}</p>
                <h3 className="font-mincho mt-3 text-xl leading-snug">{principle.title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.85] text-ink-soft">{principle.summary}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link
              href="/about"
              className="text-[13px] tracking-[0.14em] text-navy uppercase underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
            >
              How we research
            </Link>
          </div>
        </Container>
      </section>

      <section id="about" className="border-b border-line py-20 md:py-28">
        <Container className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-[11px] tracking-[0.22em] text-navy uppercase">05 / About</p>
            <h2 className="font-mincho mt-4 text-[1.7rem] leading-snug md:text-[2.1rem]">
              AI Research Studio について
            </h2>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <p className="text-[16px] leading-[1.95] text-ink-soft">
              AI Research Studio は、個人で運営する独立系のリサーチスタジオです。市場、企業、テクノロジーに関する複雑な情報を調査・分析し、企業やビジネスパーソンの判断を支えます。特定の事業者の販売方針には縛られず、公開情報と一次情報を起点に、出典を示して書きます。
            </p>
            <p className="mt-5 text-[16px] leading-[1.95] text-ink-soft" lang="en">
              {site.concept}
            </p>
            <div className="mt-8">
              <ButtonLink href="/about" variant="line">
                About the studio
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <section id="contact" className="py-20 md:py-28">
        <Container className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <p className="text-[11px] tracking-[0.22em] text-navy uppercase">06 / Contact</p>
            <h2 className="font-mincho mt-4 text-[clamp(1.8rem,4vw,3rem)] leading-[1.35]">
              調査の範囲を、
              <br />
              一緒に切ります。
            </h2>
            <p className="mt-6 max-w-xl text-[15.5px] leading-[1.9] text-ink-soft">
              掲載レポートの購入、個別の調査、進め方についての質問は、フォームから受け付けています。
            </p>
          </div>
          <div className="md:col-span-4 md:justify-self-end">
            <ButtonLink href="/contact">Contact</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
