import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scrapeRecipe } from "@/lib/scrape.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RecipeStripper — Clean, printable recipes from any URL" },
      {
        name: "description",
        content:
          "Paste a recipe URL to get just the recipe text — copy, print, or scale ingredients. No ads, no life stories.",
      },
    ],
  }),
});

function AdSlot({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={
        "flex items-center justify-center rounded border border-dashed border-white/30 bg-white/5 text-xs uppercase tracking-widest text-white/60 " +
        (className ?? "")
      }
      aria-label={`Google AdSense placeholder: ${label}`}
    >
      <span>Google AdSense — {label}</span>
    </div>
  );
}

function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Index() {
  const router = useRouter();
  const scrape = useServerFn(scrapeRecipe);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<{ title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRecipe(null);
    try {
      const res = await scrape({ data: { url } });
      if (!res.ok) setError(res.error);
      else setRecipe({ title: res.title, text: stripMarkdown(res.markdown) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!recipe) return;
    const content = recipe.title ? `${recipe.title}\n\n${recipe.text}` : recipe.text;
    await navigator.clipboard.writeText(content);
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
        <h1 className="text-3xl font-bold sm:text-4xl">RecipeStripper</h1>
        <p className="mt-2 text-white/70">
          Paste a recipe URL. Get just the recipe — no life story, no pop-ups.
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
              {recipe.title && (
                <h2 className="mb-4 text-2xl font-bold print:text-black">{recipe.title}</h2>
              )}
              <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-white/90 print:text-black">
                {recipe.text}
              </pre>
            </article>
          )}
        </main>

        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-4 space-y-4">
            <AdSlot label="Right Skyscraper" className="h-[600px] w-full" />
          </div>
        </aside>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 print:hidden">
        <AdSlot label="Bottom Banner" className="h-24 w-full" />
      </div>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-white/50 print:hidden">
        Respect each site's terms of use. For personal use.
      </footer>
    </div>
  );
}