import { COLOR } from "@/theme/theme";

interface AvatarProps {
  size?: number;
  nombre: string;
}

function getInitials(nombre?: string): string {
  if (!nombre) return "?";

  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    // Take up to two characters from a single-word name
    return parts[0].slice(0, 2).toUpperCase();
  }

  // Use the first letter of the first two words
  const first = parts[0][0] ?? "";
  const second = parts[1][0] ?? "";
  return (first + second).toUpperCase();
}

export default function Avatar({ size = 40, nombre }: AvatarProps) {
  const initials = getInitials(nombre);

  const fontSize = Math.max(12, Math.round(size * 0.4));

  const avatarStyle = {
    ...styles.avatar,
    width: size,
    height: size,
    fontSize,
  };

  return <div style={avatarStyle}>{initials}</div>;
}

const styles = {
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 16,
  },
};
