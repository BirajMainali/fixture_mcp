import { z } from "zod";
import { emitEvent } from "../db/event-helper.js";

export const CurlSchema = {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "QUERY"]).default("GET")
        .describe("HTTP method to use for the request. Defaults to GET."),
    url: z.string().url()
        .describe("The full URL to send the request to. Must include protocol (e.g., https://api.example.com/resource)."),
    headers: z.record(z.string(), z.string()).optional()
        .describe("Optional HTTP headers as key-value pairs. Keys are header names, values are header values."),
    body: z.string().optional()
        .describe("Optional request body as a plain string. Not used for GET, HEAD, or DELETE requests without a body."),
    session: z.string().min(1)
        .describe("Session slug this request belongs to. Create one first with session_create."),
    reason: z.string().optional()
        .describe("Explain why this request is being made — e.g., 'Fetching auth token because endpoint requires Authorization header'. This reason is stored in the event log for traceability."),
};

export async function curl(data: z.infer<z.ZodObject<typeof CurlSchema>>) {
    const { session, reason, ...requestData } = data;

    const res = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body ?? null,
    });

    const result = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
    };

    await emitEvent({
        sessionSlug: session,
        tool: "curl",
        input: data,
        output: result,
        reason,
    });

    return result;
}
