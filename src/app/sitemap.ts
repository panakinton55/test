import type { MetadataRoute } from "next";
import { reports } from "@/data/reports";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/research", "/services", "/about", "/contact"].map((path) => ({
    url: `${site.url}${path || "/"}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const reportRoutes = reports.map((report) => ({
    url: `${site.url}/research/${report.slug}`,
    lastModified: report.publishedAt,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...reportRoutes];
}
