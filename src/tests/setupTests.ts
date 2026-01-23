import "@testing-library/jest-dom/vitest";

// Silence known JSDOM "Not implemented" noise.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && first.startsWith("Not implemented:")) {
    if (
      first.includes("Window's scrollTo() method") ||
      first.includes("HTMLFormElement's requestSubmit() method") ||
      first.includes("navigation to another Document")
    ) {
      return;
    }
  }
  originalConsoleError(...args);
};

// JSDOM limitations: avoid noisy "Not implemented" stderr in tests.
if (typeof window !== "undefined") {
  // Used by Modal (scroll lock / focus management)
  // En JSDOM suele existir pero no estar implementado, así que lo sobreescribimos.
  window.scrollTo = () => {};
}

// Used by form submit buttons inside Modal
if (typeof HTMLFormElement !== "undefined") {
  // En JSDOM puede existir pero tirar "Not implemented", así que lo sobreescribimos.
  const requestSubmitImpl = function requestSubmit(this: HTMLFormElement) {
    // Simula el comportamiento relevante para React: dispara el submit event.
    const event = new Event("submit", { bubbles: true, cancelable: true });
    this.dispatchEvent(event);
  };

  // En algunos entornos la propiedad existe pero no es writable; usamos defineProperty.
  try {
    Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
      value: requestSubmitImpl,
      writable: true,
      configurable: true,
    });
  } catch {
    // Fallback best-effort
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLFormElement.prototype as any).requestSubmit = requestSubmitImpl;
  }
}

