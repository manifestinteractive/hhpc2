import { Spinner } from "@/components/ui/spinner";

export function AppLoadingScreen() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner className="size-8" />
        <span className="text-sm font-medium tracking-[0.08em]">Loading ...</span>
      </div>
    </main>
  );
}
