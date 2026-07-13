import { z } from "zod";
import { db } from "../db/client.js";
import { workflows } from "../db/schema.js";

const WorkflowStepSchema = z.object({
    id: z.string().min(1),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
    url: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    reason: z.string().optional(),
    extract: z.array(z.object({
        var: z.string().min(1),
        from: z.enum(["response.body", "response.headers"]),
        path: z.string().min(1),
    })).optional(),
    requiresInput: z.object({
        prompt: z.string().min(1),
        captureVar: z.string().min(1),
    }).optional(),
});

export const CreateWorkflowSchema = z.object({
    slug: z.string().min(1).describe("Unique identifier for the workflow. Used to reference it in workflow_run."),
    description: z.string().optional().describe("Optional description of what this workflow does."),
    steps: z.array(WorkflowStepSchema).min(1).describe("Array of curated workflow steps. For HTTP steps, provide method, url, and optionally headers, body, extract, reason. For manual-input steps, provide requiresInput."),
});

export async function createWorkflow(data: z.infer<typeof CreateWorkflowSchema>) {
    const now = new Date();
    const rows = await db.insert(workflows).values({
        id: crypto.randomUUID(),
        slug: data.slug,
        description: data.description ?? null,
        steps: JSON.stringify(data.steps),
        createdAt: now,
        updatedAt: now,
    }).returning();
    return rows[0];
}
