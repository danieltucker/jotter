import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { exitSuggestion, type SuggestionOptions } from "@tiptap/suggestion";
import { matchesQuery, SLASH_COMMAND_ITEMS, type SlashCommandItem } from "./slashCommandItems";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

const GAP = 4;
const EDGE = 8;

/**
 * Places the menu next to the caret inside the note's small window: below
 * if it fits, otherwise on whichever side has more room, with its height
 * capped to that room so it scrolls instead of running off the window.
 * Positioned by hand rather than with Floating UI's flip/size middleware,
 * whose resize feedback loop could settle on the cramped side.
 */
function positionMenu(popup: HTMLElement, caret: DOMRect) {
  const menu = (popup.firstElementChild as HTMLElement | null) ?? popup;
  menu.style.maxHeight = "";
  menu.style.maxWidth = `${Math.max(window.innerWidth - EDGE * 2, 0)}px`;

  const header = document.querySelector(".note-header")?.getBoundingClientRect().bottom ?? 0;
  const natural = menu.offsetHeight;
  const below = window.innerHeight - caret.bottom - GAP - EDGE;
  const above = caret.top - GAP - EDGE - header;
  const placeBelow = natural <= below || below >= above;
  const height = Math.min(natural, Math.max(placeBelow ? below : above, 0));

  menu.style.maxHeight = `${height}px`;
  const width = menu.offsetWidth;
  const left = Math.min(Math.max(caret.left, EDGE), window.innerWidth - width - EDGE);
  popup.style.left = `${Math.max(left, EDGE)}px`;
  popup.style.top = `${placeBelow ? caret.bottom + GAP : caret.top - GAP - height}px`;
}

const suggestion: Omit<SuggestionOptions<SlashCommandItem, SlashCommandItem>, "editor"> = {
  char: "/",
  startOfLine: false,
  items: ({ query }) => SLASH_COMMAND_ITEMS.filter((item) => matchesQuery(item, query)),
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListRef, { items: SlashCommandItem[]; command: (item: SlashCommandItem) => void }>;
    let getCaret: (() => DOMRect | null) | null | undefined;
    let frame = 0;

    // Item changes re-render the list, so measure again once React commits.
    const reposition = () => {
      cancelAnimationFrame(frame);
      const place = () => {
        const caret = getCaret?.();
        if (caret) positionMenu(component.element as HTMLElement, caret);
      };
      place();
      frame = requestAnimationFrame(place);
    };

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: (item: SlashCommandItem) => props.command(item),
          },
          editor: props.editor,
          className: "slash-menu-popup",
        });
        getCaret = props.clientRect;
        document.body.appendChild(component.element);
        reposition();
      },
      onUpdate: (props) => {
        component.updateProps({
          items: props.items,
          command: (item: SlashCommandItem) => props.command(item),
        });
        getCaret = props.clientRect;
        reposition();
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          exitSuggestion(props.view);
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        cancelAnimationFrame(frame);
        component.element.remove();
        component.destroy();
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return { suggestion };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
