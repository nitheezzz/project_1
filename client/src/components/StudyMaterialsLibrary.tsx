import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Download,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

async function toBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

function formatSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function StudyMaterialsLibrary() {
  const utils = trpc.useUtils();
  const materialsQuery = trpc.studyMaterials.list.useQuery();
  const uploadMaterial = trpc.studyMaterials.upload.useMutation();
  const downloadMaterial = trpc.studyMaterials.downloadUrl.useMutation();
  const removeMaterial = trpc.studyMaterials.remove.useMutation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [fileError, setFileError] = useState("");
  const materials = materialsQuery.data ?? [];
  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? materials.filter(item =>
          `${item.title} ${item.fileName} ${item.description ?? ""}`
            .toLowerCase()
            .includes(query)
        )
      : materials;
  }, [materials, search]);

  const chooseFile = (selected: File | null) => {
    setFileError("");
    if (!selected) return;
    if (
      !selected.name.toLowerCase().endsWith(".pdf") ||
      (selected.type && selected.type !== "application/pdf")
    ) {
      setFileError("Choose a PDF file.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setFileError("PDFs must be 8 MB or smaller.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(selected);
    setTitle(previous => previous || selected.name.replace(/\.pdf$/i, ""));
  };

  const submitUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !title.trim()) return;
    try {
      await uploadMaterial.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        fileName: file.name,
        contentBase64: await toBase64(file),
      });
      await utils.studyMaterials.list.invalidate();
      setFile(null);
      setTitle("");
      setDescription("");
      if (fileInput.current) fileInput.current.value = "";
      toast.success("PDF saved to Study Materials.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload this PDF."
      );
    }
  };

  const openMaterial = async (id: number) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const result = await downloadMaterial.mutateAsync({ id });
      if (tab) tab.location.href = result.url;
      else window.location.assign(result.url);
    } catch (error) {
      tab?.close();
      toast.error(
        error instanceof Error ? error.message : "Could not open this PDF."
      );
    }
  };

  const hideMaterial = async (id: number, name: string) => {
    if (
      !window.confirm(
        `Remove “${name}” from your Study Materials library? The stored file itself is retained.`
      )
    )
      return;
    try {
      await removeMaterial.mutateAsync({ id });
      await utils.studyMaterials.list.invalidate();
      toast.success("Removed from your library.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove this material."
      );
    }
  };

  return (
    <motion.section
      className="materials-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <header className="materials-intro">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> PERMANENT LIBRARY
          </span>
          <h1>Study materials</h1>
          <p>
            Keep your PDFs here. They stay in your library instead of belonging
            to a specific day.
          </p>
        </div>
        <span className="materials-count">
          <FolderOpen size={15} /> {materials.length}{" "}
          {materials.length === 1 ? "file" : "files"}
        </span>
      </header>

      <div className="materials-layout">
        <section
          className="panel materials-upload-panel"
          aria-labelledby="upload-material-heading"
        >
          <div className="section-title-wrap">
            <span className="section-kicker">
              <Upload size={13} /> ADD TO YOUR LIBRARY
            </span>
            <h2 id="upload-material-heading">Upload a PDF</h2>
          </div>
          <form className="materials-upload-form" onSubmit={submitUpload}>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Choose a PDF study material"
              onChange={event =>
                chooseFile(event.currentTarget.files?.[0] ?? null)
              }
            />
            <button
              type="button"
              className={`materials-dropzone ${file ? "has-file" : ""}`}
              onClick={() => fileInput.current?.click()}
            >
              {file ? <FileText size={22} /> : <Upload size={22} />}
              <strong>{file?.name ?? "Choose a study PDF"}</strong>
              <span>
                {file
                  ? `${formatSize(file.size)} · Click to change file`
                  : "PDF files up to 8 MB"}
              </span>
            </button>
            {fileError && <span className="inline-error">{fileError}</span>}
            <label className="field-label">
              Material title
              <input
                className="field-control"
                required
                maxLength={200}
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="e.g. Biology chapter 4"
              />
            </label>
            <label className="field-label">
              Description <span className="field-optional">Optional</span>
              <textarea
                className="field-control field-textarea materials-description"
                maxLength={12000}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="A short reminder about what’s inside…"
              />
            </label>
            <Button
              type="submit"
              disabled={
                !file ||
                !title.trim() ||
                uploadMaterial.isPending ||
                Boolean(fileError)
              }
              className="primary-button materials-upload-submit"
            >
              <Upload size={15} />{" "}
              {uploadMaterial.isPending
                ? "Saving PDF…"
                : "Save to Study Materials"}
            </Button>
          </form>
          <p className="materials-privacy">
            Only your signed-in account can see and open these files.
          </p>
        </section>

        <section
          className="panel materials-list-panel"
          aria-labelledby="saved-materials-heading"
        >
          <div className="materials-list-heading">
            <div className="section-title-wrap">
              <span className="section-kicker">
                <FolderOpen size={13} /> YOUR COLLECTION
              </span>
              <h2 id="saved-materials-heading">
                Saved materials{" "}
                <span className="heading-count">{materials.length}</span>
              </h2>
            </div>
            <label className="materials-search">
              <Search size={14} />
              <input
                aria-label="Search study materials"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search files"
              />
            </label>
          </div>
          {materialsQuery.isLoading ? (
            <div className="loading-list">
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          ) : filteredMaterials.length ? (
            <div className="materials-list">
              {filteredMaterials.map(item => (
                <article className="material-row" key={item.id}>
                  <span className="material-file-icon">
                    <FileText size={18} />
                  </span>
                  <div className="material-copy">
                    <strong>{item.title}</strong>
                    <span>
                      {item.fileName} · {formatSize(item.fileSize)}
                    </span>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <button
                    type="button"
                    className="material-action"
                    aria-label={`Open ${item.title}`}
                    title="Open PDF"
                    onClick={() => void openMaterial(item.id)}
                  >
                    <Download size={15} />
                  </button>
                  <button
                    type="button"
                    className="material-action material-remove"
                    aria-label={`Remove ${item.title} from library`}
                    title="Remove from library"
                    onClick={() => void hideMaterial(item.id, item.title)}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="materials-empty">
              <span>
                <FolderOpen size={20} />
              </span>
              <strong>
                {search ? "No matching materials." : "Your library is ready."}
              </strong>
              <p>
                {search
                  ? "Try a different title or filename."
                  : "Upload a PDF and it will stay here for you to reopen whenever you need it."}
              </p>
            </div>
          )}
        </section>
      </div>
    </motion.section>
  );
}
