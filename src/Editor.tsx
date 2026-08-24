import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRef, type MouseEvent } from "react";
import { SlashCommand } from "./extensions/SlashCommand";

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

  return <EditorContent editor={editor} className="note-editor" onClick={handleClick} />;
}
