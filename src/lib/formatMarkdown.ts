/**
 * High-performance, zero-dependency Markdown to HTML formatter for AI Conclave
 * Accurately parses bold, italic, headings, lists, quotes, code, and links.
 */

export function formatMarkdown(text: string): string {
  if (!text) return '';

  // 1. Strip search status notice & normalize line endings
  let md = text
    .replace(/\*?\*?\(Initializing BrightData Web Search.*?\)\*?\*?\s*/gi, '')
    .replace(/\r\n/g, '\n');

  // 2. Fenced Code Blocks (```lang ... ```)
  md = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="my-4 rounded-xl overflow-hidden border border-border bg-surface-dark shadow-sm">
      ${lang ? `<div class="px-4 py-1.5 bg-border/40 text-[11px] font-mono text-foreground/60 uppercase tracking-wider font-semibold">${lang}</div>` : ''}
      <pre class="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-foreground/90"><code>${escaped}</code></pre>
    </div>`;
  });

  // 3. Process line by line
  const lines = md.split('\n');
  const output: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Preserve raw code block html
    if (
      rawLine.includes('<div class="my-4 rounded-xl') ||
      rawLine.includes('</div>') ||
      rawLine.includes('<pre class="p-4')
    ) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      output.push(rawLine);
      continue;
    }

    const trimmed = rawLine.trim();

    // Headers
    const h3Match = rawLine.match(/^###\s+(.*)/);
    const h2Match = rawLine.match(/^##\s+(.*)/);
    const h1Match = rawLine.match(/^#\s+(.*)/);
    const h4Match = rawLine.match(/^####\s+(.*)/);

    if (h1Match || h2Match || h3Match || h4Match) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }

      if (h1Match) {
        output.push(`<h1 class="text-2xl font-serif font-bold text-foreground mt-5 mb-2">${formatInline(h1Match[1])}</h1>`);
      } else if (h2Match) {
        output.push(`<h2 class="text-xl font-serif font-bold text-foreground mt-4 mb-2">${formatInline(h2Match[1])}</h2>`);
      } else if (h3Match) {
        output.push(`<h3 class="text-base font-serif font-semibold text-gold mt-4 mb-1.5">${formatInline(h3Match[1])}</h3>`);
      } else if (h4Match) {
        output.push(`<h4 class="text-sm font-serif font-semibold text-foreground/90 mt-3 mb-1">${formatInline(h4Match[1])}</h4>`);
      }
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      output.push('<hr class="my-4 border-border/60" />');
      continue;
    }

    // Blockquote
    const bqMatch = rawLine.match(/^>\s*(.*)/);
    if (bqMatch) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      output.push(`<blockquote class="border-l-4 border-gold/70 pl-4 py-1.5 my-2.5 bg-gold/5 rounded-r-lg text-foreground/80 italic font-sans text-sm">${formatInline(bqMatch[1])}</blockquote>`);
      continue;
    }

    // Unordered List (- or *)
    const ulMatch = rawLine.match(/^(\s*)[-*]\s+(.*)/);
    if (ulMatch) {
      if (inOl) { output.push('</ol>'); inOl = false; }
      if (!inUl) {
        output.push('<ul class="list-disc pl-5 my-2 space-y-1.5 font-sans text-sm text-foreground/90">');
        inUl = true;
      }
      output.push(`<li>${formatInline(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered List (1. )
    const olMatch = rawLine.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (!inOl) {
        output.push('<ol class="list-decimal pl-5 my-2 space-y-1.5 font-sans text-sm text-foreground/90">');
        inOl = true;
      }
      output.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // Blank line
    if (!trimmed) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      output.push('<div class="h-2"></div>');
      continue;
    }

    // Normal paragraph line
    if (inUl) { output.push('</ul>'); inUl = false; }
    if (inOl) { output.push('</ol>'); inOl = false; }
    output.push(`<p class="leading-relaxed font-sans text-sm text-foreground/90 mb-2">${formatInline(rawLine)}</p>`);
  }

  if (inUl) output.push('</ul>');
  if (inOl) output.push('</ol>');

  return output.join('\n');
}

/**
 * Parses inline formatting: code, bold, italic, links
 */
function formatInline(text: string): string {
  if (!text) return '';

  return text
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code class="bg-surface-dark px-1.5 py-0.5 rounded text-gold font-mono text-xs border border-border/80 font-medium">$1</code>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/__(.+?)__/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic: *text* or _text_ (excluding inside words like some_var_name)
    .replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em class="italic text-foreground/80">$2</em>$3')
    .replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em class="italic text-foreground/80">$2</em>$3')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-gold underline hover:text-gold-light font-medium">$1</a>');
}
