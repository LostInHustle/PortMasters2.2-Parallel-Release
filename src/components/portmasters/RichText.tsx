/**
 * The one door authored copy reaches the browser as HTML.
 *
 * Two surfaces need markup and cannot do without it. The tutorial's
 * pages are written as pages: a list of rules, a pair of cards, a bold
 * word in the middle of a sentence. A sentence in the tree that wants
 * one bold word in it asks for the same thing, and there is no layout
 * the browser can do that a text node cannot. Everything else in the
 * tree is text, and this component is deliberately the only way for the
 * other kind in.
 *
 * The strings that come through here are written in this repository and
 * carry nothing a captain typed, so the private scan's fifth rule names
 * this file as the one site and reads the rest of the tree as text.
 * That rule is worth reading: it exists so that a second door cannot
 * appear without someone writing down why, and a door that is a
 * component is a door the tree can point at.
 */
export function RichText({
  html,
  className,
}: {
  /** The authored markup. It is trusted because it is ours. */
  html: string;
  className?: string;
}) {
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
