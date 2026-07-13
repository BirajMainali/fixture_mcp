import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db, orderByMock } = vi.hoisted(() => {
  const orderByMock = vi.fn();
  const chainish = {
    from: vi.fn(() => chainish),
    where: vi.fn(() => chainish),
    orderBy: orderByMock,
    limit: vi.fn(() => Promise.resolve([])),
  };
  const db = {
    select: vi.fn(() => chainish),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { db, orderByMock };
});

vi.mock('../db/client.js', () => ({ db }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => ({ and: args })),
}));

import { eventList } from '../tools/event.list.js';

describe('eventList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all events for a session', async () => {
    const events = [{ id: '1', sessionSlug: 'sess-1', tool: 'curl' }];
    orderByMock.mockResolvedValue(events);

    const result = await eventList({ session: 'sess-1' });

    expect(db.select).toHaveBeenCalled();
    expect(result).toEqual(events);
  });

  it('filters events by tool when provided', async () => {
    const events = [{ id: '1', sessionSlug: 'sess-1', tool: 'curl' }];
    orderByMock.mockResolvedValue(events);

    const result = await eventList({ session: 'sess-1', tool: 'curl' });

    expect(db.select).toHaveBeenCalled();
    expect(result).toEqual(events);
  });

  it('returns empty array when no events match', async () => {
    orderByMock.mockResolvedValue([]);

    const result = await eventList({ session: 'nonexistent' });

    expect(result).toEqual([]);
  });
});
