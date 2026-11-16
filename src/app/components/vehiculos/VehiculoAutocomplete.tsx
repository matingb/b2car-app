"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { type Vehiculo } from "@/model/types";
import { formatPatente } from "@/lib/vehiculos";
import { Car, User } from "lucide-react";
import { COLOR } from "@/theme/theme";

export interface VehiculoAutocompleteProps {
  value: string;
  onChange: (vehiculoId: string, vehiculo?: Vehiculo) => void;
  clienteId?: string;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  dataTestId?: string;
  hideClearButton?: boolean;
  vehiculos?: Vehiculo[];
}

export default function VehiculoAutocomplete({
  value,
  onChange,
  clienteId,
  placeholder,
  disabled = false,
  style,
  dataTestId = "vehiculo-autocomplete",
  hideClearButton = false,
  vehiculos: propsVehiculos,
}: VehiculoAutocompleteProps) {
  const { vehiculos: contextVehiculos, searchVehiculos, getVehiculoById } = useVehiculos();

  const defaultVehiculos = useMemo(
    () => propsVehiculos ?? contextVehiculos ?? [],
    [propsVehiculos, contextVehiculos]
  );

  const [resolvedSelectedVehiculo, setResolvedSelectedVehiculo] = useState<Vehiculo | null>(null);
  const [searchResults, setSearchResults] = useState<Vehiculo[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
  const [searchTerm, setSearchTerm] = useState("");

  const isVehiculoValue = Boolean(value);

  const selectedFromList = useMemo(() => {
    if (!isVehiculoValue) return undefined;
    return defaultVehiculos?.find?.((v) => String(v.id) === String(value));
  }, [defaultVehiculos, value, isVehiculoValue]);

  const selectedVehiculo =
    selectedFromList ??
    (isVehiculoValue &&
    resolvedSelectedVehiculo &&
    String(resolvedSelectedVehiculo.id) === String(value)
      ? resolvedSelectedVehiculo
      : undefined);

  // Resolve selected vehicle by ID if not in list
  useEffect(() => {
    if (!isVehiculoValue || selectedVehiculo) {
      return;
    }

    let isMounted = true;
    void getVehiculoById(value).then((found) => {
      if (isMounted && found && String(found.id) === String(value)) {
        setResolvedSelectedVehiculo(found);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [value, isVehiculoValue, selectedVehiculo, getVehiculoById]);

  const cancelPendingSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  const executeSearch = useCallback(
    async (term: string, targetClienteId?: string) => {
      const requestId = searchRequestIdRef.current;
      setIsSearching(true);
      try {
        const results = await searchVehiculos(term, {
          clienteId: targetClienteId,
          limit: 25,
        });
        if (requestId === searchRequestIdRef.current) {
          setSearchResults(results);
        }
      } catch {
        if (requestId === searchRequestIdRef.current) {
          setSearchResults([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [searchVehiculos]
  );

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

      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        searchTimeoutRef.current = null;
        await executeSearch(trimmed, clienteId);
      }, 250);
    },
    [cancelPendingSearch, executeSearch, clienteId]
  );

  // When clienteId changes: clear pending search, refresh search with new clienteId
  useEffect(() => {
    cancelPendingSearch();
    setSearchResults(null);
    setIsSearching(false);

    if (clienteId) {
      void executeSearch(searchTerm.trim(), clienteId);
    }
  }, [clienteId, cancelPendingSearch, executeSearch]);

  useEffect(() => {
    return () => {
      cancelPendingSearch();
    };
  }, [cancelPendingSearch]);

  const options = useMemo<AutocompleteOption[]>(() => {
    const list: AutocompleteOption[] = [];

    let sourceVehiculos = searchResults !== null ? searchResults : defaultVehiculos;

    if (clienteId) {
      sourceVehiculos = sourceVehiculos.filter(
        (v) => v.cliente_id != null && String(v.cliente_id) === String(clienteId)
      );
    }

    if (searchResults === null && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      sourceVehiculos = sourceVehiculos.filter((v) => {
        const patente = (v.patente ?? "").toLowerCase();
        const marca = (v.marca ?? "").toLowerCase();
        const modelo = (v.modelo ?? "").toLowerCase();
        const cliente = (v.nombre_cliente ?? "").toLowerCase();
        const nroInterno = (v.nro_interno ?? "").toLowerCase();
        return (
          patente.includes(q) ||
          marca.includes(q) ||
          modelo.includes(q) ||
          cliente.includes(q) ||
          nroInterno.includes(q)
        );
      });
    }

    const seenIds = new Set<string>();

    for (const v of sourceVehiculos) {
      seenIds.add(String(v.id));
      const formattedPlate = formatPatente(v.patente);
      const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
      const vehiculoDesc = marcaModelo ? `${formattedPlate} - ${marcaModelo}` : formattedPlate;
      const showCliente = Boolean(v.nombre_cliente && !clienteId);
      const label = showCliente
        ? `${vehiculoDesc} · ${v.nombre_cliente}`
        : vehiculoDesc;

      const labelNode = showCliente ? (
        <span style={styles.labelNode}>
          <span>{vehiculoDesc}</span>
          <span style={styles.clientInlineBadge}>
            <span style={styles.inlineSeparator}>·</span>
            <User size={12} style={{ color: COLOR.TEXT.SECONDARY, flexShrink: 0 }} />
            <span>{v.nombre_cliente}</span>
          </span>
        </span>
      ) : undefined;

      list.push({
        value: String(v.id),
        label,
        labelNode,
        icon: <Car size={16} />,
        searchText: `${v.patente} ${formattedPlate} ${v.marca} ${v.modelo} ${v.nombre_cliente ?? ""} ${v.nro_interno ?? ""}`,
      });
    }

    if (
      selectedVehiculo &&
      !seenIds.has(String(selectedVehiculo.id)) &&
      (!clienteId || String(selectedVehiculo.cliente_id) === String(clienteId))
    ) {
      const formattedPlate = formatPatente(selectedVehiculo.patente);
      const marcaModelo = [selectedVehiculo.marca, selectedVehiculo.modelo].filter(Boolean).join(" ");
      const vehiculoDesc = marcaModelo ? `${formattedPlate} - ${marcaModelo}` : formattedPlate;
      const showCliente = Boolean(selectedVehiculo.nombre_cliente && !clienteId);
      const label = showCliente
        ? `${vehiculoDesc} · ${selectedVehiculo.nombre_cliente}`
        : vehiculoDesc;

      const labelNode = showCliente ? (
        <span style={styles.labelNode}>
          <span>{vehiculoDesc}</span>
          <span style={styles.clientInlineBadge}>
            <span style={styles.inlineSeparator}>·</span>
            <User size={12} style={{ color: COLOR.TEXT.SECONDARY, flexShrink: 0 }} />
            <span>{selectedVehiculo.nombre_cliente}</span>
          </span>
        </span>
      ) : undefined;

      list.push({
        value: String(selectedVehiculo.id),
        label,
        labelNode,
        icon: <Car size={16} />,
      });
    }

    return list;
  }, [searchResults, defaultVehiculos, clienteId, searchTerm, selectedVehiculo]);

  const handleChange = (nextValue: string) => {
    const allKnown = [
      ...(searchResults ?? []),
      ...(defaultVehiculos ?? []),
      ...(selectedVehiculo ? [selectedVehiculo] : []),
    ];
    const match = nextValue
      ? allKnown.find((v) => String(v.id) === String(nextValue))
      : undefined;

    setResolvedSelectedVehiculo(match ?? null);
    onChange(nextValue, match);
  };

  const defaultPlaceholder = clienteId
    ? "Buscar vehículo del cliente..."
    : "Buscar por patente, modelo, cliente...";

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={placeholder ?? defaultPlaceholder}
      disabled={disabled}
      style={style}
      dataTestId={dataTestId}
      hideClearButton={hideClearButton}
      isLoading={isSearching}
      onSearchChange={handleSearchChange}
    />
  );
}

const styles = {
  labelNode: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  clientInlineBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 400,
  },
  inlineSeparator: {
    color: COLOR.TEXT.TERTIARY,
    marginRight: 2,
    userSelect: "none" as const,
  },
} as const;
