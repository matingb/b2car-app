import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchBar from "./SearchBar";

describe("SearchBar", () => {
  it("renderiza el input con el placeholder y el icono de búsqueda", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        placeholder="Buscar clientes..."
        inputTestId="test-search-input"
      />
    );

    const input = screen.getByTestId("test-search-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Buscar clientes...");

    const icon = screen.getByTestId("search-bar-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("llama a onChange cuando el usuario escribe", () => {
    const handleChange = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={handleChange}
        inputTestId="test-search-input"
      />
    );

    const input = screen.getByTestId("test-search-input");
    fireEvent.change(input, { target: { value: "toyota" } });

    expect(handleChange).toHaveBeenCalledWith("toyota");
  });
});
