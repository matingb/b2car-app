interface CardProps {
  children: React.ReactNode;
}

export default function Card({ children }: CardProps) {
  return (
    <div style={styles.container}>
      {children}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    border: "1px solid #dedede",
    borderRadius: 8,
    background: "#f9f9f9",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
};
