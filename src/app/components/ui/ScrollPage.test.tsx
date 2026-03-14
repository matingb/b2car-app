import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ScrollPage from "./ScrollPage";

const SPINNER_MIN_MS = 750;

type IOCallback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

let observerCallback: IOCallback | null = null;

function setupIntersectionObserverMock() {
  observerCallback = null;
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation((cb: IOCallback) => {
      observerCallback = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
}

function triggerIntersection(isIntersecting = true) {
  act(() => {
    observerCallback?.([{ isIntersecting }] as IntersectionObserverEntry[]);
  });
}

describe("ScrollPage", () => {
  beforeEach(() => {
    setupIntersectionObserverMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renderiza los children", () => {
    render(<ScrollPage><span>contenido</span></ScrollPage>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("no renderiza el sentinel cuando hasMore es false", () => {
    render(<ScrollPage hasMore={false}><div /></ScrollPage>);
    expect(screen.queryByTestId("scroll-page-sentinel")).not.toBeInTheDocument();
  });

  it("renderiza el sentinel cuando hasMore es true", () => {
    render(<ScrollPage hasMore onLoadMore={vi.fn()}><div /></ScrollPage>);
    expect(screen.getByTestId("scroll-page-sentinel")).toBeInTheDocument();
  });

  it("muestra el spinner cuando loadingMore es true", () => {
    render(<ScrollPage loadingMore><div /></ScrollPage>);
    expect(screen.getByTestId("scroll-page-spinner")).toBeInTheDocument();
  });

  it("no muestra el spinner cuando loadingMore es false", () => {
    render(<ScrollPage loadingMore={false}><div /></ScrollPage>);
    expect(screen.queryByTestId("scroll-page-spinner")).not.toBeInTheDocument();
  });

  it("muestra el label personalizado en el spinner", () => {
    render(
      <ScrollPage loadingMore loadingMoreLabel="Cargando más arreglos...">
        <div />
      </ScrollPage>,
    );
    expect(screen.getByText("Cargando más arreglos...")).toBeInTheDocument();
  });

  it("llama a onLoadMore cuando el sentinel se intersecta", () => {
    const onLoadMore = vi.fn();
    render(
      <ScrollPage hasMore onLoadMore={onLoadMore}>
        <div />
      </ScrollPage>,
    );
    triggerIntersection();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("no llama a onLoadMore cuando loading es true", () => {
    const onLoadMore = vi.fn();
    render(
      <ScrollPage hasMore loading onLoadMore={onLoadMore}>
        <div />
      </ScrollPage>,
    );
    triggerIntersection();
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("el lock evita que onLoadMore se llame dos veces antes de que loadingMore se resetee", () => {
    const onLoadMore = vi.fn();
    render(
      <ScrollPage hasMore onLoadMore={onLoadMore}>
        <div />
      </ScrollPage>,
    );
    triggerIntersection();
    triggerIntersection();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it(`el spinner se mantiene visible al menos ${SPINNER_MIN_MS}ms aunque loadingMore cambie a false`, () => {
    vi.useFakeTimers();
    const { rerender } = render(<ScrollPage loadingMore><div /></ScrollPage>);

    rerender(<ScrollPage loadingMore={false}><div /></ScrollPage>);

    act(() => { vi.advanceTimersByTime(SPINNER_MIN_MS - 1); });
    expect(screen.getByTestId("scroll-page-spinner")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByTestId("scroll-page-spinner")).not.toBeInTheDocument();
  });

  it(`si loadingMore estuvo activo más de ${SPINNER_MIN_MS}ms, el spinner se oculta inmediatamente`, () => {
    vi.useFakeTimers();
    const { rerender } = render(<ScrollPage loadingMore><div /></ScrollPage>);

    act(() => { vi.advanceTimersByTime(SPINNER_MIN_MS + 100); });

    rerender(<ScrollPage loadingMore={false}><div /></ScrollPage>);
    expect(screen.queryByTestId("scroll-page-spinner")).not.toBeInTheDocument();
  });
});
