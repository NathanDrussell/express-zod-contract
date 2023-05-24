import * as express from "express";
import { z } from "zod";
import { contract, defineLogger } from ".";

const app = express();

defineLogger(async (logs) => {
  console.log("logs", logs);
});

app.use(express.json());

app.get(
  "/:id",
  contract({
    query: z.object({}).passthrough(),
    result: z.object({
      test: z.literal("A"),
    }),
    handler: async (inputs, ctx) => {
      inputs.query["id"];
      ctx.log({
        level: "info",
        message: "test",
        metadata: {},
        tags: ["abc"],
      });
      return {
        test: "A" as const,
      };
    },
  })
);

app.listen(4762, () => {
  console.log("Server is listening on port http://localhost:4762");
});
