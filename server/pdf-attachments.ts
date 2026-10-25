import { TRPCError } from "@trpc/server";

export const MAX_NOTE_PDF_BYTES = 8 * 1024 * 1024;

export function decodeNotePdfUpload(input: {
  fileName: string;
  contentBase64: string;
}) {
  const data = Buffer.from(input.contentBase64, "base64");
  if (
    data.length === 0 ||
    data.length > MAX_NOTE_PDF_BYTES ||
    data.toString("base64") !== input.contentBase64 ||
    data.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid PDF file up to 8 MB.",
    });
  }
  const fileName = input.fileName
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 255);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The selected file must be a PDF.",
    });
  }
  return { data, fileName };
}
