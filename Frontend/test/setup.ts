import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { servidorMock } from "./servidor-mock";

beforeAll(() => servidorMock.listen({ onUnhandledRequest: "error" }));
afterEach(() => servidorMock.resetHandlers());
afterAll(() => servidorMock.close());
