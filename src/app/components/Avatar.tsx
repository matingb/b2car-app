import { COLOR } from "@/theme/theme";

interface AvatarProps {
  size?: number;
  nombre: string;
}

export default function Avatar({ size = 40, nombre }: AvatarProps) {
  return (
    <div style={{ ...styles.avatar, width: size, height: size }}>
      {(nombre?.[0] ?? "") || "?"}
    </div>
  );
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
