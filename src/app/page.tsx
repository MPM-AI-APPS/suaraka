import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Headphones, Sparkles, BookOpen } from "lucide-react";

export default async function Landing() {
  const session = await auth();
  const cta = session?.user ? "/library" : "/login";

  return (
    <main className="suaraka-page">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-6 py-24 text-center">
        <div className="suaraka-reveal inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> your library, now in voice
        </div>
        <h1 className="suaraka-reveal font-heading text-5xl leading-[1.05] tracking-tight md:text-7xl">
          Turn every book you love <br />
          <span className="italic text-primary">into a quiet voice in your ear.</span>
        </h1>
        <p className="suaraka-reveal max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          Upload any PDF — textbook, paper, novel, module — and Suaraka narrates it for
          you in a natural human voice. Listen, read along, summarize, and ask questions.
        </p>
        <div className="suaraka-reveal flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href={cta}>
              {session?.user ? "Open library" : "Sign in to start"} <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-6">
            <Link href="#how">How it works</Link>
          </Button>
        </div>

        <div id="how" className="grid w-full gap-4 pt-16 md:grid-cols-3">
          <FeatureCard
            icon={<BookOpen />}
            title="Smart PDF ingest"
            body="Clean text extraction, automatic chapter detection, preserved reading order."
          />
          <FeatureCard
            icon={<Headphones />}
            title="Natural TTS"
            body="Warm, natural narration in English and Bahasa Indonesia. Multiple voices, adjustable speed."
          />
          <FeatureCard
            icon={<Sparkles />}
            title="AI companion"
            body="Summarize chapters, extract key takeaways, and ask questions about your library."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="suaraka-glass suaraka-reveal rounded-2xl p-6 text-left">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="font-heading text-lg font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
