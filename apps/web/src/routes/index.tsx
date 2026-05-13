import { Button } from "@handeck/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  // Sample landing page for the app
  return (
    <div className="container mx-auto max-w-3xl px-4 py-2 flex flex-col justify-around">
      <div className="flex flex-col justify-center items-center gap-6">
        <h1 className="text-5xl sm:text-6xl font-bold">🀄️ HanDeck</h1>
        <div className="h-full w-full flex justify-center items-center gap-2">
          <Button className="text-sm rounded-md" size="lg" asChild>
            <Link to="/templates">Create a new deck</Link>
          </Button>
          <Button
            variant="outline"
            className="text-sm rounded-md"
            size="lg"
            asChild
          >
            <Link to="/decks">Created decks</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
