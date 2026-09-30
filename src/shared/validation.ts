/** Zod validation schemas shared by main (IPC guards) and renderer. */
import path from "node:path";
import { z } from "zod";
import { INDEXABLE_EXTENSIONS } from "./constants";

export const uuidSchema = z.string().uuid();

export const ollamaUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL");

export const modelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[\w.:\-/]+$/, "Invalid model name");

export const roleSchema = z.enum(["user", "assistant", "system"]);

export const messageContentSchema = z.string().min(1).max(64_000);

export const titleSchema = z.string().trim().min(1).max(200);

export const temperatureSchema = z.number().min(0).max(2);

/** Absolute, normalized path with an indexable extension and no traversal tricks. */
export const safePathSchema = z
  .string()
  .min(2)
  .max(1024)
  .refine((v) => !v.includes("\0"), "Null byte in path")
  .refine((v) => !v.includes(".."), "Path traversal is not allowed")
  .refine((v) => path.isAbsolute(v), "Path must be absolute")
  .refine((v) => INDEXABLE_EXTENSIONS.includes(path.extname(v).toLowerCase()), "Unsupported file type");

export const themeSchema = z.enum(["dark", "light", "system"]);
export const fontSizeSchema = z.enum(["sm", "md", "lg"]);

const ACCELERATOR_KEY =
  "Ctrl|Cmd|CommandOrControl|Command|Alt|Option|Shift|Super|Meta|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|[0-9]|[A-Z]";

export const shortcutSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(new RegExp(`^(${ACCELERATOR_KEY})(\\+(${ACCELERATOR_KEY}))+$`), "Invalid accelerator");

export const settingsPatchSchema = z
  .object({
    ollamaUrl: ollamaUrlSchema.optional(),
    defaultModel: modelNameSchema.optional(),
    theme: themeSchema.optional(),
    temperature: temperatureSchema.optional(),
    systemPrompt: z.string().max(8000).optional(),
    shortcutQuickAssistant: shortcutSchema.optional(),
    fontSize: fontSizeSchema.optional(),
    animations: z.boolean().optional(),
    compactMode: z.boolean().optional(),
    localOnly: z.boolean().optional(),
    maxContextChars: z.number().int().min(2000).max(60_000).optional(),
    contextChunkCount: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export function validate<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  return { ok: false, error: issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input" };
}
