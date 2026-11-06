import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_JP, Newsreader, Shippori_Mincho } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { site } from "@/data/site";
import "./globals.css";

const plex = IBM_Plex_Sans_JP({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

const newsreader = Newsreader({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const mincho = Shippori_Mincho({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-mincho",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.summary,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.summary,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.summary,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  description: site.summary,
  url: site.url,
  slogan: site.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${plex.variable} ${newsreader.variable} ${mincho.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="skip-link">
          本文へ移動
        </a>
        <div className="h-0.5 bg-navy" aria-hidden="true" />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
        />
      </body>
    </html>
  );
}
