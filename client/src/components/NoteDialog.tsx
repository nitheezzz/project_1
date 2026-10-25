import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Note } from "../../../drizzle/schema";
import { FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type NoteDraft = {
  date: string;
  title: string;
  body: string;
  category: "study" | "planning" | "reflection";
  pdfFile: File | null;
};

function makeDraft(note: Note | null | undefined, date: string): NoteDraft {
  return note
    ? {
        date: note.date,
        title: note.title,
        body: note.body ?? "",
        category: note.category,
        pdfFile: null,
      }
    : { date, title: "", body: "", category: "study", pdfFile: null };
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
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setDraft(makeDraft(note, date));
      setFileError("");
    }
  }, [open, note, date]);
  const change = <K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New daily note"}</DialogTitle>
          <DialogDescription>
            Keep a study thought, a plan, a reflection, or attach a PDF for this
            day.
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
          <div className="field-label">
            <span>
              PDF study material{" "}
              <span className="field-optional">Optional · up to 8 MB</span>
            </span>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Attach a PDF study material"
              onChange={event => {
                const file = event.currentTarget.files?.[0] ?? null;
                setFileError("");
                if (!file) return;
                if (
                  !file.name.toLowerCase().endsWith(".pdf") ||
                  (file.type && file.type !== "application/pdf")
                ) {
                  setFileError("Choose a PDF file.");
                  event.currentTarget.value = "";
                  return;
                }
                if (file.size > 8 * 1024 * 1024) {
                  setFileError("PDFs must be 8 MB or smaller.");
                  event.currentTarget.value = "";
                  return;
                }
                change("pdfFile", file);
              }}
            />
            {draft.pdfFile ? (
              <span className="pdf-selected-file">
                <FileText size={15} />
                <span>{draft.pdfFile.name}</span>
                <button
                  type="button"
                  aria-label="Remove selected PDF"
                  onClick={() => {
                    change("pdfFile", null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ) : note?.pdfFileName ? (
              <>
                <span className="pdf-selected-file">
                  <FileText size={15} />
                  <span>Current file: {note.pdfFileName}</span>
                </span>
                <button
                  type="button"
                  className="pdf-replace-button"
                  onClick={() => fileInput.current?.click()}
                >
                  Replace PDF
                </button>
              </>
            ) : (
              <button
                type="button"
                className="pdf-picker-button"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} /> Choose a PDF
              </button>
            )}
            {draft.pdfFile && (
              <button
                type="button"
                className="pdf-replace-button"
                onClick={() => fileInput.current?.click()}
              >
                Choose a different PDF
              </button>
            )}
            {fileError && <span className="inline-error">{fileError}</span>}
          </div>
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
              disabled={saving || !draft.title.trim() || Boolean(fileError)}
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
