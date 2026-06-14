import { z } from "zod";

const permissionSchema = z.enum(["allow", "deny"]).default("deny");

const terminalStepSchema = z
  .object({
    terminal: z.object({
      run: z.string().min(1)
    })
  })
  .strict();

const browserOpenStepSchema = z
  .object({
    browser: z
      .object({
        open: z.string().min(1)
      })
      .strict()
  })
  .strict();

const browserClickStepSchema = z
  .object({
    browser: z
      .object({
        click: z.string().min(1)
      })
      .strict()
  })
  .strict();

const browserTypeStepSchema = z
  .object({
    browser: z
      .object({
        type: z
          .object({
            selector: z.string().min(1),
            text: z.string()
          })
          .strict()
      })
      .strict()
  })
  .strict();

const waitStepSchema = z
  .object({
    wait: z
      .object({
        seconds: z.number().nonnegative().max(300)
      })
      .strict()
  })
  .strict();

const screenshotStepSchema = z
  .object({
    screenshot: z
      .object({
        label: z.string().optional()
      })
      .strict()
  })
  .strict();

const assertStepSchema = z
  .object({
    assert: z
      .object({
        // Element text contains a string
        selector: z.string().min(1).optional(),
        contains: z.string().optional(),
        // Element visibility
        visible: z.boolean().optional(),
        // Page-level text presence
        text: z.string().optional(),
        // URL pattern (substring match)
        url: z.string().optional(),
        // Human-readable label shown in event log and error messages
        label: z.string().optional()
      })
      .strict()
      .refine(
        (v) =>
          v.contains !== undefined ||
          v.visible !== undefined ||
          v.text !== undefined ||
          v.url !== undefined,
        { message: "assert step must specify at least one condition: contains, visible, text, or url" }
      )
  })
  .strict();

export const traceCastScriptSchema = z
  .object({
    name: z.string().min(1),
    permissions: z
      .object({
        terminal: permissionSchema,
        browser: permissionSchema,
        network: permissionSchema
      })
      .partial()
      .default({}),
    recording: z
      .object({
        viewport: z
          .object({
            width: z.number().int().positive().default(1280),
            height: z.number().int().positive().default(720)
          })
          .default({ width: 1280, height: 720 }),
        cursor: z
          .object({
            movement: z.enum(["native", "scripted", "agent"]).default("native"),
            visible: z.boolean().default(true),
            clickEmphasis: z.boolean().default(false)
          })
          .default({ movement: "native", visible: true, clickEmphasis: false }),
        pacing: z
          .object({
            actionDelayMs: z.number().int().nonnegative().max(10000).default(600),
            clickDelayMs: z.number().int().nonnegative().max(10000).default(300),
            typeDelayMs: z.number().int().nonnegative().max(1000).default(80)
          })
          .default({ actionDelayMs: 600, clickDelayMs: 300, typeDelayMs: 80 }),
        output: z
          .object({
            format: z.enum(["webm", "mp4", "gif"]).default("webm"),
            titleCard: z.string().optional(),
            endCard: z.string().optional()
          })
          .default({ format: "webm" })
      })
      .default({
        viewport: { width: 1280, height: 720 },
        cursor: { movement: "native", visible: true, clickEmphasis: false },
        pacing: { actionDelayMs: 600, clickDelayMs: 300, typeDelayMs: 80 },
        output: { format: "webm" }
      }),
    steps: z
      .array(
        z.union([
          terminalStepSchema,
          browserOpenStepSchema,
          browserClickStepSchema,
          browserTypeStepSchema,
          waitStepSchema,
          screenshotStepSchema,
          assertStepSchema
        ])
      )
      .min(1)
  })
  .strict();

export type TraceCastScript = z.infer<typeof traceCastScriptSchema>;
export type TraceCastStep = TraceCastScript["steps"][number];

export type AssertCondition = {
  selector?: string;
  contains?: string;
  visible?: boolean;
  text?: string;
  url?: string;
  label?: string;
};

export type DirectorAction =
  | { kind: "terminal.run"; command: string }
  | { kind: "browser.open"; target: string }
  | { kind: "browser.click"; selector: string }
  | { kind: "browser.type"; selector: string; text: string }
  | { kind: "wait"; seconds: number }
  | { kind: "screenshot"; label?: string }
  | { kind: "assert"; condition: AssertCondition };

export function stepToDirectorAction(step: TraceCastStep): DirectorAction {
  if ("terminal" in step) {
    return { kind: "terminal.run", command: step.terminal.run };
  }

  if ("wait" in step) {
    return { kind: "wait", seconds: step.wait.seconds };
  }

  if ("screenshot" in step) {
    return { kind: "screenshot", label: step.screenshot.label };
  }

  if ("assert" in step) {
    return { kind: "assert", condition: step.assert };
  }

  if ("open" in step.browser) {
    return { kind: "browser.open", target: step.browser.open };
  }

  if ("click" in step.browser) {
    return { kind: "browser.click", selector: step.browser.click };
  }

  return {
    kind: "browser.type",
    selector: step.browser.type.selector,
    text: step.browser.type.text
  };
}
