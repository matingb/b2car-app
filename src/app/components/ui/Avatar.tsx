import { COLOR } from "@/theme/theme";

interface AvatarProps {
  size?: number;
  nombre: string;
  bgColor?: string;
  textColor?: string;
}

import { getInitials } from "@/lib/initials";

export default function Avatar({ size = 40, nombre, bgColor, textColor }: AvatarProps) {
  const initials = getInitials(nombre);

  const fontSize = Math.max(12, Math.round(size * 0.4));

  const avatarStyle = {
    ...styles.avatar,
    width: size,
    height: size,
    fontSize,
    ...(bgColor && { background: bgColor }),
    ...(textColor && { color: textColor }),
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
