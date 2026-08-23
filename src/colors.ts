import type { NoteColor } from "./types";

interface ColorDef {
  label: string;
  bg: string;
  header: string;
  swatch: string;
  ink: string;
}

export const COLORS: Record<NoteColor, ColorDef> = {
  yellow: { label: "Yellow", bg: "#fdee9a", header: "#f8e372", swatch: "#f5d93f", ink: "#4a4325" },
  pink: { label: "Pink", bg: "#f8cfe0", header: "#f4b8d0", swatch: "#ef8bb6", ink: "#4a2634" },
  blue: { label: "Blue", bg: "#bfe3f7", header: "#a0d5f0", swatch: "#5cb4e3", ink: "#1c3a4a" },
  green: { label: "Green", bg: "#cdeac2", header: "#b3e0a3", swatch: "#79c95f", ink: "#26411c" },
  purple: { label: "Purple", bg: "#ddccf3", header: "#c9aeed", swatch: "#a678e0", ink: "#332347" },
  gray: { label: "Gray", bg: "#e4e4e4", header: "#d4d4d4", swatch: "#a3a3a3", ink: "#2c2c2c" },
};

export const COLOR_ORDER: NoteColor[] = ["yellow", "pink", "blue", "green", "purple", "gray"];
