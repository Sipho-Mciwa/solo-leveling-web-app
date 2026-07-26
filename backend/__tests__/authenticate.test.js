const mockVerifyIdToken = jest.fn();
jest.mock('../config/firebase', () => ({
  db: {},
  auth: { verifyIdToken: (...args) => mockVerifyIdToken(...args) },
}));

const { authenticate } = require('../middleware/authenticate');

function buildReqRes(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  mockVerifyIdToken.mockReset();
});

describe('authenticate', () => {
  test('allows the authorized email through and sets req.userId', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', email: 'siphomciwa@gmail.com' });
    const { req, res, next } = buildReqRes('valid-token');

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-1');
    expect(res.statusCode).toBeNull();
  });

  test('rejects a valid token for any other email with 403', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-2', email: 'someoneelse@gmail.com' });
    const { req, res, next } = buildReqRes('valid-token');

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('rejects a missing Authorization header with 401', async () => {
    const { req, res, next } = buildReqRes(null);

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  test('rejects an invalid token with 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad token'));
    const { req, res, next } = buildReqRes('garbage-token');

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
