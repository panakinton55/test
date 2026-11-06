import Link from "next/link";
import { navigation, site } from "@/data/site";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <Container className="grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <p className="text-[12px] tracking-[0.22em] text-navy">{site.imprint}</p>
          <p className="mt-4 font-serif text-3xl leading-tight tracking-[-0.03em]" lang="en">
            {site.tagline}
          </p>
          <p className="font-mincho mt-6 max-w-sm text-[15px] leading-[1.9] text-ink-soft">
            市場、企業、テクノロジーの複雑な情報を、判断に使える形へ整えます。
          </p>
        </div>
        <nav className="md:col-span-3" aria-label="フッター">
          <p className="text-[11px] tracking-[0.2em] text-muted uppercase">Index</p>
          <ul className="mt-4 grid gap-3">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-ink hover:text-navy">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-4">
          <p className="text-[11px] tracking-[0.2em] text-muted uppercase">Contact</p>
          <p className="mt-4 text-sm leading-[1.85] text-ink-soft">
            レポートと個別調査についての連絡は、問い合わせフォームで受け付けています。
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex text-[13px] tracking-[0.14em] text-navy uppercase underline decoration-navy/30 underline-offset-4 hover:decoration-navy"
          >
            Inquire
          </Link>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-5 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {site.year} {site.name}</p>
          <p>個人運営の独立系リサーチスタジオ</p>
        </Container>
      </div>
    </footer>
  );
}
