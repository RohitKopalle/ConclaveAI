import AppUI from '@/components/AppUI';

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex-shrink-0 h-16 border-b border-border bg-surface px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold rounded-sm flex items-center justify-center text-background font-serif font-bold text-xl">A</div>
          <span className="font-serif text-xl font-medium tracking-tight">Conclave</span>
        </div>
        <div className="text-sm font-medium text-foreground/60">
          Self-Improving Agent <span className="text-gold mx-2">•</span> <span className="font-mono bg-border px-2 py-1 rounded border border-border/50">Multi-Model Deliberation</span>
        </div>
      </header>
      <main className="flex-1 h-[calc(100vh-4rem)]">
        <AppUI />
      </main>
    </div>
  );
}
