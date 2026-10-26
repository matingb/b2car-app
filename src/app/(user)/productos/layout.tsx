import { ProductosProvider } from "@/app/providers/ProductosProvider";
import { ProveedoresProvider } from "@/app/providers/ProveedoresProvider";

export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductosProvider>
      <ProveedoresProvider>{children}</ProveedoresProvider>
    </ProductosProvider>
  );
}
