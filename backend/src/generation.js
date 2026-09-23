const TOKEN = /\{\{(\w+)\}\}/g;

function resolveValues(variables, submitted) {
  const values = {};
  for (const variable of variables || []) {
    const value = submitted?.[variable.key];
    if (!variable.editable || typeof value !== "string") {
      values[variable.key] = String(variable.defaultValue || "");
      continue;
    }
    if (variable.type === "select" && !(variable.options || []).includes(value)) throw new Error(`Invalid choice for ${variable.label}`);
    const max = variable.type === "textarea" ? 4000 : 500;
    if (value.length > max) throw new Error(`${variable.label} is too long`);
    values[variable.key] = value;
  }
  return values;
}

function assemblePrompt(basePrompt, values, direction) {
  const prompt = String(basePrompt || "").replace(TOKEN, (whole, key) => Object.hasOwn(values, key) ? values[key] : whole);
  const brief = String(direction || "").trim();
  return brief ? `${prompt}\n\nCustomer creative direction:\n${brief.slice(0, 4000)}` : prompt;
}

module.exports = { resolveValues, assemblePrompt };
