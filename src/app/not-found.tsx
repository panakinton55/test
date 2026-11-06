import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container className="py-24 md:py-36">
      <p className="text-[11px] tracking-[0.22em] text-navy uppercase">404</p>
      <h1 className="mt-4 font-serif text-5xl tracking-[-0.03em] md:text-7xl">Page not found</h1>
      <p className="font-mincho mt-6 max-w-md text-xl leading-relaxed text-ink-soft">
        このページは見当たりません。アドレスを確認するか、レポート一覧から探してください。
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/research" variant="line">
          Research
        </ButtonLink>
      </div>
    </Container>
  );
}
