import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { site } from "@/data/site";

export const metadata: Metadata = {
  description: `${site.descriptionEn} ${site.descriptionJa}`,
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomePage />;
}
