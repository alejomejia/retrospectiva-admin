import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server";

// MSW intercepts HTTP calls in tests. External integrations (OpenAI, Etsy,
// website webhook) declare their handlers in src/test/msw-handlers.ts.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
