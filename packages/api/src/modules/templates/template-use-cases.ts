import { db } from "@handeck/db";
import { templatesTable } from "@handeck/db/schema";
import { and, eq } from "drizzle-orm";

export async function getOwnedTemplate(templateId: string, userId: string) {
  const template = await getOwnedTemplateOrNull(templateId, userId);

  if (!template) throw new Error("Template not found");
  return template;
}

export async function getOwnedTemplateOrNull(templateId: string, userId: string) {
  const template = await db.query.templatesTable.findFirst({
    where: and(eq(templatesTable.id, templateId), eq(templatesTable.userId, userId)),
  });

  return template ?? null;
}
