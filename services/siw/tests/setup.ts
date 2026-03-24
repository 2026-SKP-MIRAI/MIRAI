import "@testing-library/jest-dom";

// JSDOM does not implement scrollIntoView — stub it globally (browser environment only)
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
