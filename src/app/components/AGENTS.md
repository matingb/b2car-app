# UI Components & Frontend Instructions

This file guides UI component development and styling under `src/app/components/`.

## UI Components

Reusable UI components are located in `src/app/components/ui/` (import alias: `@/app/components/ui/...`).

Always check this directory before creating new UI elements to maintain visual and functional consistency across the application. Available components include:
- **Inputs & Selection**: `Button`, `IconButton`, `IconInput`, `NumberInput`, `PhoneInput`, `Checkbox`, `Toggle`, `Dropdown`, `DropdownMultiSelect`, `Autocomplete`, `SearchBar`, `FilterChip`, `ObservacionesCollapsible`
- **Modals & Overlays**: `Modal`, `ModalMessage`, `MenuSheet`, `sheet`
- **Layout & Display**: `Card`, `EntityProfileCard`, `ScreenHeader`, `ScrollPage`, `Divider`, `DefinitionItem`, `ListSkeleton`, `Avatar`, `Calendar`
- **Domain UI**: `TallerSelector`, `TenantNameText`, `ContactRow`, `WhatsAppIcon`

### Client selection

Every editable input that selects an existing client (vehicle owner, turno client, reassignment, etc.) must reuse `ClienteAutocomplete` from `@/app/components/clientes/ClienteAutocomplete`. It searches on the server through `GET /api/clientes` (`searchClientes`), keeps the selected client and resolves IDs outside the loaded list. Do not build client options only from the preloaded `clientes` of `ClientesProvider`: that list is paginated, so clients outside the first page would be unreachable. Use the second argument of its `onChange(clienteId, cliente)` when the form needs the selected client's data (type, name).

This rule does not apply to read-only client fields, client type selectors, fiscal receiver data, or list filters.

## Styling & Theme

Always use the design tokens and CSS variables defined in `src/globals.css` and `src/theme/theme.ts`.
Avoid hardcoding color hex values or using `!important` unless strictly necessary.
