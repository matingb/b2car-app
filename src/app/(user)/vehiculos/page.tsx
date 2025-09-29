export default function VehiculosPage() {
  return (
    <div>
      <h1 style={styles.title}>Vehículos</h1>
      <p style={styles.subtitle}>Listado y gestión de vehículos.</p>
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


