import type { Request } from "express";

/** Minimal Express Response double that records status/json/sendStatus for guard assertions. */
export interface MockResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  sendStatus: (code: number) => MockResponse;
  headersSent: boolean;
}

export function mockRes(): MockResponse {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    sendStatus(code: number) {
      this.statusCode = code;
      this.headersSent = true;
      return this;
    },
  } as MockResponse;
  return res;
}

/** Build a Request carrying only the fields the access-control guards read. */
export function mockReq(user?: { userId?: number; role: string; instituteId?: number | null }): Request {
  return { user: user as Request["user"] } as Request;
}

/** Records whether next() was called (i.e. the guard allowed the request through). */
export interface MockNext {
  (err?: unknown): void;
  called: boolean;
  error: unknown;
}

export function mockNext(): MockNext {
  const next = ((err?: unknown) => {
    next.called = true;
    next.error = err;
  }) as MockNext;
  next.called = false;
  next.error = undefined;
  return next;
}
