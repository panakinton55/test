import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/data/services";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Services",
  description:
    "市場調査、競合分析、テクノロジー調査、カスタムリサーチ。AI Research Studio の調査の範囲と、それぞれの問いを紹介します。",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Services"
        titleJa="調査のかたち"
        lede="市場規模や成長性、競合の事業、技術が産業に与える影響。そして、そのどれにも収まらない個別の問い。範囲を先に書き、調べないことも決めます。"
      />
      <div>
        {services.map((service) => (
          <section key={service.id} id={service.id} className="border-b border-line">
            <Container className="grid gap-8 py-16 md:grid-cols-12 md:py-24">
              <div className="md:col-span-5">
                <p className="text-[11px] tracking-[0.18em] text-muted tabular-nums">{service.index}</p>
                <h2 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] tracking-[-0.03em]">
                  {service.name}
                </h2>
                <p className="font-mincho mt-3 text-xl text-navy">{service.nameJa}</p>
                <p className="mt-6 text-[16px] leading-[1.9] text-ink">{service.summary}</p>
              </div>
              <div className="md:col-span-6 md:col-start-7">
                <p className="text-[15.5px] leading-[1.9] text-ink-soft">{service.detail}</p>
                <div className="mt-10 grid gap-8">
                  <div>
                    <h3 className="text-[11px] tracking-[0.18em] text-navy uppercase">Questions</h3>
                    <ul className="mt-4 grid gap-3 text-[15px] leading-[1.85] text-ink-soft">
                      {service.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[11px] tracking-[0.18em] text-navy uppercase">Scope</h3>
                    <ul className="mt-4 grid gap-3 text-[15px] leading-[1.85] text-ink-soft">
                      {service.scope.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Container>
          </section>
        ))}
      </div>
      <section className="py-16 md:py-24">
        <Container className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-mincho text-[1.8rem] leading-snug">範囲は、課題を聞いてから決めます。</h2>
            <p className="mt-4 text-[15px] leading-[1.9] text-ink-soft">
              掲載レポートで近いものがあれば、そこから始められます。個別の問いであれば、
              <Link href="/contact?topic=custom" className="text-navy underline decoration-navy/30 underline-offset-4">
                カスタムリサーチ
              </Link>
              として範囲を切ります。
            </p>
          </div>
          <ButtonLink href="/contact?topic=custom">Discuss a brief</ButtonLink>
        </Container>
      </section>
    </>
  );
}
