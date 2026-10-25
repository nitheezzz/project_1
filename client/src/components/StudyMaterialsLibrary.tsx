import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const materials = materialsQuery.data ?? [];
  const selectedMaterial =
    materials.find(item => item.id === selectedId) ?? null;
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

  const viewMaterial = async (id: number) => {
    setOpeningId(id);
    setSelectedId(id);
    try {
      const result = await downloadMaterial.mutateAsync({ id });
      setPreviewUrl(result.url);
    } catch (error) {
      setPreviewUrl("");
      toast.error(
        error instanceof Error ? error.message : "Could not open this PDF."
      );
    } finally {
      setOpeningId(null);
    }
  };

  const downloadMaterialFile = async (id: number) => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups for this site to open the PDF download.");
      return;
    }
    tab.opener = null;
    try {
      const result = await downloadMaterial.mutateAsync({ id });
      tab.location.replace(result.url);
    } catch (error) {
      tab.close();
      toast.error(
        error instanceof Error ? error.message : "Could not open this PDF."
      );
    }
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
      setFile(null);
      setTitle("");
      setDescription("");
      if (fileInput.current) fileInput.current.value = "";
      const updated = await utils.studyMaterials.list.fetch();
      if (updated[0]) await viewMaterial(updated[0].id);
      toast.success("PDF saved and opened above.");
      setShowUploadForm(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload this PDF."
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
      if (selectedId === id) {
        setSelectedId(null);
        setPreviewUrl("");
      }
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
            Your saved PDFs stay together here, separate from your daily notes.
          </p>
        </div>
        <span className="materials-count">
          <FolderOpen size={15} /> {materials.length}{" "}
          {materials.length === 1 ? "PDF" : "PDFs"}
        </span>
      </header>

      <section className="panel pdf-reader-panel" aria-label="PDF viewer">
        <div className="pdf-reader-heading">
          <div className="section-title-wrap">
            <span className="section-kicker">
              <Eye size={13} /> PDF READER
            </span>
            <h2>{selectedMaterial?.title ?? "Your PDF appears here"}</h2>
          </div>
          {selectedMaterial && (
            <span className="pdf-reader-filename">
              {selectedMaterial.fileName}
            </span>
          )}
        </div>
        {previewUrl ? (
          <iframe
            key={previewUrl}
            className="pdf-reader-frame"
            title={selectedMaterial?.title ?? "Study material PDF"}
            src={previewUrl}
          />
        ) : (
          <div className="pdf-reader-empty">
            <span>
              <FileText size={25} />
            </span>
            <strong>
              {openingId
                ? "Opening PDF…"
                : "Choose a PDF from your library below"}
            </strong>
            <p>Your study material opens right here. No extra tab needed.</p>
          </div>
        )}
      </section>

      <section
        className="panel materials-list-panel materials-library-panel"
        aria-labelledby="saved-materials-heading"
      >
        <div className="materials-list-heading">
          <div className="section-title-wrap">
            <span className="section-kicker">
              <FolderOpen size={13} /> YOUR COLLECTION
            </span>
            <h2 id="saved-materials-heading">
              Your PDFs{" "}
              <span className="heading-count">{materials.length}</span>
            </h2>
          </div>
          <div className="materials-library-actions">
            <label className="materials-search">
              <Search size={14} />
              <input
                aria-label="Search study materials"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search PDFs"
              />
            </label>
            <Button
              type="button"
              size="sm"
              className="primary-button materials-add-button"
              onClick={() => setShowUploadForm(value => !value)}
            >
              {showUploadForm ? <X size={14} /> : <Plus size={14} />}
              {showUploadForm ? "Close" : "Add PDF"}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showUploadForm && (
            <motion.form
              className="materials-quick-upload"
              onSubmit={submitUpload}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
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
                {file ? <FileText size={20} /> : <Upload size={20} />}
                <strong>{file?.name ?? "Choose a study PDF"}</strong>
                <span>
                  {file
                    ? `${formatSize(file.size)} · Click to change`
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
                <Upload size={15} />
                {uploadMaterial.isPending ? "Saving PDF…" : "Save and open PDF"}
              </Button>
              <p className="materials-privacy">
                Only your signed-in account can see and open these files.
              </p>
            </motion.form>
          )}
        </AnimatePresence>

        {materialsQuery.isLoading ? (
          <div className="loading-list">
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        ) : filteredMaterials.length ? (
          <div className="materials-list">
            {filteredMaterials.map(item => (
              <article
                className={`material-row ${selectedId === item.id ? "material-row-selected" : ""}`}
                key={item.id}
              >
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
                  className="material-action material-view-action"
                  aria-label={`View ${item.title} above`}
                  title="View PDF above"
                  onClick={() => void viewMaterial(item.id)}
                  disabled={openingId === item.id}
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  className="material-action material-view-action"
                  aria-label={`Open ${item.title} in a separate tab`}
                  title="Open PDF in a separate tab"
                  onClick={() => void downloadMaterialFile(item.id)}
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
              {search ? "No matching PDFs." : "Your library is ready."}
            </strong>
            <p>
              {search
                ? "Try another title or filename."
                : "Add a PDF here, and open it in the reader above whenever you need it."}
            </p>
            {!search && (
              <Button
                type="button"
                size="sm"
                className="primary-button"
                onClick={() => setShowUploadForm(true)}
              >
                <Plus size={14} /> Add your first PDF
              </Button>
            )}
          </div>
        )}
      </section>
    </motion.section>
  );
}
