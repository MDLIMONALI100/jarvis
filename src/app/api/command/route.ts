import { z } from "zod";
import { handler, json } from "@/lib/http";
import { executeCommand } from "@/lib/services/command";

export const POST = handler("command", async (req: Request) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(await req.json());
  return json(await executeCommand(text));
});
