import { z } from "zod";
export const CurlSchema = {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "QUERY"]).default("GET")
        .describe("HTTP method to use for the request. Defaults to GET."),
    url: z.string().url()
        .describe("The full URL to send the request to. Must include protocol (e.g., https://api.example.com/resource)."),
    headers: z.record(z.string(), z.string()).optional()
        .describe("Optional HTTP headers as key-value pairs. Keys are header names, values are header values."),
    body: z.string().optional()
        .describe("Optional request body as a plain string. Not used for GET, HEAD, or DELETE requests without a body."),
};
export async function curl(data) {
    const res = await fetch(data.url, {
        method: data.method,
        headers: data.headers,
        body: data.body ?? null,
    });
    return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
    };
}
