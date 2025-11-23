"use client";

import React from "react";
import { Spinner, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { COLOR } from "@/theme/theme";

type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <Theme>
      <div style={styles.container}>
        <div style={styles.content}>
          <Spinner size="3" />
          {message && <p style={styles.message}>{message}</p>}
        </div>
      </div>
    </Theme>
  );
}

const styles = {
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    width: "100%",
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 16,
  },
  message: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
    margin: 0,
  },
};

