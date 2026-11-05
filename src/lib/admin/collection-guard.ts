import { EDITABLE_COLLECTIONS, type EditableCollection } from "@/lib/types";

export type Row = { id: string } & Record<string, unknown>;

export function isCollection(name: string): name is EditableCollection {
  return (EDITABLE_COLLECTIONS as readonly string[]).includes(name);
}
