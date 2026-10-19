import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrintableDocumentViewer from "./PrintableDocumentViewer";

describe("PrintableDocumentViewer", () => {
  const sampleHtml = "<!doctype html><html><body><h1>Factura</h1></body></html>";

  it("renderiza el visor y el iframe con el srcDoc especificado", () => {
    render(<PrintableDocumentViewer htmlContent={sampleHtml} title="Vista previa" />);

    const container = screen.getByTestId("printable-document-viewer");
    expect(container).toBeDefined();

    const iframe = screen.getByTitle("Vista previa") as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("srcdoc")).toBe(sampleHtml);
  });

  it("reenvía la referencia externa hacia el HTMLIFrameElement mediante forwardRef", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    render(<PrintableDocumentViewer ref={iframeRef} htmlContent={sampleHtml} title="Iframe Ref Test" />);

    expect(iframeRef.current).toBeInstanceOf(HTMLIFrameElement);
    expect(iframeRef.current?.getAttribute("title")).toBe("Iframe Ref Test");
  });

  it("modifica el zoom al recibir eventos de rueda con ctrlKey (gesto trackpad Chrome en Mac)", async () => {
    render(<PrintableDocumentViewer htmlContent={sampleHtml} />);

    const container = screen.getByTestId("printable-document-viewer");
    expect(container.getAttribute("data-zoom")).toBe("1");

    await act(async () => {
      container.dispatchEvent(
        new WheelEvent("wheel", {
          ctrlKey: true,
          deltaY: -50,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    const newZoom = parseFloat(container.getAttribute("data-zoom") || "1");
    expect(newZoom).toBeGreaterThan(1);
  });

  it("modifica el zoom al recibir eventos gesturestart y gesturechange (gesto trackpad Safari en Mac)", async () => {
    render(<PrintableDocumentViewer htmlContent={sampleHtml} />);

    const container = screen.getByTestId("printable-document-viewer");
    expect(container.getAttribute("data-zoom")).toBe("1");

    await act(async () => {
      const gestureStartEvt = new Event("gesturestart", { bubbles: true, cancelable: true });
      container.dispatchEvent(gestureStartEvt);

      const gestureChangeEvt = new Event("gesturechange", { bubbles: true, cancelable: true });
      Object.defineProperty(gestureChangeEvt, "scale", { value: 1.4 });
      container.dispatchEvent(gestureChangeEvt);
    });

    const newZoom = parseFloat(container.getAttribute("data-zoom") || "1");
    expect(newZoom).toBeCloseTo(1.4, 1);
  });

  it("modifica el zoom con eventos touch de pellizco (2 dedos)", async () => {
    render(<PrintableDocumentViewer htmlContent={sampleHtml} />);

    const container = screen.getByTestId("printable-document-viewer");
    expect(container.getAttribute("data-zoom")).toBe("1");

    await act(async () => {
      const touch1 = { clientX: 100, clientY: 100 } as Touch;
      const touch2 = { clientX: 200, clientY: 100 } as Touch;
      const startEvt = new CustomEvent("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(startEvt, "touches", { value: [touch1, touch2] });
      container.dispatchEvent(startEvt);

      const touchMove1 = { clientX: 75, clientY: 100 } as Touch;
      const touchMove2 = { clientX: 225, clientY: 100 } as Touch;
      const moveEvt = new CustomEvent("touchmove", { bubbles: true, cancelable: true });
      Object.defineProperty(moveEvt, "touches", { value: [touchMove1, touchMove2] });
      container.dispatchEvent(moveEvt);
    });

    const newZoom = parseFloat(container.getAttribute("data-zoom") || "1");
    expect(newZoom).toBeGreaterThan(1);
  });

  it("permite restablecer el zoom al hacer clic en el badge indicador", async () => {
    render(<PrintableDocumentViewer htmlContent={sampleHtml} />);

    const container = screen.getByTestId("printable-document-viewer");

    await act(async () => {
      container.dispatchEvent(
        new WheelEvent("wheel", {
          ctrlKey: true,
          deltaY: -80,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(parseFloat(container.getAttribute("data-zoom") || "1")).toBeGreaterThan(1);

    const badge = screen.getByTestId("zoom-level-badge");
    await act(async () => {
      fireEvent.click(badge);
    });

    expect(parseFloat(container.getAttribute("data-zoom") || "1")).toBe(1);
  });
});
