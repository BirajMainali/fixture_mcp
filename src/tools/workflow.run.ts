import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { workflows, workflowRuns, sessions } from "../db/schema.js";
import { emitEvent } from "../db/event-helper.js";

export const RunWorkflowSchema = z.object({
    slug: z.string().min(1).describe("Slug of the curated workflow to run, as created by workflow_create."),
    session: z.string().min(1).describe("Session slug to record replay events under. Created automatically if it doesn't exist."),
});

function resolveVars(template: string, vars: Record<string, string>): string {
    return template.replace(/\$\{(\w+)\}/g, (_, name) => vars[name] ?? `\${${name}}`);
}

function resolvePath(obj: unknown, path: string): unknown {
    return path.split(".").reduce((acc: unknown, part: string) => {
        if (acc === null || acc === undefined) return undefined;
        if (typeof acc !== "object") return undefined;
        const num = Number(part);
        return Number.isNaN(num) ? (acc as Record<string, unknown>)[part] : (acc as unknown[])[num];
    }, obj);
}

async function ensureSession(slug: string) {
    const existing = await db.select().from(sessions).where(eq(sessions.slug, slug)).limit(1);
    if (existing.length === 0) {
        const now = new Date();
        await db.insert(sessions).values({
            slug,
            description: "Auto-created by workflow_run",
            createdAt: now,
            updatedAt: now,
        });
    }
}

export type StepResult = {
    stepId: string;
    status: "success" | "error" | "skipped";
    output?: unknown;
    error?: string;
};

export async function executeSteps(
    runId: string,
    workflow: typeof workflows.$inferSelect,
    sessionSlug: string,
    initialVariables: Record<string, string>,
    startIndex: number,
    existingResults: StepResult[],
    initialInput?: { captureVar: string; value: string },
): Promise<unknown> {
    const steps: unknown[] = JSON.parse(workflow.steps);
    const variables = { ...initialVariables };
    const results = [...existingResults];

    if (initialInput) {
        variables[initialInput.captureVar] = initialInput.value;
    }

    for (let i = startIndex; i < steps.length; i++) {
        const step = steps[i] as {
            id: string;
            method?: string;
            url?: string;
            headers?: Record<string, string>;
            body?: string;
            reason?: string;
            extract?: { var: string; from: string; path: string }[];
            requiresInput?: { prompt: string; captureVar: string };
        };

        if (step.requiresInput && variables[step.requiresInput.captureVar] === undefined) {
            await db.update(workflowRuns).set({
                currentStepIndex: i,
                variables: JSON.stringify(variables),
                results: JSON.stringify(results),
                status: "paused",
                updatedAt: new Date(),
            }).where(eq(workflowRuns.id, runId));

            return {
                status: "paused",
                continuationToken: runId,
                step,
                prompt: step.requiresInput.prompt,
                resultsSoFar: results,
            };
        }

        if (step.url) {
            const resolvedUrl = resolveVars(step.url, variables);
            const resolvedHeaders = step.headers
                ? Object.fromEntries(
                    Object.entries(step.headers).map(([k, v]) => [k, resolveVars(v, variables)]),
                )
                : undefined;
            const resolvedBody = step.body ? resolveVars(step.body, variables) : undefined;

            try {
                const fetchMethod = step.method ?? "GET";
                const fetchHeaders = resolvedHeaders as Record<string, string> | undefined;
                const fetchBody = fetchMethod !== "GET" && fetchMethod !== "HEAD" && resolvedBody !== undefined
                    ? resolvedBody
                    : undefined;

                const res = await fetch(resolvedUrl, {
                    method: fetchMethod,
                    headers: fetchHeaders,
                    body: fetchBody,
                });

                const output = {
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers.entries()),
                    body: await res.text(),
                };

                if (step.extract) {
                    for (const ext of step.extract) {
                        if (ext.from === "response.body") {
                            try {
                                const parsed = JSON.parse(output.body as string);
                                const val = resolvePath(parsed, ext.path);
                                if (val !== undefined) {
                                    variables[ext.var] = String(val);
                                }
                            } catch {
                                // response body not parseable
                            }
                        } else if (ext.from === "response.headers") {
                            const val = (output.headers as Record<string, string>)[ext.path];
                            if (val !== undefined) {
                                variables[ext.var] = val;
                            }
                        }
                    }
                }

                await emitEvent({
                    sessionSlug,
                    tool: "workflow_step",
                    input: {
                        stepId: step.id,
                        method: step.method,
                        url: resolvedUrl,
                        headers: resolvedHeaders,
                        body: resolvedBody,
                        reason: step.reason,
                    },
                    output,
                    reason: step.reason,
                });

                results.push({ stepId: step.id, status: "success", output });
            } catch (err) {
                results.push({ stepId: step.id, status: "error", error: String(err) });
            }
        } else if (!step.requiresInput) {
            results.push({ stepId: step.id, status: "skipped" });
        }

        await db.update(workflowRuns).set({
            currentStepIndex: i + 1,
            variables: JSON.stringify(variables),
            results: JSON.stringify(results),
            updatedAt: new Date(),
        }).where(eq(workflowRuns.id, runId));
    }

    await db.update(workflowRuns).set({
        status: "completed",
        updatedAt: new Date(),
    }).where(eq(workflowRuns.id, runId));

    return { status: "completed", results, session: sessionSlug };
}

export async function runWorkflow(data: z.infer<typeof RunWorkflowSchema>) {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.slug, data.slug)).limit(1);
    if (!workflow) {
        return { status: "error", message: `Workflow "${data.slug}" not found` };
    }

    await ensureSession(data.session);

    const now = new Date();
    const [run] = await db.insert(workflowRuns).values({
        id: crypto.randomUUID(),
        workflowId: workflow.id,
        sessionSlug: data.session,
        currentStepIndex: 0,
        variables: "{}",
        status: "running",
        results: "[]",
        createdAt: now,
        updatedAt: now,
    }).returning();

    return executeSteps(run.id, workflow, data.session, {}, 0, []);
}
