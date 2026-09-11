import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** GitHub-flavoured Markdown, sanitised (no raw HTML, safe links only). */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ["target", "_blank"],
      ["rel", "noreferrer noopener"],
    ],
  },
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        // A circular is the longest thing anyone reads in this application, so
        // it is typeset rather than styled: one measure, a real paragraph
        // rhythm, headings that stay inside the same family as the body, links
        // underlined from the text's own colour, and rules instead of boxes.
        "prose-kesher max-w-none",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:my-[0.9em]",
        "[&_h1]:mt-[1.6em] [&_h1]:mb-[0.5em] [&_h1]:font-heading [&_h1]:text-2xl [&_h1]:leading-tight [&_h1]:font-normal",
        "[&_h2]:mt-[1.6em] [&_h2]:mb-[0.4em] [&_h2]:font-heading [&_h2]:text-xl [&_h2]:leading-tight [&_h2]:font-normal",
        "[&_h3]:mt-[1.4em] [&_h3]:mb-[0.3em] [&_h3]:font-sans [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:tracking-[0.01em]",
        "[&_a]:text-foreground [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-[3px] [&_a:hover]:decoration-primary",
        "[&_blockquote]:my-[1.2em] [&_blockquote]:border-l-2 [&_blockquote]:border-l-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
        "[&_li]:my-[0.25em] [&_li]:pl-1 [&_ol]:my-[0.9em] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-[0.9em] [&_ul]:list-disc [&_ul]:pl-5",
        "[&_hr]:my-[2em] [&_hr]:border-rule",
        "[&_strong]:font-semibold",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_table]:my-[1.2em] [&_table]:w-full [&_table]:border-collapse [&_table]:font-sans [&_table]:text-sm",
        "[&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-b [&_td]:border-rule [&_td]:px-2 [&_td]:py-1.5",
        "[&_img]:my-[1.2em] [&_img]:rounded-lg [&_img]:border [&_img]:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
