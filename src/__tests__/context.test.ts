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

import { createContext } from '../tools/context.create.js';
import { editContext } from '../tools/context.edit.js';
import { deleteContext } from '../tools/context.delete.js';
import { globalContexts } from '../tools/context.global.js';
import { contextBySession } from '../tools/context.by-session.js';

describe('context tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContext', () => {
    it('creates a global context', async () => {
      returningMock.mockResolvedValue([{ id: 'uuid', scope: 'global', field: 'auth.token', value: 'abc' }]);

      const result = await createContext({ scope: 'global', field: 'auth.token', value: 'abc' });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: 'uuid', scope: 'global', field: 'auth.token', value: 'abc' });
    });

    it('creates a session-scoped context', async () => {
      returningMock.mockResolvedValue([{ id: 'uuid', scope: 'session', sessionId: 'sess-1', field: 'x-custom', value: 'val' }]);

      const result = await createContext({ scope: 'session', sessionId: 'sess-1', field: 'x-custom', value: 'val' });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ id: 'uuid', scope: 'session', sessionId: 'sess-1', field: 'x-custom', value: 'val' });
    });

    it('creates context with description', async () => {
      returningMock.mockResolvedValue([{ id: 'uuid', scope: 'global', field: 'f', value: 'v', description: 'desc' }]);

      const result = await createContext({ scope: 'global', field: 'f', value: 'v', description: 'desc' });

      expect(result.description).toBe('desc');
    });
  });

  describe('editContext', () => {
    it('updates context and returns it', async () => {
      returningMock.mockResolvedValue([{ id: 'ctx-1', field: 'new-field', value: 'new-val' }]);

      const result = await editContext({ id: 'ctx-1', field: 'new-field', value: 'new-val' });

      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'ctx-1', field: 'new-field', value: 'new-val' });
    });

    it('returns null when context not found', async () => {
      returningMock.mockResolvedValue([]);

      const result = await editContext({ id: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('deleteContext', () => {
    it('deletes and returns the context', async () => {
      returningMock.mockResolvedValue([{ id: 'ctx-1' }]);

      const result = await deleteContext({ id: 'ctx-1' });

      expect(db.delete).toHaveBeenCalled();
      expect(result).toEqual({ id: 'ctx-1' });
    });

    it('returns null when context not found', async () => {
      returningMock.mockResolvedValue([]);

      const result = await deleteContext({ id: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('globalContexts', () => {
    it('returns all global contexts', async () => {
      const contexts = [{ id: '1', scope: 'global', field: 'a' }, { id: '2', scope: 'global', field: 'b' }];
      thenMock.mockImplementation((onfulfilled: any) => { onfulfilled(contexts); return undefined; });

      const result = await globalContexts();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(contexts);
    });

    it('returns empty array when no global contexts', async () => {
      thenMock.mockImplementation((onfulfilled: any) => { onfulfilled([]); return undefined; });

      const result = await globalContexts();

      expect(result).toEqual([]);
    });
  });

  describe('contextBySession', () => {
    it('returns contexts for a given session', async () => {
      const contexts = [{ id: '1', sessionId: 'sess-1' }];
      thenMock.mockImplementation((onfulfilled: any) => { onfulfilled(contexts); return undefined; });

      const result = await contextBySession({ sessionId: 'sess-1' });

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(contexts);
    });

    it('returns empty array when session has no contexts', async () => {
      thenMock.mockImplementation((onfulfilled: any) => { onfulfilled([]); return undefined; });

      const result = await contextBySession({ sessionId: 'empty-session' });

      expect(result).toEqual([]);
    });
  });
});
