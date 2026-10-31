import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { CharcoalPill } from "@/components/pill";
import { btn } from "@/components/kit";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center text-center" data-testid="page-not-found">
      <CharcoalPill tilt={-3}>Error 404</CharcoalPill>
      <h1 className="font-display mt-6 text-6xl font-black leading-[0.9] md:text-8xl">Folder not found.</h1>
      <p className="mt-4 text-muted-foreground">This page is not in the stack. Head back and flip to a step that exists.</p>
      <Link href="/" className={btn.primary + " mt-6"} data-testid="link-home-404">Back to the start <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
