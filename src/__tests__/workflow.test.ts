import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db, returningMock, orderByMock, limitMock, thenMock } = vi.hoisted(() => {
  const returningMock = vi.fn(() => Promise.resolve([{ id: 1 }]));
  const orderByMock = vi.fn(() => Promise.resolve([]));
  const limitMock = vi.fn(() => Promise.resolve([]));
  const thenMock = vi.fn((onfulfilled: any) => { onfulfilled([]); return undefined; });
  const chainish: any = {
    values: vi.fn(() => chainish),
    set: vi.fn(() => chainish),
    from: vi.fn(() => chainish),
    where: vi.fn(() => chainish),
    returning: returningMock,
    orderBy: orderByMock,
    limit: limitMock,
    then: thenMock,
  };
  const db = {
    insert: vi.fn(() => chainish),
    select: vi.fn(() => chainish),
    update: vi.fn(() => chainish),
    delete: vi.fn(() => chainish),
  };
  return { db, returningMock, orderByMock, limitMock, thenMock };
});

vi.mock('../db/client.js', () => ({ db }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })) }));

import { createWorkflow } from '../tools/workflow.create.js';
import { listWorkflows } from '../tools/workflow.list.js';
import { runWorkflow, executeSteps } from '../tools/workflow.run.js';
import { continueWorkflow } from '../tools/workflow.continue.js';

const sampleSteps = [
  { id: 'step1', method: 'GET', url: 'https://api.example.com/login', reason: 'login' },
];

describe('workflow tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorkflow', () => {
    it('creates a workflow with steps', async () => {
      returningMock.mockResolvedValue([{ id: 'wf-1', slug: 'my-workflow', steps: JSON.stringify(sampleSteps) }]);

      const result = await createWorkflow({ slug: 'my-workflow', steps: sampleSteps });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: 'wf-1', slug: 'my-workflow', steps: JSON.stringify(sampleSteps) });
    });

    it('creates a workflow with description', async () => {
      returningMock.mockResolvedValue([{ id: 'wf-1', slug: 'desc-wf', description: 'A test workflow', steps: '[]' }]);

      const result = await createWorkflow({ slug: 'desc-wf', description: 'A test workflow', steps: [{ id: 's1' }] });

      expect(result.description).toBe('A test workflow');
    });
  });

  describe('listWorkflows', () => {
    it('returns all workflows ordered by createdAt', async () => {
      const workflows = [{ id: '1', slug: 'wf-1' }];
      orderByMock.mockResolvedValue(workflows);

      const result = await listWorkflows();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(workflows);
    });

    it('returns empty array when no workflows exist', async () => {
      orderByMock.mockResolvedValue([]);

      const result = await listWorkflows();

      expect(result).toEqual([]);
    });
  });

  describe('runWorkflow', () => {
    it('returns error when workflow not found', async () => {
      limitMock.mockResolvedValue([]);

      const result = await runWorkflow({ slug: 'nonexistent' });

      expect(result).toEqual({ status: 'error', message: 'Workflow "nonexistent" not found' });
    });

    it('runs a workflow to completion', async () => {
      const workflow = {
        id: 'wf-1',
        slug: 'wf-test',
        steps: JSON.stringify([
          { id: 's1', method: 'GET', url: 'https://example.com', reason: 'test' },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-1', status: 'running' }]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('hello'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await runWorkflow({ slug: 'wf-test' });

      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('results');
      expect((result as any).results[0].stepId).toBe('s1');
      expect((result as any).results[0].status).toBe('success');
    });

    it('extracts variables from response body', async () => {
      const workflow = {
        id: 'wf-2',
        slug: 'wf-extract',
        steps: JSON.stringify([
          {
            id: 's1',
            method: 'POST',
            url: 'https://example.com/login',
            body: '{"user":"test"}',
            extract: [{ var: 'token', from: 'response.body', path: 'access_token' }],
          },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-2' }]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"access_token":"abc123"}'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await runWorkflow({ slug: 'wf-extract' });

      expect(result).toHaveProperty('status', 'completed');
    });

    it('extracts variables from response headers', async () => {
      const workflow = {
        id: 'wf-3',
        slug: 'wf-extract-header',
        steps: JSON.stringify([
          {
            id: 's1',
            method: 'GET',
            url: 'https://example.com',
            extract: [{ var: 'sessionId', from: 'response.headers', path: 'x-session-id' }],
          },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-3' }]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'x-session-id': 'sess-abc' }),
        text: vi.fn().mockResolvedValue('ok'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await runWorkflow({ slug: 'wf-extract-header' });

      expect(result).toHaveProperty('status', 'completed');
    });

    it('runs assertions and marks assert_failed on failure', async () => {
      const workflow = {
        id: 'wf-4',
        slug: 'wf-assert',
        steps: JSON.stringify([
          {
            id: 's1',
            method: 'GET',
            url: 'https://example.com',
            assert: [{ type: 'status.equals', value: 200 }],
          },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-4' }]);

      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('not found'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await runWorkflow({ slug: 'wf-assert' });

      expect(result).toHaveProperty('status', 'completed');
      expect((result as any).results[0].status).toBe('assert_failed');
    });

    it('handles fetch errors gracefully', async () => {
      const workflow = {
        id: 'wf-5',
        slug: 'wf-error',
        steps: JSON.stringify([
          { id: 's1', method: 'GET', url: 'https://example.com' },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-5' }]);

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection timeout')));

      const result = await runWorkflow({ slug: 'wf-error' });

      expect(result).toHaveProperty('status', 'completed');
      expect((result as any).results[0].status).toBe('error');
      expect((result as any).results[0].error).toContain('Connection timeout');
    });

    it('pauses at requiresInput step when variable is missing', async () => {
      const workflow = {
        id: 'wf-6',
        slug: 'wf-pause',
        steps: JSON.stringify([
          { id: 's1', method: 'GET', url: 'https://example.com' },
          { id: 's2', requiresInput: { prompt: 'Enter OTP', captureVar: 'otp' } },
          { id: 's3', method: 'GET', url: 'https://example.com/confirm' },
        ]),
      };
      limitMock.mockResolvedValueOnce([workflow]);
      returningMock.mockResolvedValue([{ id: 'run-6' }]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await runWorkflow({ slug: 'wf-pause' });

      expect(result).toHaveProperty('status', 'paused');
      expect(result).toHaveProperty('continuationToken', 'run-6');
      expect(result).toHaveProperty('prompt', 'Enter OTP');
    });
  });

  describe('continueWorkflow', () => {
    const pausedRun = {
      id: 'run-6',
      workflowId: 'wf-6',
      sessionSlug: 'sess-1',
      currentStepIndex: 1,
      variables: '{}',
      status: 'paused' as const,
      results: '[{"stepId":"s1","status":"success","output":{"status":200,"statusText":"OK","headers":{},"body":"ok"}}]',
    };

    const workflow = {
      id: 'wf-6',
      slug: 'wf-pause',
      steps: JSON.stringify([
        { id: 's1', method: 'GET', url: 'https://example.com' },
        { id: 's2', requiresInput: { prompt: 'Enter OTP', captureVar: 'otp' } },
        { id: 's3', method: 'GET', url: 'https://example.com/confirm' },
      ]),
    };

    it('returns error when run not found', async () => {
      limitMock.mockResolvedValue([]);

      const result = await continueWorkflow({ token: 'nonexistent', input: '123' });

      expect(result).toEqual({ status: 'error', message: 'Run not found for the given token' });
    });

    it('returns error when run is not paused', async () => {
      limitMock.mockResolvedValueOnce([{ ...pausedRun, status: 'completed' }]);

      const result = await continueWorkflow({ token: 'run-6', input: '123' });

      expect(result).toEqual({ status: 'error', message: 'Run is not paused (current status: completed)' });
    });

    it('returns error when workflow not found', async () => {
      limitMock.mockResolvedValueOnce([pausedRun]);
      limitMock.mockResolvedValueOnce([]);

      const result = await continueWorkflow({ token: 'run-6', input: '123' });

      expect(result).toEqual({ status: 'error', message: 'Workflow not found for this run' });
    });

    it('returns error when current step does not require input', async () => {
      const run = { ...pausedRun, currentStepIndex: 0 };
      limitMock.mockResolvedValueOnce([run]);
      limitMock.mockResolvedValueOnce([workflow]);

      const result = await continueWorkflow({ token: 'run-6', input: '123' });

      expect(result).toEqual({ status: 'error', message: 'Current step does not require input' });
    });

    it('continues a paused workflow and completes it', async () => {
      limitMock.mockResolvedValueOnce([pausedRun]);
      limitMock.mockResolvedValueOnce([workflow]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('confirmed'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await continueWorkflow({ token: 'run-6', input: '123456' });

      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('results');
      expect((result as any).results.length).toBe(2);
    });

    it('continues a paused workflow and pauses again for next input', async () => {
      const workflowMultiPause = {
        id: 'wf-7',
        slug: 'wf-multi-pause',
        steps: JSON.stringify([
          { id: 's1', requiresInput: { prompt: 'Enter A', captureVar: 'a' } },
          { id: 's2', requiresInput: { prompt: 'Enter B', captureVar: 'b' } },
        ]),
      };
      const pausedRun2 = {
        id: 'run-7',
        workflowId: 'wf-7',
        sessionSlug: 'sess-1',
        currentStepIndex: 0,
        variables: '{}',
        status: 'paused' as const,
        results: '[]',
      };
      limitMock.mockResolvedValueOnce([pausedRun2]);
      limitMock.mockResolvedValueOnce([workflowMultiPause]);

      const result = await continueWorkflow({ token: 'run-7', input: 'val-a' });

      expect(result).toHaveProperty('status', 'paused');
      expect(result).toHaveProperty('prompt', 'Enter B');
    });
  });

  describe('executeSteps (internal)', () => {
    it('resolves ${var} placeholders in url, headers, and body', async () => {
      const workflow = {
        id: 'wf-8',
        slug: 'wf-vars',
        steps: JSON.stringify([
          {
            id: 's1',
            method: 'POST',
            url: 'https://example.com/${resource}',
            headers: { Authorization: 'Bearer ${token}' },
            body: '{"id":"${id}"}',
          },
        ]),
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      };
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await executeSteps(
        'run-8',
        workflow,
        'sess-1',
        { resource: 'users', token: 'xyz', id: '42' },
        0,
        [],
      );

      expect(result).toHaveProperty('status', 'completed');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/users',
        expect.objectContaining({
          headers: { Authorization: 'Bearer xyz' },
          body: '{"id":"42"}',
        }),
      );
    });

    it('marks step as skipped when no url and no requiresInput', async () => {
      const workflow = {
        id: 'wf-skip',
        slug: 'wf-skip',
        steps: JSON.stringify([{ id: 's1' }]),
      };

      const result = await executeSteps('run-skip', workflow, 'sess-1', {}, 0, []);

      expect(result).toHaveProperty('status', 'completed');
      expect((result as any).results[0].status).toBe('skipped');
    });

    it('handles assertion type status.in', async () => {
      const workflow = {
        id: 'wf-stin',
        slug: 'wf-stin',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'status.in', value: [200, 201] }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-stin', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type status.range', async () => {
      const workflow = {
        id: 'wf-strng',
        slug: 'wf-strng',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'status.range', min: 200, max: 299 }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-strng', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type body.exists', async () => {
      const workflow = {
        id: 'wf-bex',
        slug: 'wf-bex',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'body.exists', path: 'data.id' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"data":{"id":"123"}}'),
      }));
      const result = await executeSteps('run-bex', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type body.equals', async () => {
      const workflow = {
        id: 'wf-beq',
        slug: 'wf-beq',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'body.equals', path: 'data.name', value: 'test' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"data":{"name":"test"}}'),
      }));
      const result = await executeSteps('run-beq', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type body.contains', async () => {
      const workflow = {
        id: 'wf-bcon',
        slug: 'wf-bcon',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'body.contains', path: 'data.name', substr: 'es' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"data":{"name":"test"}}'),
      }));
      const result = await executeSteps('run-bcon', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type body.length', async () => {
      const workflow = {
        id: 'wf-blen',
        slug: 'wf-blen',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'body.length', path: 'data.items', value: 3 }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"data":{"items":[1,2,3]}}'),
      }));
      const result = await executeSteps('run-blen', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type header.exists', async () => {
      const workflow = {
        id: 'wf-hex',
        slug: 'wf-hex',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'header.exists', key: 'x-custom' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers({ 'x-custom': 'yes' }),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-hex', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type header.equals', async () => {
      const workflow = {
        id: 'wf-heq',
        slug: 'wf-heq',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'header.equals', key: 'content-type', value: 'application/json' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-heq', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles assertion type header.contains', async () => {
      const workflow = {
        id: 'wf-hcon',
        slug: 'wf-hcon',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'header.contains', key: 'content-type', substr: 'json' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-hcon', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(true);
    });

    it('handles unknown assertion type', async () => {
      const workflow = {
        id: 'wf-unk',
        slug: 'wf-unk',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'this-is-unknown' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-unk', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].error).toBe('unknown assertion type');
    });

    it('handles non-JSON body gracefully in body assertions', async () => {
      const workflow = {
        id: 'wf-njson',
        slug: 'wf-njson',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [{ type: 'body.exists', path: 'data' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('not-json'),
      }));
      const result = await executeSteps('run-njson', workflow, 'sess-1', {}, 0, []);
      expect((result as any).results[0].assertions[0].passed).toBe(false);
    });

    it('handles step.url without explicit method (defaults to GET)', async () => {
      const workflow = {
        id: 'wf-nomethod',
        slug: 'wf-nomethod',
        steps: JSON.stringify([
          { id: 's1', url: 'https://example.com' },
        ]),
      };
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await executeSteps('run-nomethod', workflow, 'sess-1', {}, 0, []);

      expect(result).toHaveProperty('status', 'completed');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('handles body extract where path is undefined', async () => {
      const workflow = {
        id: 'wf-bext-undef',
        slug: 'wf-bext-undef',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          extract: [{ var: 'missing', from: 'response.body', path: 'nonexistent.path' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"exists":"yes"}'),
      }));
      const result = await executeSteps('run-bext-undef', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
    });

    it('handles body extract where response is invalid JSON (catch block)', async () => {
      const workflow = {
        id: 'wf-bext-catch',
        slug: 'wf-bext-catch',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          extract: [{ var: 'x', from: 'response.body', path: 'data' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('not-valid-json'),
      }));
      const result = await executeSteps('run-bext-catch', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
    });

    it('handles header extract where header is undefined', async () => {
      const workflow = {
        id: 'wf-hext-undef',
        slug: 'wf-hext-undef',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          extract: [{ var: 'missing', from: 'response.headers', path: 'x-nonexistent' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers({ 'x-existing': 'val' }),
        text: vi.fn().mockResolvedValue('ok'),
      }));
      const result = await executeSteps('run-hext-undef', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
    });

    it('covers all assertion failing branches and nullish fallbacks', async () => {
      const workflow = {
        id: 'wf-allfail',
        slug: 'wf-allfail',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          assert: [
            { type: 'status.equals', value: 404 },
            { type: 'status.in', value: [201, 202] },
            { type: 'status.in' },
            { type: 'status.range', min: 400, max: 499 },
            { type: 'status.range' },
            { type: 'body.exists', path: 'nope' },
            { type: 'body.equals', path: 'name', value: 'wrong' },
            { type: 'body.contains', path: 'name', substr: 'xyz' },
            { type: 'body.length', path: 'name', value: 5 },
            { type: 'header.exists', key: 'x-missing' },
            { type: 'header.exists' },
            { type: 'header.equals', key: 'wrong', value: 'bad' },
            { type: 'header.contains', key: 'content-type', substr: 'xml' },
          ],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue('{"name":"test","count":5,"nested":{"arr":[1,2,3]}}'),
      }));
      const result = await executeSteps('run-allfail', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
      expect((result as any).results.length).toBe(1);
    });

    it('covers resolvePath edge cases (null, scalar, array-index) and ?? fallbacks in assertions', async () => {
      const workflow = {
        id: 'wf-edges',
        slug: 'wf-edges',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com/${missing}',
          assert: [
            { type: 'body.exists', path: 'a.b' },
            { type: 'body.exists', path: 'c.d' },
            { type: 'body.exists', path: 'nums.0' },
            { type: 'body.exists' },
            { type: 'body.equals' },
            { type: 'body.contains' },
            { type: 'body.length' },
            { type: 'header.exists' },
            { type: 'header.equals' },
            { type: 'header.contains' },
          ],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('{"a":{"b":null},"c":"hello","nums":[10,20]}'),
      }));
      const result = await executeSteps('run-edges', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
    });

    it('covers extract else-if else branch (from value not body or headers)', async () => {
      const workflow = {
        id: 'wf-ext-other',
        slug: 'wf-ext-other',
        steps: JSON.stringify([{
          id: 's1', method: 'GET', url: 'https://example.com',
          extract: [{ var: 'x', from: 'response.cookies', path: 'existing' }],
        }]),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200, statusText: 'OK', headers: new Headers(),
        text: vi.fn().mockResolvedValue('{}'),
      }));
      const result = await executeSteps('run-ext-other', workflow, 'sess-1', {}, 0, []);
      expect(result).toHaveProperty('status', 'completed');
    });

    it('handles non-GET methods removing body', async () => {
      const workflow = {
        id: 'wf-9',
        slug: 'wf-get-body',
        steps: JSON.stringify([
          {
            id: 's1',
            method: 'GET',
            url: 'https://example.com',
            body: '{"should":"not be sent"}',
          },
        ]),
      };

      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('ok'),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await executeSteps('run-9', workflow, 'sess-1', {}, 0, []);

      expect(result).toHaveProperty('status', 'completed');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ body: undefined }),
      );
    });
  });
});
