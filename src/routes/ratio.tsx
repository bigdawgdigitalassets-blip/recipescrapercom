import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/ratio")({
  component: RatioPage,
  head: () => ({
    meta: [
      { title: "Ingredient Ratio Scaler — RecipeStripper" },
      {
        name: "description",
        content: "Scale ingredient quantities up or down for any recipe.",
      },
    ],
  }),
});

function RatioPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.20_0.06_260)] text-white">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Ingredient Ratio Scaler</h1>
        <p className="mt-4 text-white/70">
          Coming soon — paste a recipe and rescale its ingredients to any batch size.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          ← Back to RecipeStripper
        </Link>
      </div>
    </div>
  );
}