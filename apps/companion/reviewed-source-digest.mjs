import crypto from "node:crypto";
import fs from "node:fs";

export const normalizeReviewedSource = value => String(value).replace(/\r\n?/g, "\n");

export function reviewedSourceDigest(contents) {
  const hash = crypto.createHash("sha256");
  for (const content of contents) hash.update(normalizeReviewedSource(content), "utf8");
  return hash.digest("hex");
}

export function reviewedSourceFilesDigest(paths) {
  return reviewedSourceDigest(paths.map(file => fs.readFileSync(file, "utf8")));
}
