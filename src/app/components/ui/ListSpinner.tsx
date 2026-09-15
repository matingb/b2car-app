"use client";

import React from "react";
import { LoaderCircle } from "lucide-react";
import { COLOR } from "@/theme/theme";

type Props = {
  dataTestId?: string;
};

export default function ListSpinner({ dataTestId }: Props) {
  return (
    <div style={styles.container} data-testid={dataTestId}>
      <LoaderCircle className="animate-spin" size={28} color={COLOR.ACCENT.PRIMARY} />
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "48px 24px",
    marginTop: 8,
  },
};
