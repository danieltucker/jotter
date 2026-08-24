import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { exitSuggestion, type SuggestionOptions } from "@tiptap/suggestion";
import { flip, shift, size, type Middleware } from "@floating-ui/dom";
import { SLASH_COMMAND_ITEMS, type SlashCommandItem } from "./slashCommandItems";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

const suggestion: Omit<SuggestionOptions<SlashCommandItem, SlashCommandItem>, "editor"> = {
  char: "/",
  startOfLine: false,
  items: ({ query }) =>
    SLASH_COMMAND_ITEMS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())),
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  // Each note is its own small, fixed-size window, so the menu has far less
  // room to work with than a typical webpage.
  //
  // `elements.floating` in the middleware below is the wrapper
  // @tiptap/react's ReactRenderer creates, not the `.slash-menu` div
  // SlashCommandList renders inside it. Sizing the wrapper alone does
  // nothing visible: it has no overflow clipping of its own, so
  // `.slash-menu`'s CSS width/max-height just renders past the wrapper's
  // edge unclipped. Every middleware below targets the actual menu element
  // (the wrapper's first child) instead, so `size`'s constraint overrides
  // that CSS via inline-style specificity and the menu's own
  // `overflow-y: auto` does the scrolling within the real available space.
  //
  // `flip` is disabled at the top level and re-added ourselves as the first
  // middleware below, ahead of a `resetSize` step. Reason: `size`'s `apply`
  // shrinks the menu element directly, which trips the ResizeObserver
  // `autoUpdate` uses to reposition on any size change. On that next pass,
  // if `flip` ran first (the library's default order), it would measure the
  // *already-shrunk* element from last time — which now looks like it fits
  // on the cramped side — and conclude there's no need to flip, converging
  // on "tiny menu on the wrong side" instead of flipping to the side with
  // real room. `resetSize` clears the inline max-height/width we set last
  // time (falling back to the CSS default) before `flip` ever measures, so
  // every pass sees the menu's natural size, not last pass's leftovers.
  flip: false,
  floatingUi: {
    middleware: [
      {
        name: "resetSize",
        fn: ({ elements }) => {
          const menu = (elements.floating.firstElementChild as HTMLElement | null) ?? elements.floating;
          menu.style.maxHeight = "";
          menu.style.maxWidth = "";
          return {};
        },
      } satisfies Middleware,
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableWidth, availableHeight, elements }) => {
          const menu = (elements.floating.firstElementChild as HTMLElement | null) ?? elements.floating;
          menu.style.maxHeight = `${Math.max(availableHeight, 0)}px`;
          menu.style.maxWidth = `${Math.max(availableWidth, 0)}px`;
        },
      }),
    ],
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListRef, { items: SlashCommandItem[]; command: (item: SlashCommandItem) => void }>;
    let unmount: (() => void) | undefined;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props: {
            items: props.items,
            command: (item: SlashCommandItem) => props.command(item),
          },
          editor: props.editor,
        });
        unmount = props.mount(component.element);
      },
      onUpdate: (props) => {
        component.updateProps({
          items: props.items,
          command: (item: SlashCommandItem) => props.command(item),
        });
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          exitSuggestion(props.view);
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        unmount?.();
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
