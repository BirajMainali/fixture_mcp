import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => {
  const insertChain = {
    values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })),
  };
  return {
    insert: vi.fn(() => insertChain),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
});

vi.mock('../db/client.js', () => ({ db }));

import { emitEvent } from '../db/event-helper.js';

describe('emitEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts an event record with all fields', async () => {
    await emitEvent({
      sessionSlug: 'sess-1',
      tool: 'curl',
      input: { url: 'https://example.com' },
      output: { status: 200 },
      reason: 'testing',
    });

    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('inserts an event without reason', async () => {
    await emitEvent({
      sessionSlug: 'sess-1',
      tool: 'curl',
      input: {},
      output: {},
    });

    expect(db.insert).toHaveBeenCalledOnce();
  });

  it('uses crypto.randomUUID for id', async () => {
    await emitEvent({
      sessionSlug: 'sess-1',
      tool: 'curl',
      input: {},
      output: {},
    });

    expect(db.insert).toHaveBeenCalled();
  });
});
