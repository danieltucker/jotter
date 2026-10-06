import type { MarkdownStorage } from "tiptap-markdown";

declare module "@tiptap/core" {
  interface Storage {
    // `parser` exists at runtime but is missing from tiptap-markdown's types.
    markdown: MarkdownStorage & { parser: { parse(markdown: string): string } };
  }
}
