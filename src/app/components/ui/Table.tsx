"use client";

import React from "react";
import { css, type Interpolation, type Theme } from "@emotion/react";
import { COLOR } from "@/theme/theme";

export type TableAlign = "left" | "right" | "center";

export type TableProps = React.HTMLAttributes<HTMLDivElement> & {
  css?: Interpolation<Theme>;
  children: React.ReactNode;
};

export type TableHeaderProps = React.HTMLAttributes<HTMLTableRowElement> & {
  css?: Interpolation<Theme>;
  children: React.ReactNode;
};

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement> & {
  css?: Interpolation<Theme>;
  children: React.ReactNode;
};

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement> & {
  css?: Interpolation<Theme>;
  children: React.ReactNode;
};

export type TableHeadProps = Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "align" | "color"> & {
  align?: TableAlign;
  color?: string;
  weight?: React.CSSProperties["fontWeight"];
  fontWeight?: React.CSSProperties["fontWeight"];
  css?: Interpolation<Theme>;
  children?: React.ReactNode;
};

export type TableCellProps = Omit<React.TdHTMLAttributes<HTMLTableCellElement>, "align" | "color"> & {
  align?: TableAlign;
  nowrap?: boolean;
  color?: string;
  weight?: React.CSSProperties["fontWeight"];
  fontWeight?: React.CSSProperties["fontWeight"];
  css?: Interpolation<Theme>;
  children?: React.ReactNode;
};

function TableRoot({ children, className, css: customCss, ...rest }: TableProps) {
  return (
    <div css={[styles.tableCard, customCss]} className={className} {...rest}>
      <table css={styles.table}>{children}</table>
    </div>
  );
}

function TableHeader({ children, className, css: customCss, ...rest }: TableHeaderProps) {
  return (
    <thead>
      <tr css={[styles.theadRow, customCss]} className={className} {...rest}>
        {children}
      </tr>
    </thead>
  );
}

function TableBody({ children, className, css: customCss, ...rest }: TableBodyProps) {
  return (
    <tbody css={customCss} className={className} {...rest}>
      {children}
    </tbody>
  );
}

function TableRow({ children, className, css: customCss, onClick, ...rest }: TableRowProps) {
  return (
    <tr
      css={[styles.tr, Boolean(onClick) && styles.trClickable, customCss]}
      className={className}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

function TableHead({
  children,
  align = "left",
  color,
  weight,
  fontWeight,
  className,
  style,
  css: customCss,
  ...rest
}: TableHeadProps) {
  const resolvedWeight = weight ?? fontWeight;
  const inlineStyles: React.CSSProperties = {
    ...(color !== undefined && { color }),
    ...(resolvedWeight !== undefined && { fontWeight: resolvedWeight }),
    ...style,
  };

  return (
    <th
      css={[styles.th, styles.align[align], customCss]}
      style={Object.keys(inlineStyles).length > 0 ? inlineStyles : undefined}
      className={className}
      {...rest}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
  nowrap = true,
  color,
  weight,
  fontWeight,
  className,
  style,
  css: customCss,
  ...rest
}: TableCellProps) {
  const resolvedWeight = weight ?? fontWeight;
  const inlineStyles: React.CSSProperties = {
    ...(color !== undefined && { color }),
    ...(resolvedWeight !== undefined && { fontWeight: resolvedWeight }),
    ...style,
  };

  return (
    <td
      css={[
        styles.td,
        nowrap && styles.nowrap,
        styles.align[align],
        customCss,
      ]}
      style={Object.keys(inlineStyles).length > 0 ? inlineStyles : undefined}
      className={className}
      {...rest}
    >
      {children}
    </td>
  );
}

const styles = {
  tableCard: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflowX: "auto",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  }),
  table: css({
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    textAlign: "left",
  }),
  theadRow: css({
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  }),
  th: css({
    padding: "12px 16px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
  }),
  tr: css({
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    transition: "background-color 150ms ease",
    "&:last-child": {
      borderBottom: "none",
    },
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  trClickable: css({
    cursor: "pointer",
  }),
  td: css({
    padding: "12px 16px",
    verticalAlign: "middle",
    color: COLOR.TEXT.PRIMARY,
  }),
  nowrap: css({
    whiteSpace: "nowrap",
  }),
  align: {
    left: css({ textAlign: "left" }),
    right: css({ textAlign: "right" }),
    center: css({ textAlign: "center" }),
  },
} as const;

export const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
});

export default Table;

