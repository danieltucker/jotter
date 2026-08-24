import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SlashCommandItem } from "./slashCommandItems";

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelected(0), [items]);

    useEffect(() => {
      itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelected((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          select(selected);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return <div className="slash-menu slash-menu-empty">No matches</div>;
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => (
          <button
            key={item.title}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            className={`slash-menu-item${index === selected ? " is-selected" : ""}`}
            onClick={() => select(index)}
            onMouseEnter={() => setSelected(index)}
          >
            <span className="slash-menu-icon">{item.icon}</span>
            <span className="slash-menu-text">
              <span className="slash-menu-title">{item.title}</span>
              <span className="slash-menu-desc">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);
SlashCommandList.displayName = "SlashCommandList";
