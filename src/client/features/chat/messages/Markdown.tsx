import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseReferenceHref, type ReferenceTarget } from "@shared/references/links";

const STYLES = [
  "min-w-0 text-[15px] leading-normal break-words",
  "[&>*+*]:mt-2 [&_li>p]:m-0",
  "[&_:is(h1,h2,h3)]:mt-4 [&_:is(h1,h2,h3)]:text-lg [&_:is(h1,h2,h3)]:leading-tight [&_:is(h1,h2,h3)]:font-extrabold [&_:is(h1,h2,h3)]:tracking-tight",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:pl-5 [&_li+li]:mt-1 [&_li::marker]:font-bold",
  "[&_a]:font-bold [&_a]:underline [&_a]:decoration-[var(--tomato)] [&_a]:decoration-2 [&_a]:underline-offset-3",
  "[&_strong]:font-bold [&_hr]:border-border",
  "[&_code]:rounded-sm [&_code]:bg-subtle [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs",
  "[&_blockquote]:border-l [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:block [&_table]:overflow-x-auto [&_table]:text-[13px] [&_:is(th,td)]:border-b [&_:is(th,td)]:border-border [&_:is(th,td)]:px-2 [&_:is(th,td)]:py-1 [&_th]:text-left [&_th]:font-bold [&_td]:tabular-nums",
].join(" ");

export type OpenReference = (target: ReferenceTarget, link: HTMLAnchorElement) => void;

/** Assistant text. In-app links (#repas/12) navigate in place; the rest open in a new tab. */
export function Markdown({ children, onReference }: { children: string; onReference?: OpenReference }) {
  return (
    <div className={STYLES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, href, ...props }) => {
            const citation = parseReferenceHref(href);
            if (onReference && citation) {
              return <a href={href} {...props} onClick={(event) => {
                event.preventDefault();
                onReference(citation, event.currentTarget);
              }} />;
            }
            return href?.startsWith("#") ? <a href={href} {...props} /> : <a href={href} target="_blank" rel="noreferrer" {...props} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
