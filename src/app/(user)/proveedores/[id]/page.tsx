"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import ProveedorModal from "@/app/components/proveedores/ProveedorModal";
import ProveedorProfileCard from "@/app/components/proveedores/ProveedorProfileCard";
import ProveedorTabsNav, { type ProveedorTabKey } from "@/app/components/proveedores/ProveedorTabsNav";
import ProveedorProductosTab from "@/app/components/proveedores/ProveedorProductosTab";
import ProveedorOperacionesTab from "@/app/components/proveedores/ProveedorOperacionesTab";
import ProveedorCuentaCorrienteTab from "@/app/components/proveedores/ProveedorCuentaCorrienteTab";
import OperacionCreateModal from "@/app/components/operaciones/OperacionCreateModal";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import { Permission } from "@/lib/permissions";
import type { Proveedor } from "@/model/types";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";

export default function ProveedorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const modal = useModalMessage();
  const toast = useToast();
  const { talleres, hasPermission } = useTenant();
  const { updateProveedor, deleteProveedor } = useProveedores();

  const canViewFinanzas = hasPermission(Permission.OperacionesView);

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [compraModalOpen, setCompraModalOpen] = useState(false);
  const [compraProductoId, setCompraProductoId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ProveedorTabKey>("productos");
  const [productosCount, setProductosCount] = useState<number | undefined>(undefined);
  const [operacionesCount, setOperacionesCount] = useState<number | undefined>(undefined);

  const [cuentaCorrienteResumen, setCuentaCorrienteResumen] =
    useState<ProveedorCuentaCorrienteResumen | null>(null);
  const [loadingFinanzas, setLoadingFinanzas] = useState(false);

  const loadFinanzas = useCallback(async () => {
    if (!params.id || !canViewFinanzas) return;
    setLoadingFinanzas(true);
    try {
      const res = await proveedoresClient.getOperaciones(params.id);
      if (res.data) {
        setCuentaCorrienteResumen(res.data);
        setOperacionesCount(res.data.operaciones?.length ?? 0);
      }
    } catch {} finally {
      setLoadingFinanzas(false);
    }
  }, [params.id, canViewFinanzas]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    proveedoresClient
      .getById(params.id)
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(res.error || "Proveedor no encontrado");
        } else {
          setProveedor(res.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (params.id && canViewFinanzas) {
      void loadFinanzas();
    }
  }, [params.id, canViewFinanzas, loadFinanzas]);

  const handleDelete = async () => {
    if (!proveedor) return;
    const ok = await modal.confirm({
      title: "Eliminar proveedor",
      message: `¿Estás seguro de que querés eliminar a "${proveedor.nombre}"? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteProveedor(proveedor.id);
      toast.success("Proveedor eliminado", "El proveedor se eliminó correctamente.");
      router.push(ROUTES.proveedores);
    } catch (err: unknown) {
      toast.error(
        "No se pudo eliminar el proveedor",
        err instanceof Error ? err.message : "Error inesperado"
      );
    }
  };

  const handleEditSubmit = async (values: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }) => {
    if (!proveedor) return;
    const updated = await updateProveedor(proveedor.id, values);
    setProveedor(updated);
    toast.success("Proveedor actualizado", "Los datos se guardaron correctamente.");
  };

  if (loading) {
    return (
      <div>
        <ScreenHeader title="Proveedores" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={styles.loadingContainer}>Cargando datos del proveedor...</div>
      </div>
    );
  }

  if (error || !proveedor) {
    return (
      <div>
        <ScreenHeader title="Proveedores" breadcrumbs={["Detalle"]} hasBackButton />
        <Card style={styles.errorCard}>
          <div style={styles.errorTitle}>Proveedor no encontrado</div>
          <div style={styles.errorSub}>
            {error || "El proveedor solicitado no existe o fue eliminado."}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button
              text="Volver a Proveedores"
              onClick={() => router.push(ROUTES.proveedores)}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader
        title="Proveedores"
        breadcrumbs={["Detalle"]}
        hasBackButton
      />

      <ProveedorProfileCard
        proveedor={proveedor}
        resumenCuentaCorriente={cuentaCorrienteResumen}
        loadingFinanzas={loadingFinanzas}
        onEditProveedor={() => setEditModalOpen(true)}
        onDeleteProveedor={handleDelete}
      />

      <ProveedorTabsNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        productosCount={productosCount}
        operacionesCount={operacionesCount}
      />

      {activeTab === "productos" && (
        <ProveedorProductosTab
          proveedorId={proveedor.id}
          proveedorNombre={proveedor.nombre}
          onComprarProducto={(productoId) => {
            setCompraProductoId(productoId);
            setCompraModalOpen(true);
          }}
          onCountChange={setProductosCount}
        />
      )}

      {activeTab === "operaciones" && (
        <ProveedorOperacionesTab
          proveedorId={proveedor.id}
          proveedorNombre={proveedor.nombre}
          onCountChange={setOperacionesCount}
          onNuevaCompra={() => {
            setCompraProductoId(null);
            setCompraModalOpen(true);
          }}
          onOperacionUpdated={() => void loadFinanzas()}
        />
      )}

      {activeTab === "cuenta_corriente" && (
        <ProveedorCuentaCorrienteTab
          proveedorId={proveedor.id}
          onCountChange={setOperacionesCount}
          onNuevaCompra={() => {
            setCompraProductoId(null);
            setCompraModalOpen(true);
          }}
        />
      )}

      <ProveedorModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        initialValues={proveedor}
      />

      {compraModalOpen ? (
        <OperacionesProvider>
          <InventarioProvider>
            <OperacionCreateModal
              open={compraModalOpen}
              talleres={talleres}
              initialTipo="COMPRA"
              initialProveedorId={proveedor.id}
              initialProductoId={compraProductoId}
              disabledProveedor
              onSuccess={async () => {
                setCompraModalOpen(false);
                setCompraProductoId(null);
                toast.success("Compra registrada", `Se registró la compra para ${proveedor.nombre}.`);
                void loadFinanzas();
              }}
              onClose={() => {
                setCompraModalOpen(false);
                setCompraProductoId(null);
              }}
            />
          </InventarioProvider>
        </OperacionesProvider>
      ) : null}
    </div>
  );
}

const styles = {
  loadingContainer: {
    padding: "32px 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  errorCard: {
    padding: 32,
    textAlign: "center" as const,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
  },
};
