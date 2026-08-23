export type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "gray";

export interface Note {
  id: string;
  content: string;
  color: NoteColor;
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
  createdAt: string;
  updatedAt: string;
}
