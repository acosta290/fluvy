/** Calls `visit` for every element under `root`, looking through open shadow roots (up to `maxDepth` of them deep). */
export function walkShadow(
  root: ParentNode,
  visit: (element: Element) => void,
  maxDepth = 12,
): void {
  const walk = (node: ParentNode, depth: number): void => {
    for (const element of node.querySelectorAll('*')) {
      visit(element);
      if (element.shadowRoot && depth < maxDepth) walk(element.shadowRoot, depth + 1);
    }
  };
  walk(root, 0);
}

/** Puts `sheet` last among a root's adopted sheets (last wins at equal specificity); a no-op when it already is. */
export function adoptLast(root: DocumentOrShadowRoot, sheet: CSSStyleSheet): void {
  const sheets = root.adoptedStyleSheets;
  if (sheets[sheets.length - 1] === sheet) return;
  root.adoptedStyleSheets = [...sheets.filter((s) => s !== sheet), sheet];
}
