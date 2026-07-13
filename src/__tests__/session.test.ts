import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db, returningMock, orderByMock, thenMock } = vi.hoisted(() => {
  const returningMock = vi.fn(() => Promise.resolve([{ id: 1 }]));
  const orderByMock = vi.fn(() => Promise.resolve([]));
  const thenMock = vi.fn((onfulfilled: any) => { onfulfilled([]); return undefined; });
  const chainish: any = {
    values: vi.fn(() => chainish),
    set: vi.fn(() => chainish),
    from: vi.fn(() => chainish),
    where: vi.fn(() => chainish),
    returning: returningMock,
    orderBy: orderByMock,
    limit: vi.fn(() => Promise.resolve([])),
    then: thenMock,
  };
  const db = {
    insert: vi.fn(() => chainish),
    select: vi.fn(() => chainish),
    update: vi.fn(() => chainish),
    delete: vi.fn(() => chainish),
  };
  return { db, returningMock, orderByMock, thenMock };
});

vi.mock('../db/client.js', () => ({ db }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ a, b })) }));

import { createSession } from '../tools/session.create.js';
import { listSessions } from '../tools/session.list.js';
import { editSession } from '../tools/session.edit.js';
import { deleteSession } from '../tools/session.delete.js';

describe('session tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('creates a session with slug and description', async () => {
      returningMock.mockResolvedValue([{ id: 1, slug: 'my-session', description: 'Test session' }]);

      const result = await createSession({ slug: 'my-session', description: 'Test session' });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, slug: 'my-session', description: 'Test session' });
    });

    it('creates a session without description', async () => {
      returningMock.mockResolvedValue([{ id: 2, slug: 'bare', description: null }]);

      const result = await createSession({ slug: 'bare' });

      expect(result.description).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('returns all sessions ordered by createdAt', async () => {
      const sessions = [{ id: 1, slug: 'first' }, { id: 2, slug: 'second' }];
      orderByMock.mockResolvedValue(sessions);

      const result = await listSessions();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(sessions);
    });

    it('returns empty array when no sessions exist', async () => {
      orderByMock.mockResolvedValue([]);

      const result = await listSessions();

      expect(result).toEqual([]);
    });
  });

  describe('editSession', () => {
    it('updates and returns the session', async () => {
      returningMock.mockResolvedValue([{ id: 1, slug: 'new-slug', description: 'Updated' }]);

      const result = await editSession({ id: 1, slug: 'new-slug', description: 'Updated' });

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, slug: 'new-slug', description: 'Updated' });
    });

    it('returns null when session not found', async () => {
      returningMock.mockResolvedValue([]);

      const result = await editSession({ id: 999 });

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('deletes and returns the session', async () => {
      returningMock.mockResolvedValue([{ id: 1, slug: 'to-delete' }]);

      const result = await deleteSession({ id: 1 });

      expect(db.delete).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, slug: 'to-delete' });
    });

    it('returns null when session not found', async () => {
      returningMock.mockResolvedValue([]);

      const result = await deleteSession({ id: 999 });

      expect(result).toBeNull();
    });
  });
});
