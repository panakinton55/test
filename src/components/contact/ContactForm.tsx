"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getReport } from "@/data/reports";

const topics = [
  { value: "purchase", label: "レポートの購入" },
  { value: "research", label: "掲載レポートについて" },
  { value: "custom", label: "カスタムリサーチ" },
  { value: "other", label: "その他" },
] as const;

type Topic = (typeof topics)[number]["value"];

export function ContactForm() {
  return (
    <Suspense fallback={<FormFields />}>
      <FormFromQuery />
    </Suspense>
  );
}

function FormFromQuery() {
  const params = useSearchParams();
  const topicParam = params.get("topic");
  const reportSlug = params.get("report") ?? "";
  const report = reportSlug ? getReport(reportSlug) : undefined;
  const topic = topics.some((item) => item.value === topicParam)
    ? (topicParam as Topic)
    : report
      ? "purchase"
      : "research";

  return <FormFields topic={topic} subject={report ? `${report.title} について` : ""} reportTitle={report?.title} />;
}

function FormFields({
  topic = "research",
  subject = "",
  reportTitle,
}: {
  topic?: Topic;
  subject?: string;
  reportTitle?: string;
}) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const initialSubject = useMemo(() => subject, [subject]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name || !message) {
      setNotice("");
      setError("お名前とお問い合わせ内容を入力してください。");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice("");
      setError("メールアドレスの形式を確認してください。");
      return;
    }

    setError("");
    setNotice(
      "このフォームは画面確認用です。送信機能はまだ接続されていないため、内容は送られていません。",
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-7">
      {reportTitle ? (
        <p className="border border-line bg-paper-2 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          対象レポート: <span className="text-ink">{reportTitle}</span>
        </p>
      ) : null}
      <Field label="お名前" htmlFor="name">
        <input id="name" name="name" required autoComplete="name" className={inputClass} />
      </Field>
      <Field label="組織名" htmlFor="organization" optional>
        <input id="organization" name="organization" autoComplete="organization" className={inputClass} />
      </Field>
      <Field label="メールアドレス" htmlFor="email">
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="種別" htmlFor="topic">
        <select id="topic" name="topic" defaultValue={topic} className={inputClass}>
          {topics.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="件名" htmlFor="subject" optional>
        <input id="subject" name="subject" defaultValue={initialSubject} className={inputClass} />
      </Field>
      <Field label="お問い合わせ内容" htmlFor="message">
        <textarea id="message" name="message" required rows={7} className={`${inputClass} resize-y`} />
      </Field>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center bg-navy px-6 text-[14px] tracking-[0.04em] text-white transition-colors duration-150 hover:bg-navy-deep focus-visible:outline-[#8aa0bd]"
        >
          内容を確認する
        </button>
        <p className="max-w-xs text-[12px] leading-relaxed text-muted">
          送信ボタンは入力の確認用です。メールは送信されません。
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#7a3030]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="border border-line px-4 py-3 text-sm leading-relaxed text-ink-soft">
          {notice}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-2 text-[13px] text-ink">
        {label}
        {optional ? <span className="text-[11px] text-muted">任意</span> : null}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-line bg-white px-3 py-3 text-[15px] text-ink outline-none transition-colors duration-150 focus:border-navy";
