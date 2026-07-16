import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { workflows, workflowRuns } from "../db/schema.js";


export const RunWorkflowSchema = z.object({
    slug: z.string().min(1).describe("Slug of the curated workflow to run, as created by workflow_create."),
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

function tryParseJSON(s: string): unknown {
    try { return JSON.parse(s); } catch { return {}; }
}

function runAssertions(asserts: AssertDef[], output: {
    status: number;
    headers: Record<string, string>;
    body: string;
}): AssertResult[] {
    return asserts.map((a) => {
        switch (a.type) {
            case "status.equals":
                return { type: a.type, passed: output.status === a.value, expected: a.value, actual: output.status };
            case "status.in": {
                const allowed = a.value as number[] | undefined;
                return { type: a.type, passed: allowed?.includes(output.status) ?? false, expected: a.value, actual: output.status };
            }
            case "status.range":
                return {
                    type: a.type, passed: output.status >= (a.min ?? 0) && output.status <= (a.max ?? 999),
                    expected: `${a.min ?? 0}–${a.max ?? 999}`, actual: output.status,
                };
            case "body.exists": {
                const val = resolvePath(tryParseJSON(output.body), a.path ?? "");
                return { type: a.type, passed: val !== undefined, path: a.path, actual: val };
            }
            case "body.equals": {
                const val = resolvePath(tryParseJSON(output.body), a.path ?? "");
                return { type: a.type, passed: val === a.value, path: a.path, expected: a.value, actual: val };
            }
            case "body.contains": {
                const val = resolvePath(tryParseJSON(output.body), a.path ?? "");
                return { type: a.type, passed: String(val ?? "").includes(a.substr ?? ""), path: a.path, expected: a.substr, actual: val };
            }
            case "body.length": {
                const val = resolvePath(tryParseJSON(output.body), a.path ?? "");
                return {
                    type: a.type, passed: Array.isArray(val) && val.length === a.value,
                    path: a.path, expected: a.value, actual: Array.isArray(val) ? val.length : undefined,
                };
            }
            case "header.exists":
                return { type: a.type, passed: output.headers[a.key ?? ""] !== undefined, key: a.key, actual: output.headers[a.key ?? ""] };
            case "header.equals":
                return { type: a.type, passed: output.headers[a.key ?? ""] === a.value, key: a.key, expected: a.value, actual: output.headers[a.key ?? ""] };
            case "header.contains":
                return { type: a.type, passed: (output.headers[a.key ?? ""] ?? "").includes(a.substr ?? ""), key: a.key, expected: a.substr, actual: output.headers[a.key ?? ""] };
            default:
                return { type: a.type, passed: false, error: "unknown assertion type" };
        }
    });
}

type AssertDef = {
    type: string;
    path?: string;
    key?: string;
    value?: number | string | number[];
    min?: number;
    max?: number;
    substr?: string;
};

type AssertResult = {
    type: string;
    passed: boolean;
    path?: string;
    key?: string;
    expected?: unknown;
    actual?: unknown;
};

export type StepResult = {
    stepId: string;
    status: "success" | "error" | "skipped" | "assert_failed";
    output?: unknown;
    error?: string;
    assertions?: AssertResult[];
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
            assert?: AssertDef[];
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

                let stepStatus: "success" | "assert_failed" = "success";
                let stepAssertions: AssertResult[] | undefined;

                if (step.assert) {
                    stepAssertions = runAssertions(step.assert, output);
                    if (stepAssertions.some(a => !a.passed)) {
                        stepStatus = "assert_failed";
                    }
                }

                results.push({ stepId: step.id, status: stepStatus, output, assertions: stepAssertions });
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

    const sessionSlug = crypto.randomUUID();

    const now = new Date();
    const [run] = await db.insert(workflowRuns).values({
        id: crypto.randomUUID(),
        workflowId: workflow.id,
        sessionSlug,
        currentStepIndex: 0,
        variables: "{}",
        status: "running",
        results: "[]",
        createdAt: now,
        updatedAt: now,
    }).returning();

    return executeSteps(run.id, workflow, sessionSlug, {}, 0, []);
}
