import "server-only";

// The shared data layer. /admin and the public site BOTH read templates through this file, so
// there is exactly one place that knows how rows map to objects — and one place that decides what
// the public is allowed to see.

import { prisma } from "./db";
import { toPublicTemplate, toStringArray } from "./public";
import type {
  AdminTemplate,
  Engine,
  PublicTemplate,
  TemplateInput,
  TemplateStatus,
  VariableDTO,
  VariableType,
} from "./types";
import { unresolvedKeys } from "./prompt";
import type { Prisma } from "@/generated/prisma/client";

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const withVariables = {
  variables: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.TemplateInclude;

type AdminRow = Prisma.TemplateGetPayload<{ include: typeof withVariables }>;

function toAdminTemplate(row: AdminRow): AdminTemplate {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    colorFrom: row.colorFrom,
    colorTo: row.colorTo,
    durationSeconds: row.durationSeconds,
    engine: row.engine as Engine,
    costInr: row.costInr,
    priceInr: row.priceInr,
    gstRate: row.gstRate,
    status: row.status as TemplateStatus,
    basePrompt: row.basePrompt,
    variables: row.variables.map(
      (v): VariableDTO => ({
        key: v.key,
        label: v.label,
        type: v.type as VariableType,
        options: toStringArray(v.options),
        defaultValue: v.defaultValue,
        editable: v.editable,
      }),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function variableRows(variables: VariableDTO[]) {
  return variables.map((v, i) => ({
    key: v.key,
    label: v.label,
    type: v.type,
    options: v.options,
    defaultValue: v.defaultValue,
    editable: v.editable,
    sortOrder: i,
  }));
}

function templateColumns(input: TemplateInput) {
  return {
    title: input.title.trim(),
    category: input.category.trim(),
    icon: input.icon,
    colorFrom: input.colorFrom,
    colorTo: input.colorTo,
    durationSeconds: input.durationSeconds,
    engine: input.engine,
    costInr: input.costInr,
    priceInr: input.priceInr,
    gstRate: input.gstRate,
    status: input.status,
    basePrompt: input.basePrompt,
  };
}

// ───────────────────────── admin (full records) ─────────────────────────

export async function listTemplatesAdmin(): Promise<AdminTemplate[]> {
  const rows = await prisma.template.findMany({
    include: withVariables,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toAdminTemplate);
}

export async function getTemplateAdmin(id: string): Promise<AdminTemplate> {
  const row = await prisma.template.findUnique({ where: { id }, include: withVariables });
  if (!row) throw new NotFoundError("Template not found");
  return toAdminTemplate(row);
}

export async function createTemplate(input: TemplateInput): Promise<AdminTemplate> {
  const row = await prisma.template.create({
    data: { ...templateColumns(input), variables: { create: variableRows(input.variables) } },
    include: withVariables,
  });
  return toAdminTemplate(row);
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<AdminTemplate> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      // Variables are replaced wholesale, in the order the editor shows them.
      await tx.templateVariable.deleteMany({ where: { templateId: id } });
      return tx.template.update({
        where: { id },
        data: { ...templateColumns(input), variables: { create: variableRows(input.variables) } },
        include: withVariables,
      });
    });
    return toAdminTemplate(row);
  } catch (e) {
    if (isRecordNotFound(e)) throw new NotFoundError("Template not found");
    throw e;
  }
}

export async function setTemplateStatus(id: string, status: TemplateStatus): Promise<AdminTemplate> {
  const current = await getTemplateAdmin(id);
  if (status === "published") {
    const missing = unresolvedKeys(current.basePrompt, current.variables.map((v) => v.key));
    if (missing.length) {
      throw new ConflictError(
        `Can't publish: the base prompt uses ${missing.map((k) => `{{${k}}}`).join(", ")} but no variable has that key`,
      );
    }
  }
  const row = await prisma.template.update({ where: { id }, data: { status }, include: withVariables });
  return toAdminTemplate(row);
}

export async function duplicateTemplate(id: string): Promise<AdminTemplate> {
  const src = await getTemplateAdmin(id);
  return createTemplate({ ...src, title: `${src.title} (Copy)`, status: "draft" });
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    await prisma.template.delete({ where: { id } });
  } catch (e) {
    if (isRecordNotFound(e)) throw new NotFoundError("Template not found");
    throw e;
  }
}

function isRecordNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}

// ───────────────────────── public (sanitised) ─────────────────────────
//
// These queries use an explicit `select`, so costInr and basePrompt are never even loaded from the
// database on the public path. `toPublicTemplate` is a second, independent allow-list.

const publicSelect = {
  id: true,
  title: true,
  category: true,
  icon: true,
  colorFrom: true,
  colorTo: true,
  durationSeconds: true,
  engine: true,
  priceInr: true,
  gstRate: true,
  variables: {
    orderBy: { sortOrder: "asc" },
    select: { key: true, label: true, type: true, options: true, defaultValue: true, editable: true },
  },
} satisfies Prisma.TemplateSelect;

export async function listPublishedTemplates(): Promise<PublicTemplate[]> {
  const rows = await prisma.template.findMany({
    where: { status: "published" },
    select: publicSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => toPublicTemplate({ ...r, engine: r.engine as Engine, variables: r.variables.map((v) => ({ ...v, type: v.type as VariableType })) }));
}

/** Returns null for missing AND for non-published templates — the two are indistinguishable publicly. */
export async function getPublishedTemplate(id: string): Promise<PublicTemplate | null> {
  const row = await prisma.template.findFirst({ where: { id, status: "published" }, select: publicSelect });
  if (!row) return null;
  return toPublicTemplate({ ...row, engine: row.engine as Engine, variables: row.variables.map((v) => ({ ...v, type: v.type as VariableType })) });
}

// ───────────────────────── generation (server-side only) ─────────────────────────

/** Loads what the generate endpoint needs, including basePrompt. Must never be returned to a browser. */
export async function getPublishedTemplateForGeneration(id: string) {
  const row = await prisma.template.findFirst({
    where: { id, status: "published" },
    select: {
      id: true,
      title: true,
      engine: true,
      durationSeconds: true,
      priceInr: true,
      gstRate: true,
      basePrompt: true,
      variables: {
        orderBy: { sortOrder: "asc" },
        select: { key: true, label: true, type: true, options: true, defaultValue: true, editable: true },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    engine: row.engine as Engine,
    durationSeconds: row.durationSeconds,
    priceInr: row.priceInr,
    gstRate: row.gstRate,
    basePrompt: row.basePrompt,
    variables: row.variables.map((v) => ({
      key: v.key,
      label: v.label,
      type: v.type as VariableType,
      options: toStringArray(v.options),
      defaultValue: v.defaultValue,
      editable: v.editable,
    })),
  };
}

export async function recordGeneration(data: {
  templateId: string;
  templateTitle: string;
  submittedValues: Record<string, string>;
  assembledPrompt: string;
  chargeInr: number;
  gstInr: number;
}): Promise<string> {
  const row = await prisma.generation.create({ data, select: { id: true } });
  return row.id;
}
