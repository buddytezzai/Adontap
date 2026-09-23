const ENGINES = new Set(["Seedance", "Higgsfield", "HeyGen", "Runway", "GoogleVeo"]);
const STATUSES = new Set(["draft", "published", "archived"]);
const VARIABLE_TYPES = new Set(["text", "textarea", "select", "image"]);

function templateInput(body) {
  if (!body || typeof body !== "object") throw new Error("Template body must be an object");
  const title = String(body.title || "").trim();
  if (!title || title.length > 120) throw new Error("Template title is required and must be at most 120 characters");
  const durationSeconds = Number(body.durationSeconds);
  const priceInr = Number(body.priceInr);
  const costInr = Number(body.costInr || 0);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) throw new Error("Duration must be a whole number between 1 and 600 seconds");
  if (!Number.isInteger(priceInr) || priceInr < 1) throw new Error("Price must be a whole number of at least ₹1");
  if (!Number.isInteger(costInr) || costInr < 0) throw new Error("Cost must be a non-negative whole number");
  if (!ENGINES.has(body.engine)) throw new Error("Unsupported video engine");
  if (!STATUSES.has(body.status || "draft")) throw new Error("Unsupported template status");

  const variables = Array.isArray(body.variables) ? body.variables.map((variable, index) => {
    const key = String(variable.key || "").trim();
    const label = String(variable.label || "").trim();
    const type = String(variable.type || "text");
    if (!/^\w{1,64}$/.test(key) || !label || !VARIABLE_TYPES.has(type)) throw new Error(`Invalid variable at position ${index + 1}`);
    const options = Array.isArray(variable.options) ? variable.options.map(String).slice(0, 50) : [];
    const defaultValue = String(variable.defaultValue || "");
    if (type === "select" && (!options.length || !options.includes(defaultValue))) throw new Error(`Variable ${label} needs a valid select default`);
    return { key, label, type, options, defaultValue, editable: variable.editable === true };
  }) : [];
  if (new Set(variables.map((variable) => variable.key)).size !== variables.length) throw new Error("Variable keys must be unique");

  return {
    title,
    category: String(body.category || "").trim().slice(0, 120),
    icon: String(body.icon || "📦").slice(0, 16),
    image: String(body.image || "").slice(0, 500),
    colorFrom: String(body.colorFrom || "#eaa23a"),
    colorTo: String(body.colorTo || "#e15b64"),
    durationSeconds,
    engine: body.engine,
    costInr,
    priceInr,
    gstRate: Number.isFinite(Number(body.gstRate)) ? Number(body.gstRate) : 0.18,
    status: body.status || "draft",
    basePrompt: String(body.basePrompt || "").slice(0, 20000),
    variables,
  };
}

function publicTemplate(id, data) {
  return {
    id,
    title: data.title,
    category: data.category || "",
    icon: data.icon || "📦",
    image: data.image || "",
    colorFrom: data.colorFrom || "#eaa23a",
    colorTo: data.colorTo || "#e15b64",
    durationSeconds: data.durationSeconds,
    engine: data.engine,
    priceInr: data.priceInr,
    gstRate: data.gstRate || 0,
    variables: Array.isArray(data.variables) ? data.variables.map(({ key, label, type, options, defaultValue, editable }) => ({ key, label, type, options: options || [], defaultValue: defaultValue || "", editable: editable === true })) : [],
  };
}

module.exports = { templateInput, publicTemplate };
