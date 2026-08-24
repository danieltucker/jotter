import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRef, type MouseEvent } from "react";
import { SlashCommand } from "./extensions/SlashCommand";
import { BoldIcon, BulletListIcon, CodeIcon, HeadingIcon, ItalicIcon, StrikeIcon, TodoIcon } from "./icons";
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
      handlePaste: handleImagePaste,
    },
  });

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
