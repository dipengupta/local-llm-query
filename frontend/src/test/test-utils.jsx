import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

export function mockJsonResponse(data, overrides = {}) {
  const text = JSON.stringify(data);
  const response = {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
    status: 200,
    text: vi.fn().mockResolvedValue(text),
    ...overrides,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  return response;
}

export function mockJsonError(detail, status = 400) {
  return mockJsonResponse(
    { detail },
    {
      ok: false,
      status,
    },
  );
}

export function renderWithUser(ui) {
  return {
    user: userEvent.setup(),
    ...render(ui),
  };
}
