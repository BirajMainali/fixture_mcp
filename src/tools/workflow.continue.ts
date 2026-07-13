import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { workflowRuns, workflows } from "../db/schema.js";
import { executeSteps, type StepResult } from "./workflow.run.js";

export const ContinueWorkflowSchema = z.object({
    token: z.string().describe("Continuation token returned by workflow_run when it paused."),
    input: z.string().describe("The value provided by the user for the requested input."),
});

export async function continueWorkflow(data: z.infer<typeof ContinueWorkflowSchema>) {
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, data.token)).limit(1);
    if (!run) {
        return { status: "error", message: "Run not found for the given token" };
    }
    if (run.status !== "paused") {
        return { status: "error", message: `Run is not paused (current status: ${run.status})` };
    }

    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, run.workflowId)).limit(1);
    if (!workflow) {
        return { status: "error", message: "Workflow not found for this run" };
    }

    const steps: { requiresInput?: { captureVar: string } }[] = JSON.parse(workflow.steps);
    const currentStep = steps[run.currentStepIndex];
    if (!currentStep?.requiresInput) {
        return { status: "error", message: "Current step does not require input" };
    }

    const variables: Record<string, string> = JSON.parse(run.variables);
    const existingResults: StepResult[] = JSON.parse(run.results);
    const captureVar = currentStep.requiresInput.captureVar;

    return executeSteps(
        run.id,
        workflow,
        run.sessionSlug,
        variables,
        run.currentStepIndex,
        existingResults,
        { captureVar, value: data.input },
    );
}
