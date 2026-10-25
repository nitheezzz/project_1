import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task } from "../../../drizzle/schema";
import { useEffect, useState } from "react";

export type TaskDraft = {
  title: string;
  details: string;
  dueDate: string;
  dueTime: string;
  assignee: string;
  studyContext: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "normal" | "high";
};

function makeDraft(task: Task | null | undefined, date: string): TaskDraft {
  return task
    ? {
        title: task.title,
        details: task.details ?? "",
        dueDate: task.dueDate ?? "",
        dueTime: task.dueTime || "17:00",
        assignee: task.assignee ?? "",
        studyContext: task.studyContext ?? "",
        status: task.status,
        priority: task.priority,
      }
    : {
        title: "",
        details: "",
        dueDate: date,
        dueTime: "17:00",
        assignee: "",
        studyContext: "",
        status: "todo",
        priority: "normal",
      };
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  date,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  date: string;
  saving: boolean;
  onSave: (draft: TaskDraft) => void;
}) {
  const [draft, setDraft] = useState(() => makeDraft(task, date));
  useEffect(() => {
    if (open) setDraft(makeDraft(task, date));
  }, [open, task, date]);
  const change = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-panel">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add a task"}</DialogTitle>
          <DialogDescription>
            Set a date and time deadline, then choose who owns the task.
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
            Task name
            <input
              className="field-control"
              autoFocus
              required
              maxLength={240}
              placeholder="e.g. Review organic chemistry notes"
              value={draft.title}
              onChange={event => change("title", event.target.value)}
            />
          </label>
          <div className="form-two-columns">
            <label className="field-label">
              Due date
              <input
                className="field-control"
                type="date"
                required
                value={draft.dueDate}
                onChange={event => change("dueDate", event.target.value)}
              />
            </label>
            <label className="field-label">
              Due time (local)
              <input
                className="field-control"
                type="time"
                required
                value={draft.dueTime}
                onChange={event => change("dueTime", event.target.value)}
              />
            </label>
          </div>
          <div className="form-two-columns">
            <label className="field-label">
              Assign to
              <input
                className="field-control"
                maxLength={160}
                placeholder="You or a teammate"
                value={draft.assignee}
                onChange={event => change("assignee", event.target.value)}
              />
            </label>
          </div>
          <div className="form-two-columns">
            <label className="field-label">
              Study context
              <input
                className="field-control"
                maxLength={180}
                placeholder="Biology · Chapter 4"
                value={draft.studyContext}
                onChange={event => change("studyContext", event.target.value)}
              />
            </label>
            <label className="field-label">
              Priority
              <select
                className="field-control"
                value={draft.priority}
                onChange={event =>
                  change(
                    "priority",
                    event.target.value as TaskDraft["priority"]
                  )
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="field-label">
            Progress
            <select
              className="field-control"
              value={draft.status}
              onChange={event =>
                change("status", event.target.value as TaskDraft["status"])
              }
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Completed</option>
            </select>
          </label>
          <label className="field-label">
            Details <span className="field-optional">Optional</span>
            <textarea
              className="field-control field-textarea"
              maxLength={12000}
              placeholder="Add a little more context for later…"
              value={draft.details}
              onChange={event => change("details", event.target.value)}
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
              {saving ? "Saving…" : task ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
