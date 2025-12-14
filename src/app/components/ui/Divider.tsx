interface DividerProps {
  orientation?: "horizontal" | "vertical";
}

export default function Divider({ orientation = "horizontal" }: DividerProps) {
  const style: React.CSSProperties =
    orientation === "vertical"
      ? {
          width: "1px",
          alignSelf: "stretch",
          backgroundColor: "#00000025",
        }
      : {
          height: "1px",
          width: "100%",
          backgroundColor: "#00000025",
        };

  return <div style={style} />;
}

