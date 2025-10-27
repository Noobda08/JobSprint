// /api/upload-resume.js
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const { supabase } = require("./_supabase"); // uses your existing Supabase client

// We handle multipart ourselves
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 15 * 1024 * 1024 }); // 15MB
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Formidable error:", err);
      return res.status(400).json({ success: false, error: "Invalid form data" });
    }

    const file = files.file; // key must be 'file' in FormData
    if (!file?.filepath) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    try {
      // Read file buffer
      const buffer = fs.readFileSync(file.filepath);

      // Build a unique storage key
      const orig = file.originalFilename || path.basename(file.filepath);
      const ext = (orig.split(".").pop() || "bin").toLowerCase();
      const key = `resumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Basic content type
      const contentType =
        ext === "pdf"
          ? "application/pdf"
          : ext === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : ext === "doc"
          ? "application/msword"
          : "application/octet-stream";

      // Upload to the 'resumes' bucket (create it in Supabase if not present)
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(key, buffer, { contentType, upsert: false });

      // Remove temp file
      fs.unlink(file.filepath, () => {});

      if (upErr) {
        console.error("Supabase upload error:", upErr);
        return res.status(500).json({ success: false, error: upErr.message || "Upload failed" });
      }

      // Get a public URL (make bucket public), or use signed URLs if you prefer privacy
      const { data } = supabase.storage.from("resumes").getPublicUrl(key);
      const url = data?.publicUrl;
      if (!url) {
        return res.status(500).json({ success: false, error: "Could not generate public URL" });
      }

      return res.status(200).json({ success: true, url });
    } catch (e) {
      console.error("Upload failed:", e);
      return res.status(500).json({ success: false, error: e.message || "Server error" });
    }
  });
};
