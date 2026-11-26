/** Build navigation from the sanitized headings of one document. */
export function addMarkdownOutline(container: HTMLElement): void {
  const headings = [...container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')]
    .filter(heading => !heading.closest('blockquote, pre, code'))
    .map(heading => ({ heading, label: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '', level: Number(heading.tagName.slice(1)) }))
    .filter(entry => entry.label);
  if (!headings.length) return;

  const doc = container.ownerDocument;
  const details = doc.createElement('details');
  details.className = 'markdown-outline';
  const summary = doc.createElement('summary');
  summary.textContent = '目录';
  const nav = doc.createElement('nav');
  nav.setAttribute('aria-label', '正文目录');
  const list = doc.createElement('ul');
  const levels: number[] = [];
  for (const { heading, label, level } of headings) {
    while (levels.length && levels[levels.length - 1] >= level) levels.pop();
    const item = doc.createElement('li');
    item.dataset.outlineDepth = String(levels.length);
    levels.push(level);
    const jump = doc.createElement('button');
    jump.type = 'button';
    jump.textContent = label;
    jump.addEventListener('click', () => {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    });
    item.append(jump);
    list.append(item);
  }
  nav.append(list);
  details.append(summary, nav);
  container.prepend(details);
}
