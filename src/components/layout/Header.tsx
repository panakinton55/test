"use client";

import { Suspense, useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navigation, site } from "@/data/site";
import { Container } from "@/components/ui/Container";

export function Header() {
  return (
    <Suspense fallback={<HeaderFrame pathname={null} open={false} onToggle={() => undefined} />}>
      <HeaderActive />
    </Suspense>
  );
}

function HeaderActive() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPath(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <HeaderFrame
      pathname={pathname}
      open={open}
      onToggle={() => setOpenPath(open ? null : pathname)}
      onNavigate={() => setOpenPath(null)}
    />
  );
}

function HeaderFrame({
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  pathname: string | null;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const menuId = useId();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md">
      <Container className="flex h-[4.25rem] items-center justify-between gap-6">
        <Link href="/" className="text-[12px] tracking-[0.22em] text-navy" aria-label="AI Research Studio ホーム">
          {site.imprint}
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="主要">
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} pathname={pathname}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-navy md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={onToggle}
        >
          {open ? <X aria-hidden="true" className="size-5" strokeWidth={1.5} /> : <Menu aria-hidden="true" className="size-5" strokeWidth={1.5} />}
          <span className="sr-only">{open ? "メニューを閉じる" : "メニューを開く"}</span>
        </button>
      </Container>
      {open ? (
        <nav id={menuId} className="border-t border-line bg-paper md:hidden" aria-label="主要">
          <Container className="flex flex-col py-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="flex items-baseline justify-between border-b border-line py-4"
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              >
                <span className="font-serif text-3xl tracking-[-0.03em]">{item.label}</span>
                <span className="text-[12px] tracking-[0.14em] text-muted">{item.labelJa}</span>
              </Link>
            ))}
          </Container>
        </nav>
      ) : null}
    </header>
  );
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string | null;
  children: React.ReactNode;
}) {
  const current = isCurrent(pathname, href);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`text-[13px] tracking-[0.08em] transition-colors duration-150 ${
        current ? "text-navy" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
