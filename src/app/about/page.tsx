import type { Metadata } from "next";
import { principles } from "@/data/principles";
import { site } from "@/data/site";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "About",
  description:
    "AI Research Studio の調査の考え方。公開情報と一次情報を重視し、出典を示し、事実と推測を分け、生成された文章を検証前の事実として扱いません。",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="About"
        titleJa="調査の考え方"
        lede="複雑な情報を、判断できる単位までほどくこと。AI Research Studio の仕事はそこに尽きます。速さより、根拠の置き方を先に決めます。"
      />

      <section className="border-b border-line">
        <Container className="grid gap-8 py-16 md:grid-cols-12 md:py-24">
          <h2 className="font-mincho text-[1.7rem] leading-snug md:col-span-4 md:text-[2rem]">
            スタジオについて
          </h2>
          <div className="grid gap-5 md:col-span-7 md:col-start-6">
            <p className="prose-ja text-ink-soft">
              AI Research Studio は、個人で運営する独立系のリサーチスタジオです。市場、企業、テクノロジーに関する情報を調査・分析し、企業やビジネスパーソンの意思決定を支援します。
            </p>
            <p className="prose-ja text-ink-soft">
              特定の製品の販売や、特定の事業者の広報からは独立しています。依頼を受けた調査でも、範囲、出典、限界は本文に残します。依頼主の望む結論に合わせて、確認していないことを事実には書きません。
            </p>
            <p className="prose-ja text-ink-soft" lang="en">
              {site.concept}
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="py-16 md:py-24">
          <h2 className="font-mincho text-[1.7rem] leading-snug md:text-[2rem]">四つの方針</h2>
          <ol className="mt-10 border-t border-line">
            {principles.map((principle) => (
              <li key={principle.index} className="grid gap-4 border-b border-line py-8 md:grid-cols-12">
                <p className="text-[12px] tracking-[0.16em] text-navy tabular-nums md:col-span-2">
                  {principle.index}
                </p>
                <div className="md:col-span-4">
                  <h3 className="font-mincho text-xl leading-snug">{principle.title}</h3>
                </div>
                <p className="text-[15.5px] leading-[1.9] text-ink-soft md:col-span-6">{principle.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="grid gap-10 py-16 md:grid-cols-12 md:py-24">
          <h2 className="font-mincho text-[1.7rem] leading-snug md:col-span-4 md:text-[2rem]">
            情報の扱い
          </h2>
          <div className="grid gap-8 md:col-span-7 md:col-start-6">
            <Note
              title="公開情報を第一にする"
              body="企業開示、規制や標準の文書、技術文書、製品ドキュメントを基本の資料にします。統計を使うときは、定義と時点を本文に残します。"
            />
            <Note
              title="一次情報は出所とともに置く"
              body="取材や問い合わせで得た情報は、誰のどの時点の発言かを説明できる場合に限ります。説明できない伝聞は、事実の列に入れません。"
            />
            <Note
              title="事実と推測を同じ文で溶かさない"
              body="観察、解釈、仮説は書き分けます。仮説には、何が分かれば撤回するかを添え、確からしさを文章の強さで誤魔化しません。"
            />
            <Note
              title="生成された文章は、検証の前に置かない"
              body="AIは整理や草稿に使うことがあります。数値、引用、固有名詞、因果は、原資料に戻して確認するまで事実として掲載しません。"
            />
          </div>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <h2 className="font-mincho text-[1.7rem] leading-snug md:text-[2rem]">運営について</h2>
            <p className="mt-5 max-w-xl text-[15.5px] leading-[1.9] text-ink-soft">
              このサイトには、運営者の経歴、所在地、受賞、導入社名は載せていません。確認できるのは、調査の方針と、掲載しているレポートの範囲です。連絡は問い合わせフォームから受け付けます。
            </p>
          </div>
          <div className="md:col-span-5 md:justify-self-end">
            <ButtonLink href="/contact" variant="line">
              Contact
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-line pt-5">
      <h3 className="font-mincho text-lg">{title}</h3>
      <p className="mt-2 text-[15px] leading-[1.9] text-ink-soft">{body}</p>
    </div>
  );
}
