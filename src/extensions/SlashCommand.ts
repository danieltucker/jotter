import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { exitSuggestion, type SuggestionOptions } from "@tiptap/suggestion";
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
