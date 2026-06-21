import { db } from "@handeck/db";
import { baseTemplatesTable } from "@handeck/db/schema";
import { eq } from "drizzle-orm";

export async function getBaseTemplate(baseTemplateId: string) {
  const baseTemplate = await getBaseTemplateOrNull(baseTemplateId);

  if (!baseTemplate) throw new Error("Base template not found");
  return baseTemplate;
}

export async function getBaseTemplateOrNull(baseTemplateId: string) {
  const baseTemplate = await db.query.baseTemplatesTable.findFirst({
    where: eq(baseTemplatesTable.id, baseTemplateId),
  });

  return baseTemplate ?? null;
}
