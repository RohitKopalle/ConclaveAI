import AppUI from '@/components/AppUI';
import { BrainCircuit } from 'lucide-react';

export default function Home() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex-shrink-0 h-16 border-b border-border bg-surface px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold rounded-xl flex items-center justify-center text-background shadow-md shadow-gold/20">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground">AI</span>
            <span className="font-serif text-2xl font-normal italic text-gold tracking-tight">Conclave</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center text-sm font-medium text-foreground/60">
          Self-Improving Agent <span className="text-gold mx-2">•</span> <span className="font-mono text-xs bg-border/60 text-foreground/80 px-2.5 py-1 rounded-full border border-border">Multi-Model Deliberation</span>
        </div>
      </header>
      <main className="flex-1 h-[calc(100vh-4rem)]">
        <AppUI />
      </main>
    </div>
  );
}
