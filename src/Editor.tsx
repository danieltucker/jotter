import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { listen, openUrl } from "./bridge";
import { useEffect, useRef, type MouseEvent } from "react";
import { SlashCommand } from "./extensions/SlashCommand";
import { BoldIcon, BulletListIcon, CodeIcon, HeadingIcon, ItalicIcon, StrikeIcon, TodoIcon } from "./icons";
import type { Editor } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

// Pasted images are inlined as base64 data URLs directly in the note's
// markdown content, so notes stay single, self-contained files with no
// separate image assets to track or clean up on delete.
function handleImagePaste(view: EditorView, event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  if (files.length === 0) return false;

  event.preventDefault();
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== "string") return;
      const node = view.state.schema.nodes.image.create({ src });
      view.dispatch(view.state.tr.replaceSelectionWith(node));
    };
    reader.readAsDataURL(file);
  }
  return true;
}

const MARKDOWN_BLOCK = /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|~~~|(-\s*){3,}$|(\*\s*){3,}$)/m;
const MARKDOWN_INLINE = /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)/;

// tiptap-markdown only converts pasted text when the clipboard holds plain
// text alone, but most sources (code editors, browsers, chat apps) add an
// HTML flavor too, which ProseMirror prefers. When the plain text is
// visibly markdown, parse that instead.
function handleMarkdownPaste(view: EditorView, event: ClipboardEvent) {
  const data = event.clipboardData;
  const text = data?.getData("text/plain");
  if (!data || !text) return false;
  if (data.getData("text/html").includes("data-pm-slice")) return false;
  if (view.state.selection.$from.parent.type.spec.code) return false;
  if (!MARKDOWN_BLOCK.test(text) && !MARKDOWN_INLINE.test(text)) return false;

  const editor = (view.dom as HTMLElement & { editor?: Editor }).editor;
  if (!editor) return false;
  event.preventDefault();
  const container = document.createElement("div");
  container.innerHTML = editor.storage.markdown.parser.parse(text);
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}

function handlePaste(view: EditorView, event: ClipboardEvent) {
  return handleImagePaste(view, event) || handleMarkdownPaste(view, event);
}

interface NoteEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
}

export function NoteEditor({ content, onChange, onBlur }: NoteEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type '/' for commands…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: true }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
      }),
      SlashCommand,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.storage.markdown.getMarkdown());
    },
    onBlur: () => {
      onBlurRef.current?.();
    },
    editorProps: {
      attributes: {
        class: "note-prose",
        spellcheck: "true",
      },
      handlePaste,
    },
  });

  // The macOS Edit menu owns ⌘Z/⇧⌘Z, so route those to ProseMirror's history
  // rather than WebKit's native undo stack, which knows nothing about it.
  useEffect(() => {
    if (!editor) return;
    const offUndo = listen("undo", () => editor.chain().focus().undo().run());
    const offRedo = listen("redo", () => editor.chain().focus().redo().run());
    const offFocus = listen("focus", () => editor.commands.focus("end"));
    return () => {
      offUndo();
      offRedo();
      offFocus();
    };
  }, [editor]);

  // Link.openOnClick is off (so a plain click positions the cursor in the
  // link text for editing, rather than always navigating away), and the
  // extension doesn't add its own ctrl/cmd+click fallback. Add one here.
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor?.href) return;
    event.preventDefault();
    openUrl(anchor.href).catch(() => {});
  };

  const activeMarks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      strike: editor?.isActive("strike") ?? false,
      code: editor?.isActive("code") ?? false,
      heading: editor?.isActive("heading", { level: 2 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      taskList: editor?.isActive("taskList") ?? false,
    }),
  });

  return (
    <>
      <EditorContent editor={editor} className="note-editor" onClick={handleClick} />
      <BubbleMenu editor={editor} className="bubble-menu">
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.bold ? " is-active" : ""}`}
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </button>
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.italic ? " is-active" : ""}`}
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </button>
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.strike ? " is-active" : ""}`}
          title="Strikethrough"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <StrikeIcon />
        </button>
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.code ? " is-active" : ""}`}
          title="Code"
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <CodeIcon />
        </button>
        <div className="bubble-menu-sep" />
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.heading ? " is-active" : ""}`}
          title="Heading"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <HeadingIcon />
        </button>
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.bulletList ? " is-active" : ""}`}
          title="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon />
        </button>
        <button
          type="button"
          className={`bubble-menu-btn${activeMarks.taskList ? " is-active" : ""}`}
          title="To-do list"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <TodoIcon />
        </button>
      </BubbleMenu>
    </>
  );
}
