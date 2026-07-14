import { createServerFn } from "@tanstack/react-start";
import Firecrawl from "@mendable/firecrawl-js";

export const scrapeRecipe = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => {
    if (!input || typeof input.url !== "string") throw new Error("URL required");
    const trimmed = input.url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) throw new Error("Enter a valid http(s) URL");
    if (trimmed.length > 2000) throw new Error("URL too long");
    return { url: trimmed };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Scraper not configured." };
    }
    try {
      const fc = new Firecrawl({ apiKey });
      const result = await fc.scrape(data.url, {
        formats: ["markdown"],
        onlyMainContent: true,
      });
      const md =
        (result as { markdown?: string }).markdown ??
        (result as { data?: { markdown?: string } }).data?.markdown ??
        "";
      const title =
        (result as { metadata?: { title?: string } }).metadata?.title ??
        (result as { data?: { metadata?: { title?: string } } }).data?.metadata?.title ??
        "";
      if (!md) return { ok: false as const, error: "Could not extract recipe text." };
      return { ok: true as const, title, markdown: md };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scrape failed";
      return { ok: false as const, error: msg };
    }
  });