import { db } from "@handeck/db";
import { publicProcedure } from "../../index";

export const baseTemplateRouter = {
  list: publicProcedure.handler(async () => {
    return await db.query.baseTemplatesTable.findMany();
  }),
};
