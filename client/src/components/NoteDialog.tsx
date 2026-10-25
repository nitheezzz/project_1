import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Note } from "../../../drizzle/schema";
import { useEffect, useState } from "react";

export type NoteDraft = {
  date: string;
  title: string;
  body: string;
  category: "study" | "planning" | "reflection";
};

function makeDraft(note: Note | null | undefined, date: string): NoteDraft {
  return note
    ? {
        date: note.date,
        title: note.title,
        body: note.body ?? "",
        category: note.category,
      }
    : { date, title: "", body: "", category: "study" };
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  date,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  date: string;
  saving: boolean;
  onSave: (draft: NoteDraft) => void;
}) {
  const [draft, setDraft] = useState(() => makeDraft(note, date));
  useEffect(() => {
    if (open) setDraft(makeDraft(note, date));
  }, [open, note, date]);
  const change = <K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New daily note"}</DialogTitle>
          <DialogDescription>
            Keep a study thought, a plan, or a small reflection for this day.
          </DialogDescription>
        </DialogHeader>
        <form
          className="form-stack"
          onSubmit={event => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <label className="field-label">
            Note title
            <input
              className="field-control"
              autoFocus
              required
              maxLength={240}
              placeholder="A thought worth keeping"
              value={draft.title}
              onChange={event => change("title", event.target.value)}
            />
          </label>
          <div className="form-two-columns">
            <label className="field-label">
              For this day
              <input
                className="field-control"
                type="date"
                required
                value={draft.date}
                onChange={event => change("date", event.target.value)}
              />
            </label>
            <label className="field-label">
              Note type
              <select
                className="field-control"
                value={draft.category}
                onChange={event =>
                  change(
                    "category",
                    event.target.value as NoteDraft["category"]
                  )
                }
              >
                <option value="study">Study note</option>
                <option value="planning">Planning</option>
                <option value="reflection">Reflection</option>
              </select>
            </label>
          </div>
          <label className="field-label">
            Your note
            <textarea
              className="field-control field-textarea note-textarea"
              maxLength={12000}
              placeholder="Write it down while it’s fresh…"
              value={draft.body}
              onChange={event => change("body", event.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !draft.title.trim()}
              className="primary-button"
            >
              {saving ? "Saving…" : "Save note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
