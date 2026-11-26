import Link from "next/link";
import type { ReactNode } from "react";

/*
 * A deliberately small formatting language for pages and blog posts, so the owner
 * can write without HTML and nothing typed can run as code:
 *   ## Heading      ### Smaller heading
 *   - list item     **bold**     [link text](https://example.com)
 * Blank lines separate paragraphs.
 */
const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    parts.push(text.slice(last, match.index));
    const [whole, bold, linkText, href] = match;
    if (bold) parts.push(<strong key={match.index}>{bold}</strong>);
    else if (/^(https:\/\/|http:\/\/|mailto:|tel:)/i.test(href)) {
      parts.push(
        <a key={match.index} href={href} className="link" rel="noopener noreferrer">
          {linkText}
        </a>,
      );
    } else if (href.startsWith("/") && !href.startsWith("//")) {
      parts.push(
        <Link key={match.index} href={href} prefetch={false} className="link">
          {linkText}
        </Link>,
      );
    } else parts.push(whole);
    last = match.index + whole.length;
  }
  parts.push(text.slice(last));
  return parts;
}

type Block = { type: "h2" | "h3" | "p"; text: string } | { type: "ul"; items: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join("\n") });
    if (list.length) blocks.push({ type: "ul", items: list });
    paragraph = [];
    list = [];
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: heading[1].length === 2 ? "h2" : "h3", text: heading[2] });
    } else if (item) {
      if (paragraph.length) flush();
      list.push(item[1]);
    } else if (!line.trim()) flush();
    else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function RichText({ source }: { source: string }) {
  return (
    <div className="space-y-4 leading-7">
      {parseBlocks(source).map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2 key={i} className="pt-4 font-display text-3xl">
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={i} className="pt-2 font-display text-2xl">
              {block.text}
            </h3>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {block.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
