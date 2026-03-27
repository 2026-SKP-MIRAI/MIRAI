import "@testing-library/jest-dom";

// ENGINE_BASE_URL must be set before any route module is imported.
// process.env direct assignment is not affected by vi.unstubAllEnvs().
process.env.ENGINE_BASE_URL = "http://localhost:3001";

// JSDOM does not implement scrollIntoView — stub it globally (browser environment only)
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
