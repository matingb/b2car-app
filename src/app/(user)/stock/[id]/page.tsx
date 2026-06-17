"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { stocksClient } from "@/clients/stocksClient";
import { COLOR } from "@/theme/theme";

export default function StockDetailsRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("Redirigiendo al producto...");

  useEffect(() => {
    let cancelled = false;

    async function redirectToProducto() {
      const res = await stocksClient.getById(params.id);
      if (cancelled) return;

      const stock = res.data;
      if (!stock?.productoId) {
        setMessage(res.error || "No se encontro el stock solicitado.");
        return;
      }

      const tallerQuery = stock.tallerId ? `?tallerId=${encodeURIComponent(stock.tallerId)}` : "";
      router.replace(`/productos/${stock.productoId}${tallerQuery}`);
    }

    void redirectToProducto();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  return (
    <div>
      <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton />
      <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>{message}</div>
    </div>
  );
}
