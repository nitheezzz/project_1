import { describe, expect, it } from "vitest";
import { decodeNotePdfUpload } from "./pdf-attachments";

function upload(fileName: string, bytes: string) {
  return { fileName, contentBase64: Buffer.from(bytes).toString("base64") };
}

describe("note PDF attachments", () => {
  it("accepts a PDF signature and sanitizes its original filename", () => {
    const result = decodeNotePdfUpload(
      upload("study notes/biology.pdf", "%PDF-1.7\nbody")
    );
    expect(result.fileName).toBe("study notes_biology.pdf");
    expect(result.data.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("rejects files without a PDF signature", () => {
    expect(() => decodeNotePdfUpload(upload("notes.pdf", "not a PDF"))).toThrow(
      "valid PDF"
    );
  });

  it("rejects filenames without a PDF extension", () => {
    expect(() =>
      decodeNotePdfUpload(upload("notes.txt", "%PDF-1.4\nbody"))
    ).toThrow("must be a PDF");
  });

  it("rejects malformed base64", () => {
    expect(() =>
      decodeNotePdfUpload({ fileName: "notes.pdf", contentBase64: "%%%" })
    ).toThrow("valid PDF");
  });
});
