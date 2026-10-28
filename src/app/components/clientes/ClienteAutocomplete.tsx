"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useClientes } from "@/app/providers/ClientesProvider";
import { type Cliente, TipoCliente } from "@/model/types";
import { formatClienteDocumento } from "@/lib/documentos";

export const CREATE_CLIENTE_VALUE = "__create_cliente__";

export interface ClienteAutocompleteProps {
  value: string;
  onChange: (clienteId: string, cliente?: Cliente) => void;
  tipoCliente?: "particular" | "empresa";
  allowCreate?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  dataTestId?: string;
  hideClearButton?: boolean;
  clientes?: Cliente[];
}

export default function ClienteAutocomplete({
  value,
  onChange,
  tipoCliente,
  allowCreate = false,
  createLabel = "+ Crear cliente",
  onCreateClick,
  placeholder = "Buscar o seleccionar cliente...",
  disabled = false,
  style,
  dataTestId,
  hideClearButton = false,
  clientes: propsClientes,
}: ClienteAutocompleteProps) {
  const clientesContext = useClientes();
  const contextClientes = clientesContext?.clientes;
  const clientes = useMemo(
    () => propsClientes ?? contextClientes ?? [],
    [propsClientes, contextClientes]
  );
  const isInitialLoading = clientesContext ? clientesContext.loading : false;
  const searchClientes = clientesContext?.searchClientes;
  const getClienteById = clientesContext?.getClienteById;

  const [resolvedSelectedCliente, setResolvedSelectedCliente] = useState<Cliente | null>(null);
  const [searchResults, setSearchResults] = useState<Cliente[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Identifica la búsqueda vigente para descartar respuestas tardías.
  const searchRequestIdRef = useRef(0);

  const [searchTerm, setSearchTerm] = useState("");

  const isClienteValue = Boolean(value) && value !== CREATE_CLIENTE_VALUE;

  const selectedFromList = useMemo(() => {
    if (!isClienteValue) return undefined;
    return clientes?.find?.((c) => String(c.id) === String(value));
  }, [clientes, value, isClienteValue]);

  const selectedCliente =
    selectedFromList ??
    (isClienteValue &&
    resolvedSelectedCliente &&
    String(resolvedSelectedCliente.id) === String(value)
      ? resolvedSelectedCliente
      : undefined);

  useEffect(() => {
    if (!isClienteValue || selectedCliente) {
      return;
    }

    let isMounted = true;
    if (typeof getClienteById === "function") {
      void getClienteById(value).then((cliente) => {
        if (isMounted && cliente && String(cliente.id) === String(value)) {
          setResolvedSelectedCliente(cliente);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [value, isClienteValue, selectedCliente, getClienteById]);

  const cancelPendingSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      cancelPendingSearch();

      const trimmed = term.trim();
      if (!trimmed) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      const requestId = searchRequestIdRef.current;
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        searchTimeoutRef.current = null;
        try {
          const results = await searchClientes(trimmed, {
            tipo: tipoCliente,
            limit: 25,
          });
          if (requestId === searchRequestIdRef.current) {
            setSearchResults(results);
          }
        } finally {
          if (requestId === searchRequestIdRef.current) {
            setIsSearching(false);
          }
        }
      }, 250);
    },
    [searchClientes, tipoCliente, cancelPendingSearch]
  );

  // Un cambio de tipo invalida los resultados de búsquedas anteriores.
  useEffect(() => {
    cancelPendingSearch();
    setSearchResults(null);
    setIsSearching(false);
  }, [tipoCliente, cancelPendingSearch]);

  useEffect(() => {
    return () => {
      cancelPendingSearch();
    };
  }, [cancelPendingSearch]);

  const options = useMemo<AutocompleteOption[]>(() => {
    const list: AutocompleteOption[] = [];

    if (allowCreate) {
      list.push({
        value: CREATE_CLIENTE_VALUE,
        label: createLabel,
        secondaryLabel: "Cargar datos del cliente nuevo",
      });
    }

    let sourceClientes = searchResults !== null ? searchResults : clientes;
    if (searchResults === null && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      sourceClientes = sourceClientes.filter((c) => {
        const doc = c.tipo_cliente === TipoCliente.PARTICULAR ? c.dni_cuil : c.cuit;
        return (
          c.nombre.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.telefono?.toLowerCase().includes(q) ||
          (doc && String(doc).toLowerCase().includes(q))
        );
      });
    }

    const filteredSource = tipoCliente
      ? sourceClientes.filter((c) => c.tipo_cliente === tipoCliente)
      : sourceClientes;

    const seenIds = new Set<string>();

    for (const c of filteredSource) {
      seenIds.add(String(c.id));
      list.push({
        value: String(c.id),
        label: c.nombre,
        secondaryLabel: formatClienteDocumento(c),
      });
    }

    if (
      selectedCliente &&
      !seenIds.has(String(selectedCliente.id)) &&
      (!tipoCliente || selectedCliente.tipo_cliente === tipoCliente)
    ) {
      list.push({
        value: String(selectedCliente.id),
        label: selectedCliente.nombre,
        secondaryLabel: formatClienteDocumento(selectedCliente),
      });
    }

    return list;
  }, [allowCreate, createLabel, searchResults, searchTerm, clientes, tipoCliente, selectedCliente]);

  const handleChange = (nextValue: string) => {
    if (nextValue === CREATE_CLIENTE_VALUE) {
      setResolvedSelectedCliente(null);
      onCreateClick?.();
      onChange(CREATE_CLIENTE_VALUE);
      return;
    }

    const allKnown = [
      ...(searchResults ?? []),
      ...(clientes ?? []),
      ...(selectedCliente ? [selectedCliente] : []),
    ];
    const match = nextValue
      ? allKnown.find((c) => String(c.id) === String(nextValue))
      : undefined;
    // Conserva el cliente elegido aunque no esté en el listado ni en los resultados siguientes.
    setResolvedSelectedCliente(match ?? null);
    onChange(nextValue, match);
  };

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      dataTestId={dataTestId}
      hideClearButton={hideClearButton}
      isLoading={isSearching || (isInitialLoading && clientes.length === 0)}
      onSearchChange={handleSearchChange}
    />
  );
}
