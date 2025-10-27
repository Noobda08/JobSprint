// /api/parse-resume.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { parseResume } from "../resume_parser_js_robust_node.js"; // adjust path if needed

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Formidable error:", err);
      return res.status(400).json({ error: "Invalid form data" });
    }

    const file = files.file;
    if (!file?.filepath) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const result = await parseResume(file.filepath);

      // clean up temp file
      fs.unlink(file.filepath, () => {});
      return res.status(200).json(result);
    } catch (e) {
      console.error("Parser failed:", e);
      return res.status(500).json({ error: e.message || "Parse failed" });
    }
  });
}
