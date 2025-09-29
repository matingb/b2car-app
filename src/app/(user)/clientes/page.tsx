export default function ClientesPage() {
  return (
    <div>
      <h1 style={styles.title}>Clientes</h1>
      <p style={styles.subtitle}>Gestión de clientes.</p>
    </div>
  );
}

const styles = {
  title: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
  },
  subtitle: {
    marginTop: "0.5rem",
    color: "#6b7280",
  },
} as const;


