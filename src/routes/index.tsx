import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scrapeRecipe } from "@/lib/scrape.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Recipe Scraper — Clean, printable recipes from any URL" },
      {
        name: "description",
        content:
          "Paste a recipe URL to get just the recipe text — copy, print, or scale ingredients. No ads, no life stories.",
      },
    ],
  }),
});


type Recipe = { name: string; ingredients: string[]; directions: string[] };

function recipeToText(r: Recipe): string {
  const parts: string[] = [];
  if (r.name) parts.push(r.name, "");
  parts.push("Ingredients", ...r.ingredients.map((i) => `- ${i}`), "");
  parts.push(
    "Directions",
    ...r.directions.map((d, i) => `${i + 1}. ${d}`),
  );
  return parts.join("\n");
}

function Index() {
  const router = useRouter();
  const scrape = useServerFn(scrapeRecipe);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRecipe(null);
    try {
      const res = await scrape({ data: { url } });
      if (!res.ok) setError(res.error);
      else setRecipe({ name: res.name, ingredients: res.ingredients, directions: res.directions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!recipe) return;
    await navigator.clipboard.writeText(recipeToText(recipe));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onPrint = () => window.print();

  return (
    <div className="min-h-screen bg-[oklch(0.20_0.06_260)] text-white">
      <div className="mx-auto max-w-6xl px-4 pt-4 print:hidden">
        <AdSlot label="Top Banner" className="h-24 w-full" />
      </div>

      <header className="mx-auto max-w-6xl px-4 pt-8 pb-4 print:hidden">
        <h1 className="text-3xl font-bold sm:text-4xl">Recipe Scraper</h1>
        <p className="mt-2 text-white/70">
          Paste a recipe URL. Get just the recipe — no life story, no pop-ups.
        </p>
        <p className="mt-1 text-sm text-white/50">
          Works with most recipe sites, but not every site.
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 lg:grid-cols-[160px_1fr_160px]">
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-4 space-y-4">
            <AdSlot label="Left Skyscraper" className="h-[600px] w-full" />
          </div>
        </aside>

        <main>
          <form onSubmit={onSubmit} className="print:hidden">
            <label htmlFor="recipe-url" className="mb-2 block text-sm text-white/80">
              Recipe URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="recipe-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/best-chocolate-chip-cookies"
                className="flex-1 rounded border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-white px-4 py-2 font-semibold text-[oklch(0.20_0.06_260)] transition hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Extracting…" : "Extract recipe"}
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={() => router.navigate({ to: "/ratio" })}
              className="rounded border border-white/40 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Scale ingredient ratios →
            </button>
            {recipe && (
              <>
                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  className="rounded border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
                >
                  Print
                </button>
              </>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-100 print:hidden">
              {error}
            </p>
          )}

          {recipe && (
            <article className="mt-6 rounded-lg bg-white/5 p-6 print:bg-white print:p-0 print:text-black">
              {recipe.name && (
                <h2 className="mb-4 text-2xl font-bold print:text-black">{recipe.name}</h2>
              )}
              <section className="mb-6">
                <h3 className="mb-2 text-lg font-semibold print:text-black">Ingredients</h3>
                <ul className="list-disc space-y-1 pl-6 text-[15px] leading-relaxed text-white/90 print:text-black">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="mb-2 text-lg font-semibold print:text-black">Directions</h3>
                <ol className="list-decimal space-y-2 pl-6 text-[15px] leading-relaxed text-white/90 print:text-black">
                  {recipe.directions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </section>
            </article>
          )}
        </main>

        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-4 space-y-4">
            <AdSlot label="Right Skyscraper" className="h-[600px] w-full" />
          </div>
        </aside>
      </div>


      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-white/50 print:hidden">
        Respect each site's terms of use. For personal use.
      </footer>
    </div>
  );
}