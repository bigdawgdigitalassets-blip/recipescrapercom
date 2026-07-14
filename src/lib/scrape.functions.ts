import { createServerFn } from "@tanstack/react-start";
import Firecrawl from "@mendable/firecrawl-js";

type Recipe = { name: string; ingredients: string[]; directions: string[] };

function cleanStr(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim();
}

function flattenInstructions(input: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") {
      const t = cleanStr(v);
      if (t) out.push(t);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      const type = typeof o["@type"] === "string" ? (o["@type"] as string) : "";
      if (type === "HowToSection" && Array.isArray(o.itemListElement)) {
        walk(o.itemListElement);
        return;
      }
      if (typeof o.text === "string") {
        const t = cleanStr(o.text);
        if (t) out.push(t);
        return;
      }
      if (typeof o.name === "string") {
        const t = cleanStr(o.name);
        if (t) out.push(t);
      }
    }
  };
  walk(input);
  return out;
}

function extractJsonLdRecipe(html: string): Recipe | null {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!scripts) return null;
  const candidates: Record<string, unknown>[] = [];
  for (const block of scripts) {
    const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(inner);
      const push = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach(push);
          return;
        }
        if (typeof node !== "object") return;
        const o = node as Record<string, unknown>;
        if (Array.isArray(o["@graph"])) push(o["@graph"]);
        const t = o["@type"];
        const isRecipe = Array.isArray(t)
          ? t.includes("Recipe")
          : t === "Recipe";
        if (isRecipe) candidates.push(o);
      };
      push(parsed);
    } catch {
      // ignore malformed block
    }
  }
  for (const r of candidates) {
    const name = cleanStr(r.name);
    const ingredients = Array.isArray(r.recipeIngredient)
      ? (r.recipeIngredient as unknown[]).map(cleanStr).filter(Boolean)
      : [];
    const directions = flattenInstructions(r.recipeInstructions);
    if (ingredients.length && directions.length) {
      return { name, ingredients, directions };
    }
  }
  return null;
}

function extractFromMarkdown(md: string): Recipe | null {
  if (!md) return null;
  const lines = md.split(/\r?\n/);
  // Find title: first H1, fallback to first heading
  let name = "";
  const h1 = lines.find((l) => /^#\s+\S/.test(l));
  if (h1) name = cleanStr(h1.replace(/^#+\s+/, ""));

  // Locate section headings for ingredients / directions
  const headingIdx: { text: string; line: number; level: number }[] = [];
  lines.forEach((l, i) => {
    const m = /^(#{1,6})\s+(.+)$/.exec(l);
    if (m) headingIdx.push({ text: m[2].toLowerCase(), line: i, level: m[1].length });
  });

  const findSection = (patterns: RegExp[]) => {
    const idx = headingIdx.findIndex((h) => patterns.some((p) => p.test(h.text)));
    if (idx === -1) return null;
    const start = headingIdx[idx].line + 1;
    const end = idx + 1 < headingIdx.length ? headingIdx[idx + 1].line : lines.length;
    return lines.slice(start, end);
  };

  const ingSection = findSection([/^ingredients?\b/, /\bingredients?\b/]);
  const dirSection = findSection([
    /^(directions?|instructions?|method|steps|preparation)\b/,
    /\b(directions?|instructions?|method|steps)\b/,
  ]);
  if (!ingSection || !dirSection) return null;

  const bulletRe = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
  const collectItems = (block: string[]) => {
    const items: string[] = [];
    for (const raw of block) {
      const m = bulletRe.exec(raw);
      if (m) {
        const t = cleanStr(m[1].replace(/\*\*/g, "").replace(/`/g, ""));
        if (t) items.push(t);
      }
    }
    return items;
  };
  const ingredients = collectItems(ingSection);
  const directions = collectItems(dirSection);
  if (!ingredients.length || !directions.length) return null;
  return { name, ingredients, directions };
}

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
        formats: [
          "markdown",
          "rawHtml",
          {
            type: "json",
            prompt:
              "Extract ONLY the recipe from this page. Return the recipe's name, a flat list of ingredient lines (each as written, e.g. '2 cups flour'), and the step-by-step directions as an ordered list of instruction strings. Do NOT include the author's story, ads, comments, nutrition info, tips, or any other prose.",
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                ingredients: { type: "array", items: { type: "string" } },
                directions: { type: "array", items: { type: "string" } },
              },
              required: ["name", "ingredients", "directions"],
            },
          },
        ],
        onlyMainContent: true,
      });
      const r = result as {
        json?: unknown;
        markdown?: string;
        rawHtml?: string;
        html?: string;
        metadata?: { title?: string };
        data?: {
          json?: unknown;
          markdown?: string;
          rawHtml?: string;
          html?: string;
          metadata?: { title?: string };
        };
      };
      const json = r.json ?? r.data?.json;
      const markdown = r.markdown ?? r.data?.markdown ?? "";
      const rawHtml = r.rawHtml ?? r.data?.rawHtml ?? r.html ?? r.data?.html ?? "";
      const metaTitle = r.metadata?.title ?? r.data?.metadata?.title ?? "";

      const candidates: (Recipe | null)[] = [];

      // 1. Firecrawl JSON extraction
      const jr = json as
        | { name?: string; ingredients?: string[]; directions?: string[] }
        | undefined;
      if (
        jr &&
        Array.isArray(jr.ingredients) &&
        Array.isArray(jr.directions) &&
        jr.ingredients.length &&
        jr.directions.length
      ) {
        candidates.push({
          name: cleanStr(jr.name),
          ingredients: jr.ingredients.map(cleanStr).filter(Boolean),
          directions: jr.directions.map(cleanStr).filter(Boolean),
        });
      }

      // 2. schema.org JSON-LD Recipe embedded in raw HTML
      if (rawHtml) {
        const jsonLd = extractJsonLdRecipe(rawHtml);
        if (jsonLd) candidates.push(jsonLd);
      }

      // 3. Markdown heading heuristic
      const mdRecipe = extractFromMarkdown(markdown);
      if (mdRecipe) candidates.push(mdRecipe);

      const picked = candidates.find(
        (c): c is Recipe => !!c && c.ingredients.length > 0 && c.directions.length > 0,
      );
      if (!picked) {
        return { ok: false as const, error: "We're sorry, that site doesn't play with us." };
      }
      return {
        ok: true as const,
        name: picked.name || cleanStr(metaTitle),
        ingredients: picked.ingredients,
        directions: picked.directions,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scrape failed";
      return { ok: false as const, error: msg };
    }
  });