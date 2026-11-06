import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "solid" | "line";

const styles: Record<Variant, string> = {
  solid:
    "bg-navy text-white hover:bg-navy-deep focus-visible:outline-[#8aa0bd]",
  line: "border border-navy/35 text-navy hover:border-navy hover:bg-paper-2",
};

export function ButtonLink({
  href,
  variant = "solid",
  caps = true,
  children,
  className,
}: {
  href: string;
  variant?: Variant;
  caps?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center px-5 text-[13px] transition-colors duration-150",
        caps ? "tracking-[0.12em] uppercase" : "tracking-[0.04em]",
        styles[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
