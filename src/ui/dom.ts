type Child = Node | string | undefined | false;

/** Creates an element; text children are inserted as text, never HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & {
    className?: string;
    attrs?: Record<string, string>;
  } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const { attrs, ...rest } = props;
  const el = Object.assign(document.createElement(tag), rest);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    el.setAttribute(name, value);
  }
  for (const child of children) {
    if (child !== undefined && child !== false) el.append(child);
  }
  return el;
}

/** Reads a CSS custom property from the document root. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
