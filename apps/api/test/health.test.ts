import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './helper.js';

describe('API Health Check', () => {
  const app = createTestApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ status: 'ok' });
  });
});
