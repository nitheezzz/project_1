import { useAuth } from "@/_core/hooks/useAuth";
import { NoteDialog, type NoteDraft } from "@/components/NoteDialog";
import { TaskDialog, type TaskDraft } from "@/components/TaskDialog";
import { Button } from "@/components/ui/button";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { trpc } from "@/lib/trpc";
import type { Note, Task } from "../../../drizzle/schema";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  ListTodo,
  LogOut,
  Music2,
  NotebookPen,
  PanelTop,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.28, ease: "easeOut" as const },
};

type View = "today" | "tasks" | "notes";
type TaskStatus = "todo" | "in_progress" | "done";

const navItems: { id: View; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "tasks", label: "My tasks", icon: ListTodo },
  { id: "notes", label: "Study notes", icon: NotebookPen },
];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function keyFromDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDay(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  }
) {
  return new Intl.DateTimeFormat("en", options).format(dateFromKey(value));
}

function formatShortDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(dateFromKey(value));
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize)
    );
  }
  return btoa(binary);
}

function statusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In progress";
  return status === "done" ? "Completed" : "To do";
}

function priorityLabel(priority: Task["priority"]) {
  return priority === "normal"
    ? "Normal"
    : `${priority[0].toUpperCase()}${priority.slice(1)}`;
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`brand-mark ${small ? "brand-mark-small" : ""}`}
      aria-hidden="true"
    >
      <span />
      <Check size={small ? 10 : 12} strokeWidth={3} />
    </span>
  );
}

function LoadingScreen() {
  return (
    <div className="auth-loading" aria-label="Loading your workspace">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      >
        <BrandMark />
      </motion.div>
      <span>Opening your workspace…</span>
    </div>
  );
}

function AccountScreen() {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const registerMutation = trpc.account.register.useMutation();
  const loginMutation = trpc.account.login.useMutation();
  const utils = trpc.useUtils();
  const busy = registerMutation.isPending || loginMutation.isPending;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Those passwords don’t match yet.");
      return;
    }
    try {
      if (mode === "register") {
        await registerMutation.mutateAsync({ username, password });
        toast.success("Your studywithfun account is ready.");
      } else {
        await loginMutation.mutateAsync({ username, password });
        toast.success("Welcome back.");
      }
      await utils.account.me.invalidate();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again."
      );
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
  };

  return (
    <main className="auth-screen">
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="auth-brand">
          <BrandMark />
          <span>studywithfun</span>
          <span className="brand-dot">.</span>
        </div>
        <div className="auth-intro">
          <span className="eyebrow">
            <Sparkles size={13} /> YOUR QUIETER CORNER
          </span>
          <h1>
            {mode === "register" ? (
              <>
                A little more
                <br />
                <em>room to focus.</em>
              </>
            ) : (
              <>
                Good to see
                <br />
                <em>you again.</em>
              </>
            )}
          </h1>
          <p>
            Notes, next steps, and your study soundtrack — all in one calm
            place.
          </p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
        </div>
        <form className="form-stack auth-form" onSubmit={submit}>
          <label className="field-label">
            Username
            <input
              className="field-control"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]+"
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="e.g. studywithnitheesh"
            />
            {mode === "register" && (
              <span className="field-hint">
                3–24 characters · letters, numbers, or underscore
              </span>
            )}
          </label>
          <label className="field-label">
            Password
            <input
              className="field-control"
              required
              minLength={10}
              maxLength={128}
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={
                mode === "register" ? "At least 10 characters" : "Your password"
              }
            />
          </label>
          {mode === "register" && (
            <label className="field-label">
              Confirm password
              <input
                className="field-control"
                required
                minLength={10}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Type it once more"
              />
            </label>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="primary-button auth-submit"
          >
            {busy
              ? "One moment…"
              : mode === "register"
                ? "Create my account"
                : "Sign in to studywithfun"}
            {!busy && <ArrowRight size={16} />}
          </Button>
        </form>
        <p className="auth-footnote">
          <span className="privacy-dot" /> Your notes and tasks are private to
          your account.
        </p>
      </motion.section>
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
    </main>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
  onToggle,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggle: (task: Task) => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={`task-row ${task.status === "done" ? "task-row-done" : ""}`}
    >
      <button
        type="button"
        className={`task-check ${task.status === "done" ? "checked" : ""}`}
        onClick={() => onToggle(task)}
        aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
      >
        {task.status === "done" ? (
          <Check size={15} strokeWidth={2.8} />
        ) : (
          <Circle size={20} strokeWidth={1.5} />
        )}
      </button>
      <button
        type="button"
        className="task-main"
        onClick={() => onEdit(task)}
        aria-label={`Edit ${task.title}`}
      >
        <span className="task-title">{task.title}</span>
        <span className="task-subline">
          {task.studyContext && (
            <span className="task-context">
              <BookOpen size={12} />
              {task.studyContext}
            </span>
          )}
          {task.assignee && (
            <span className="task-assignee">
              <UsersRound size={12} />
              {task.assignee}
            </span>
          )}
          {task.dueDate && (
            <span className="task-date">
              <Clock3 size={12} />
              {formatShortDate(task.dueDate)}
            </span>
          )}
        </span>
      </button>
      <span className={`priority-pill priority-${task.priority}`}>
        <span />
        {priorityLabel(task.priority)}
      </span>
      <span className={`status-pill status-${task.status}`}>
        {statusLabel(task.status)}
      </span>
      <button
        type="button"
        className="icon-action task-delete"
        aria-label={`Delete ${task.title}`}
        onClick={() => onDelete(task)}
      >
        <Trash2 size={15} />
      </button>
    </motion.article>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
  onDownloadPdf,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onDownloadPdf: (note: Note) => void;
}) {
  const typeLabels = {
    study: "Study note",
    planning: "Planning",
    reflection: "Reflection",
  };
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`note-card note-card-${note.category}`}
    >
      <button
        type="button"
        className="note-card-main"
        onClick={() => onEdit(note)}
        aria-label={`Edit note: ${note.title}`}
      >
        <span className="note-category">
          <span className="note-category-dot" />
          {typeLabels[note.category]}
        </span>
        <span className="note-title">{note.title}</span>
        <span className="note-body">
          {note.body || "A blank page is a place to begin."}
        </span>
        {note.pdfFileName && (
          <span className="note-pdf-chip">
            <FileText size={13} /> <span>{note.pdfFileName}</span>
          </span>
        )}
        <span className="note-date">
          {formatDay(note.date, { month: "short", day: "numeric" })}{" "}
          <ArrowUpRight size={13} />
        </span>
      </button>
      {note.pdfStorageKey && (
        <button
          type="button"
          className="note-pdf-download"
          aria-label={`Download ${note.pdfFileName ?? "PDF attachment"}`}
          onClick={() => onDownloadPdf(note)}
        >
          <FileText size={13} /> PDF
        </button>
      )}
      <button
        type="button"
        className="icon-action note-delete"
        aria-label={`Delete note ${note.title}`}
        onClick={() => onDelete(note)}
      >
        <Trash2 size={14} />
      </button>
    </motion.article>
  );
}

function SpotifyCard({ userId }: { userId: number }) {
  const preferencesQuery = trpc.preferences.spotifyLink.useQuery(undefined);
  const saveLink = trpc.preferences.saveSpotifyLink.useMutation();
  const [link, setLink] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  useEffect(() => {
    if (preferencesQuery.data !== undefined)
      setLink(preferencesQuery.data ?? "");
  }, [preferencesQuery.data]);
  const savedLink = preferencesQuery.data ?? null;
  const embedUrl = spotifyEmbedUrl(savedLink);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (link && !spotifyEmbedUrl(link)) {
      setError("Paste a Spotify track, album, or playlist link.");
      return;
    }
    try {
      await saveLink.mutateAsync({ spotifyLink: link.trim() || null });
      await utils.preferences.spotifyLink.invalidate();
      setEditing(false);
      toast.success(
        link.trim() ? "Focus music saved." : "Spotify link removed."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this link."
      );
    }
  };

  return (
    <section className="panel spotify-panel" aria-labelledby="spotify-heading">
      <div className="panel-heading spotify-heading-row">
        <div className="section-title-wrap">
          <span className="section-kicker">
            <Music2 size={13} /> FOCUS SOUNDTRACK
          </span>
          <h2 id="spotify-heading">Study with music</h2>
        </div>
        <span className="spotify-mark" aria-label="Spotify">
          <Music2 size={15} />
        </span>
      </div>
      {embedUrl ? (
        <div className="spotify-player-wrap">
          <iframe
            key={`${userId}-${savedLink}`}
            title="Spotify focus music player"
            src={embedUrl}
            width="100%"
            height="352"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="spotify-player-actions">
            <button
              type="button"
              className="text-action"
              onClick={() => setEditing(value => !value)}
            >
              {editing ? "Close settings" : "Change music"}
            </button>
            <a
              className="text-action"
              href={savedLink ?? "https://open.spotify.com/"}
              target="_blank"
              rel="noreferrer"
            >
              Open Spotify <ExternalLink size={12} />
            </a>
          </div>
          {editing && (
            <form className="spotify-edit-form" onSubmit={save}>
              <input
                className="field-control"
                aria-label="Spotify music link"
                value={link}
                onChange={event => setLink(event.target.value)}
                placeholder="Paste a playlist or track link"
              />
              {error && <span className="inline-error">{error}</span>}
              <div className="spotify-form-actions">
                <button
                  className="text-action"
                  type="button"
                  onClick={() => {
                    setLink("");
                    void saveLink
                      .mutateAsync({ spotifyLink: null })
                      .then(() => utils.preferences.spotifyLink.invalidate());
                  }}
                >
                  Remove
                </button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saveLink.isPending}
                  className="primary-button"
                >
                  Save link
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="spotify-empty">
          <div className="spotify-empty-icon">
            <Music2 size={19} />
          </div>
          <p>Set a sound for your next study session.</p>
          <span>
            Paste a Spotify track, album, or playlist link and it’ll be ready
            here when you return.
          </span>
          <form className="spotify-setup-form" onSubmit={save}>
            <input
              className="field-control"
              aria-label="Spotify music link"
              value={link}
              onChange={event => setLink(event.target.value)}
              placeholder="open.spotify.com/playlist/…"
            />
            {error && <span className="inline-error">{error}</span>}
            <Button
              type="submit"
              disabled={saveLink.isPending || !link.trim()}
              className="primary-button spotify-save-button"
            >
              Save &amp; play <ArrowRight size={14} />
            </Button>
          </form>
          <a
            className="spotify-connect-link"
            href="https://open.spotify.com/"
            target="_blank"
            rel="noreferrer"
          >
            Connect to Spotify <ExternalLink size={12} />
          </a>
        </div>
      )}
      <p className="spotify-caption">
        Powered by Spotify’s embedded player. Sign in to Spotify for playback
        from your account.
      </p>
    </section>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const utils = trpc.useUtils();
  const normalizedSearch = search.trim() || undefined;
  const allTasksQuery = trpc.tasks.list.useQuery({ date: selectedDate });
  const tasksQuery = trpc.tasks.list.useQuery({
    date: selectedDate,
    status: statusFilter === "all" ? undefined : statusFilter,
    assignee: assigneeFilter === "all" ? undefined : assigneeFilter,
    search: normalizedSearch,
  });
  const notesQuery = trpc.notes.list.useQuery({
    date: selectedDate,
    search: normalizedSearch,
  });
  const createTask = trpc.tasks.create.useMutation();
  const updateTask = trpc.tasks.update.useMutation();
  const deleteTask = trpc.tasks.delete.useMutation();
  const createNote = trpc.notes.create.useMutation();
  const updateNote = trpc.notes.update.useMutation();
  const deleteNote = trpc.notes.delete.useMutation();
  const pdfDownloadUrl = trpc.notes.pdfDownloadUrl.useMutation();
  const tasks = tasksQuery.data ?? [];
  const allTasks = allTasksQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const doneCount = allTasks.filter(task => task.status === "done").length;
  const progress = allTasks.length
    ? Math.round((doneCount / allTasks.length) * 100)
    : 0;
  const assignees = useMemo(
    () =>
      Array.from(
        new Set(
          allTasks
            .map(task => task.assignee)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [allTasks]
  );
  const selectedDateLabel = formatDay(selectedDate);
  const isToday = selectedDate === todayKey();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = user?.name?.trim() || user?.username || "there";

  const invalidateData = () => {
    void utils.tasks.list.invalidate();
    void utils.notes.list.invalidate();
  };

  const submitTask = async (draft: TaskDraft) => {
    const values = {
      title: draft.title.trim(),
      details: draft.details.trim() || null,
      dueDate: draft.dueDate,
      assignee: draft.assignee.trim() || null,
      studyContext: draft.studyContext.trim() || null,
      status: draft.status,
      priority: draft.priority,
    };
    try {
      if (editingTask)
        await updateTask.mutateAsync({ id: editingTask.id, ...values });
      else await createTask.mutateAsync(values);
      invalidateData();
      setTaskDialogOpen(false);
      setEditingTask(null);
      toast.success(editingTask ? "Task updated." : "Task added to your day.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this task."
      );
    }
  };

  const submitNote = async (draft: NoteDraft) => {
    try {
      const values = {
        date: draft.date,
        title: draft.title.trim(),
        body: draft.body.trim() || null,
        category: draft.category,
        pdf: draft.pdfFile
          ? {
              fileName: draft.pdfFile.name,
              contentBase64: await fileToBase64(draft.pdfFile),
            }
          : undefined,
      };
      if (editingNote)
        await updateNote.mutateAsync({ id: editingNote.id, ...values });
      else await createNote.mutateAsync(values);
      invalidateData();
      setNoteDialogOpen(false);
      setEditingNote(null);
      toast.success(editingNote ? "Note updated." : "Note saved for the day.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this note."
      );
    }
  };

  const changeDate = (offset: number) => {
    const next = dateFromKey(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(keyFromDate(next));
  };

  const toggleTask = async (task: Task) => {
    const status: TaskStatus = task.status === "done" ? "todo" : "done";
    try {
      await updateTask.mutateAsync({ id: task.id, status });
      invalidateData();
      toast.success(
        status === "done" ? "Nicely done." : "Task moved back to to do."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update this task."
      );
    }
  };

  const removeTask = async (task: Task) => {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`))
      return;
    try {
      await deleteTask.mutateAsync({ id: task.id });
      invalidateData();
      toast.success("Task deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this task."
      );
    }
  };

  const removeNote = async (note: Note) => {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`))
      return;
    try {
      await deleteNote.mutateAsync({ id: note.id });
      invalidateData();
      toast.success("Note deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this note."
      );
    }
  };

  const downloadNotePdf = async (note: Note) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const result = await pdfDownloadUrl.mutateAsync({ id: note.id });
      if (tab) tab.location.href = result.url;
      else window.location.assign(result.url);
    } catch (error) {
      tab?.close();
      toast.error(
        error instanceof Error ? error.message : "Could not open this PDF."
      );
    }
  };

  const openTask = (task: Task | null = null) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };
  const openNote = (note: Note | null = null) => {
    setEditingNote(note);
    setNoteDialogOpen(true);
  };
  const handleLogout = async () => {
    try {
      await logout();
      toast.success("You’re signed out.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sign out."
      );
    }
  };

  if (!user) return null;
  const showTasks = view !== "notes";
  const showNotes = view !== "tasks";

  return (
    <motion.div className="app-frame" {...pageMotion}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <span>
            studywithfun<span className="brand-dot">.</span>
          </span>
          <span className="workspace-label">YOUR SPACE</span>
        </div>
        <div className="sidebar-group-label">WORKSPACE</div>
        <nav className="side-navigation" aria-label="Main navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <item.icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === "tasks" && allTasks.length > 0 && (
                <span className="nav-count">
                  {allTasks.filter(task => task.status !== "done").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Sparkles size={14} />
          </div>
          <p>Small steps add up.</p>
          <span>You’re building a rhythm, one day at a time.</span>
        </div>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="user-avatar">
              {user.username?.slice(0, 1).toUpperCase() || "D"}
            </div>
            <div className="user-info">
              <span className="user-name">{user.username}</span>
              <span className="user-caption">Personal workspace</span>
            </div>
            <button
              type="button"
              className="logout-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label="Main navigation">
        {navItems.map(item => (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => setView(item.id)}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{navItems.find(item => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search tasks and notes"
                placeholder="Search your day…"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <kbd>/</kbd>
            </label>
            <Button
              size="sm"
              className="primary-button top-add-button"
              onClick={() => openTask()}
            >
              <Plus size={16} /> <span>New task</span>
            </Button>
          </div>
        </header>

        <div className="page-content">
          <section className="day-toolbar">
            <div>
              <span className="eyebrow">
                <span className="live-dot" />{" "}
                {isToday ? "YOUR DAY, AT A GLANCE" : "YOUR DAILY SPACE"}
              </span>
              <div className="day-title-row">
                <h1>
                  {isToday ? `${greeting}, ${displayName}.` : selectedDateLabel}
                </h1>
                {isToday && (
                  <span className="day-sparkle">
                    <Sparkles size={16} />
                  </span>
                )}
              </div>
              <p className="day-subtitle">
                {isToday
                  ? "Make a little progress. Let the rest wait."
                  : "A day to return to, one thing at a time."}
              </p>
            </div>
            <div className="date-controls">
              <button
                type="button"
                className="date-arrow"
                aria-label="Previous day"
                onClick={() => changeDate(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <label className="date-picker-label">
                <CalendarDays size={15} />
                <span>
                  {formatDay(selectedDate, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <input
                  aria-label="Choose a date"
                  type="date"
                  value={selectedDate}
                  onChange={event =>
                    event.target.value && setSelectedDate(event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="date-arrow"
                aria-label="Next day"
                onClick={() => changeDate(1)}
              >
                <ChevronRight size={18} />
              </button>
              {!isToday && (
                <button
                  type="button"
                  className="today-button"
                  onClick={() => setSelectedDate(todayKey())}
                >
                  Today
                </button>
              )}
            </div>
          </section>

          {view === "today" && (
            <motion.section
              className="focus-banner"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.35 }}
            >
              <div className="focus-banner-copy">
                <span className="focus-label">
                  <Target size={13} /> DAILY MOMENTUM
                </span>
                <h2>
                  {allTasks.length
                    ? "Progress looks good on you."
                    : "A fresh page, just for today."}
                </h2>
                <p>
                  {allTasks.length
                    ? `${doneCount} of ${allTasks.length} ${allTasks.length === 1 ? "task" : "tasks"} finished. Keep your next step small.`
                    : "Add a task or jot down a study note to get into your flow."}
                </p>
                <div className="banner-metrics">
                  <div>
                    <strong>{allTasks.length}</strong>
                    <span>planned</span>
                  </div>
                  <span className="metric-divider" />
                  <div>
                    <strong>{doneCount}</strong>
                    <span>done</span>
                  </div>
                  <span className="metric-divider" />
                  <div>
                    <strong>
                      {
                        allTasks.filter(task => task.status === "in_progress")
                          .length
                      }
                    </strong>
                    <span>in motion</span>
                  </div>
                </div>
              </div>
              <div
                className="progress-orbit"
                aria-label={`${progress}% of tasks complete`}
              >
                <div
                  className="progress-ring"
                  style={
                    { "--progress": `${progress}%` } as React.CSSProperties
                  }
                >
                  <div className="progress-ring-inner">
                    <span>
                      {progress}
                      <small>%</small>
                    </span>
                    <em>done</em>
                  </div>
                </div>
                <span className="orbit-caption">YOUR PACE</span>
                <Sparkles className="orbit-sparkle" size={16} />
              </div>
              <div className="banner-decoration banner-decoration-one" />
              <div className="banner-decoration banner-decoration-two" />
            </motion.section>
          )}

          <div className="dashboard-grid">
            <div className="primary-column">
              {showTasks && (
                <section
                  className="panel tasks-panel"
                  aria-labelledby="tasks-heading"
                >
                  <div className="panel-heading tasks-heading">
                    <div className="section-title-wrap">
                      <span className="section-kicker">
                        <ListTodo size={13} /> THE PLAN
                      </span>
                      <h2 id="tasks-heading">
                        Tasks{" "}
                        <span className="heading-count">
                          {statusFilter === "all" &&
                          assigneeFilter === "all" &&
                          !normalizedSearch
                            ? allTasks.length
                            : tasks.length}
                        </span>
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="quiet-add"
                      onClick={() => openTask()}
                    >
                      <Plus size={15} /> Add task
                    </Button>
                  </div>
                  <div className="task-filters">
                    <div
                      className="status-tabs"
                      role="tablist"
                      aria-label="Filter tasks by status"
                    >
                      {(["all", "todo", "in_progress", "done"] as const).map(
                        value => (
                          <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={statusFilter === value}
                            className={statusFilter === value ? "selected" : ""}
                            onClick={() => setStatusFilter(value)}
                          >
                            {value === "all" ? "All" : statusLabel(value)}
                          </button>
                        )
                      )}
                    </div>
                    <label className="assignee-filter">
                      <UsersRound size={13} />
                      <select
                        aria-label="Filter by assignee"
                        value={assigneeFilter}
                        onChange={event =>
                          setAssigneeFilter(event.target.value)
                        }
                      >
                        <option value="all">Everyone</option>
                        {assignees.map(assignee => (
                          <option value={assignee} key={assignee}>
                            {assignee}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </label>
                  </div>
                  <div className="task-list" aria-live="polite">
                    {tasksQuery.isLoading ? (
                      <div className="loading-list">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                      </div>
                    ) : tasks.length ? (
                      <AnimatePresence initial={false}>
                        {tasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onEdit={openTask}
                            onDelete={removeTask}
                            onToggle={toggleTask}
                          />
                        ))}
                      </AnimatePresence>
                    ) : (
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <CheckCheck size={19} />
                        </div>
                        <strong>
                          {normalizedSearch ||
                          statusFilter !== "all" ||
                          assigneeFilter !== "all"
                            ? "Nothing matches just yet."
                            : "This part of your day is open."}
                        </strong>
                        <span>
                          {normalizedSearch ||
                          statusFilter !== "all" ||
                          assigneeFilter !== "all"
                            ? "Try another search or filter."
                            : "Add a task when you’re ready to begin."}
                        </span>
                        {!normalizedSearch &&
                          statusFilter === "all" &&
                          assigneeFilter === "all" && (
                            <button
                              type="button"
                              className="empty-action"
                              onClick={() => openTask()}
                            >
                              <Plus size={14} /> Add a task
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                  {allTasks.length > 0 && (
                    <div className="task-list-footer">
                      <span>
                        <span className="footer-dot" /> Showing tasks for{" "}
                        {formatDay(selectedDate, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>{doneCount} completed</span>
                    </div>
                  )}
                </section>
              )}

              {showNotes && (
                <section
                  className="panel notes-panel"
                  aria-labelledby="notes-heading"
                >
                  <div className="panel-heading notes-heading">
                    <div className="section-title-wrap">
                      <span className="section-kicker">
                        <NotebookPen size={13} /> YOUR THOUGHTS
                      </span>
                      <h2 id="notes-heading">
                        Daily notes{" "}
                        <span className="heading-count">{notes.length}</span>
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="quiet-add"
                      onClick={() => openNote()}
                    >
                      <Plus size={15} /> New note
                    </Button>
                  </div>
                  {notesQuery.isLoading ? (
                    <div className="loading-list">
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                    </div>
                  ) : notes.length ? (
                    <div className="notes-grid">
                      <AnimatePresence initial={false}>
                        {notes.map(note => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            onEdit={openNote}
                            onDelete={removeNote}
                            onDownloadPdf={downloadNotePdf}
                          />
                        ))}
                      </AnimatePresence>
                      <button
                        type="button"
                        className="add-note-card"
                        onClick={() => openNote()}
                      >
                        <span>
                          <Plus size={17} />
                        </span>
                        <strong>Save another thought</strong>
                        <small>It doesn’t have to be perfect.</small>
                      </button>
                    </div>
                  ) : (
                    <div className="note-empty-state">
                      <div className="note-empty-mark">
                        <NotebookPen size={17} />
                      </div>
                      <div>
                        <strong>No notes for this day yet.</strong>
                        <span>
                          Keep a useful idea close, before it drifts away.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="outline-button"
                        onClick={() => openNote()}
                      >
                        <Plus size={14} /> Write a note
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </div>

            <aside className="secondary-column">
              <SpotifyCard userId={user.id} />
              <section className="small-note-card">
                <div className="small-note-top">
                  <span className="small-note-icon">
                    <Sparkles size={14} />
                  </span>
                  <span> A SOFTER REMINDER</span>
                </div>
                <p>
                  Focus isn’t doing more.
                  <br />
                  <em>It’s choosing what matters now.</em>
                </p>
                <div className="small-note-bottom">
                  <span>YOUR WORKSPACE</span>
                  <ArrowDownRight size={15} />
                </div>
              </section>
              <div className="privacy-callout">
                <div>
                  <PanelTop size={14} />
                  <span>PRIVATE BY DESIGN</span>
                </div>
                <p>
                  Your notes, tasks, and saved music link belong to your
                  account.
                </p>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              STUDYWITHFUN <span className="brand-dot">·</span> A SMALL SPACE TO
              FOCUS
            </span>
            <span>Built for your everyday rhythm.</span>
          </footer>
        </div>
      </main>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={open => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        date={selectedDate}
        saving={createTask.isPending || updateTask.isPending}
        onSave={submitTask}
      />
      <NoteDialog
        open={noteDialogOpen}
        onOpenChange={open => {
          setNoteDialogOpen(open);
          if (!open) setEditingNote(null);
        }}
        note={editingNote}
        date={selectedDate}
        saving={createNote.isPending || updateNote.isPending}
        onSave={submitNote}
      />
    </motion.div>
  );
}

export default function Home() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <AccountScreen />;
  return <Dashboard />;
}
