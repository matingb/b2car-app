import { COLOR } from "@/theme/theme";

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Card({ children, onClick, style }: CardProps) {
  return (
    <div style={{ ...styles.container, ...style }} onClick={onClick}>
      {children}
    </div>
  );
}

const styles = {
  container: {
    padding: "12px 16px",
    border: "1px solid " + COLOR.BORDER.SUBTLE,
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  },
};
