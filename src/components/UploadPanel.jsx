import { useState } from "react";
import { apiFetch } from "../api";

export default function UploadPanel({ user, onRequireAuth, showToast }) {
  const [busy, setBusy] = useState(false);
  async function upload(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!user) { onRequireAuth(); return; }
    if (file.size > 8 * 1024 * 1024) { showToast("Files must be 8 MB or smaller."); return; }
    const reader = new FileReader(); setBusy(true);
    reader.onload = async () => { try { await apiFetch("/api/upload", { method: "POST", body: JSON.stringify({ data: reader.result, contentType: file.type }) }); showToast("Asset uploaded to your private 24-hour workspace."); } catch (error) { showToast(error.message || "Upload failed"); } finally { setBusy(false); } };
    reader.readAsDataURL(file);
  }
  return <section className="pricing-faq-banner" style={{ margin: "24px auto", maxWidth: 1220 }}><div><b>Upload a product reference</b><span>JPEG, PNG, WebP, or MP4 up to 8 MB. Stored privately for 24 hours.</span></div><label className="cta-btn" style={{ cursor: "pointer" }}>{busy ? "Uploading…" : "Choose file"}<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" hidden onChange={upload} disabled={busy} /></label></section>;
}
