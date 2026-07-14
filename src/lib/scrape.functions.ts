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
        formats: [
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
      const json =
        (result as { json?: unknown }).json ??
        (result as { data?: { json?: unknown } }).data?.json;
      const recipe = json as
        | { name?: string; ingredients?: string[]; directions?: string[] }
        | undefined;
      if (
        !recipe ||
        !Array.isArray(recipe.ingredients) ||
        !Array.isArray(recipe.directions) ||
        (recipe.ingredients.length === 0 && recipe.directions.length === 0)
      ) {
        return { ok: false as const, error: "Could not find a recipe on that page." };
      }
      return {
        ok: true as const,
        name: recipe.name ?? "",
        ingredients: recipe.ingredients.filter((s) => typeof s === "string" && s.trim()),
        directions: recipe.directions.filter((s) => typeof s === "string" && s.trim()),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scrape failed";
      return { ok: false as const, error: msg };
    }
  });