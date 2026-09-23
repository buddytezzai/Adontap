const base = () => process.env.HIGGSFIELD_BASE_URL || "https://api.higgsfield.ai";
const auth = () => { if (!process.env.HIGGSFIELD_API_KEY) throw new Error("HIGGSFIELD_API_KEY is not configured"); return `Key ${process.env.HIGGSFIELD_API_KEY}`; };
const duration = (seconds) => seconds >= 10 ? 10 : 5;
async function generateVideo(prompt, seconds) {
  const submit = await fetch(`${base()}/${process.env.HIGGSFIELD_MODEL || "bytedance/seedance-2.5/text-to-video"}`, { method: "POST", headers: { Authorization: auth(), "Content-Type": "application/json" }, body: JSON.stringify({ prompt, duration: duration(seconds), aspect_ratio: "9:16", resolution: "720p" }) });
  if (!submit.ok) throw new Error(`Higgsfield submit failed (${submit.status})`);
  const job = await submit.json(); const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) { await new Promise((resolve) => setTimeout(resolve, Number(process.env.HIGGSFIELD_POLL_MS || 4000))); const response = await fetch(job.status_url, { headers: { Authorization: auth() } }); if (!response.ok) continue; const status = await response.json(); if (status.status === "completed") return { videoUrl: status.output?.[0]?.url, requestId: job.request_id, durationSeconds: duration(seconds) }; if (status.status === "failed") throw new Error("Higgsfield render failed"); }
  throw new Error("Higgsfield render timed out");
}
module.exports = { generateVideo };
