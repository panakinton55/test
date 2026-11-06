import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "AI Research Studio へのお問い合わせ。レポートの購入、カスタムリサーチ、調査の範囲についての連絡を受け付けます。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Contact"
        titleJa="お問い合わせ"
        lede="掲載レポート、個別調査、進め方についての連絡を受け付けます。フォームは画面の確認用で、まだ送信先には接続していません。"
      />
      <Container className="grid gap-12 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-4">
          <h2 className="font-mincho text-2xl leading-snug">書くとよいこと</h2>
          <ul className="mt-6 grid gap-4 text-[15px] leading-[1.85] text-ink-soft">
            <li>判断したいこと。導入、投資、企画のどれに近いか。</li>
            <li>すでに社内で分かっていることと、外で調べたいこと。</li>
            <li>いつまでに、どの形で必要か。短いメモでも構いません。</li>
          </ul>
          <p className="mt-8 text-[13px] leading-relaxed text-muted">
            営業の代行や、出典を示さない原稿の作成は受けていません。
          </p>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          <ContactForm />
        </div>
      </Container>
    </>
  );
}
