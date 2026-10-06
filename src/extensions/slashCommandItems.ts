import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  /** Extra search terms, e.g. markdown shorthand like "h2" or "ul". */
  aliases?: string[];
  command: (args: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: "Text",
    aliases: ["p", "paragraph", "plain"],
    description: "Plain paragraph",
    icon: "¶",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    aliases: ["h1", "#", "title"],
    description: "Big section heading",
    icon: "H1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    aliases: ["h2", "##", "subtitle"],
    description: "Medium section heading",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    aliases: ["h3", "###"],
    description: "Small section heading",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    aliases: ["ul", "-", "*", "bullets", "unordered"],
    description: "Simple bullet list",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    aliases: ["ol", "1.", "ordered"],
    description: "List with numbers",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "To-do List",
    aliases: ["todo", "task", "checkbox", "check", "[]"],
    description: "Track tasks with checkboxes",
    icon: "☑",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    aliases: ["blockquote", ">"],
    description: "Capture a quote",
    icon: "❝",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    aliases: ["code", "```", "pre"],
    description: "Monospaced code block",
    icon: "</>",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    aliases: ["hr", "---", "rule", "line", "separator"],
    description: "Horizontal divider line",
    icon: "—",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "");

/** Matches the title ("heading 2", "heading2", "head") or any alias ("h2"). */
export function matchesQuery(item: SlashCommandItem, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(item.title).includes(q) || (item.aliases ?? []).some((alias) => normalize(alias).startsWith(q));
}
