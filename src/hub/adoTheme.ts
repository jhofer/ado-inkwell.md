/**
 * An inkwell-md editor theme that maps to Azure DevOps's CSS variables.
 *
 * ADO injects theme variables via CSS custom properties on the `:root` element.
 * The variable names follow the pattern `--communication-*`, `--neutral-*`, etc.
 * We fall back to sensible defaults so the editor also looks fine in
 * environments where ADO variables are absent (e.g. local development).
 */
import { theme as defaultTheme } from "inkwell-md/src/client/editor";

export const adoTheme = {
  ...defaultTheme,

  // Typography
  fontFamily:
    "var(--font-family-default, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif)",
  fontFamilyMono:
    "var(--font-family-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace)",
  fontSize: "14px",

  // Colors – ADO uses a scoped custom-property scheme
  background: "var(--background-color, #ffffff)",
  text: "var(--text-primary-color, #323130)",
  link: "var(--communication-foreground, #0078d4)",
  code: "var(--text-primary-color, #323130)",
  cursor: "var(--text-primary-color, #323130)",
  divider: "var(--palette-neutral-10, #edebe9)",

  // Toolbar
  toolbarBackground: "var(--communication-background, #0078d4)",
  toolbarHoverBackground: "var(--communication-background-hover, #106ebe)",
  toolbarInput: "var(--communication-background, #0078d4)",
  toolbarItem: "#ffffff",

  // Table
  tableDivider: "var(--palette-neutral-20, #d2d0ce)",
  tableSelected: "var(--communication-background, #0078d4)",
  tableSelectedBackground: "var(--communication-tint40, #d0e7f8)",

  // Blocks
  quote: "var(--palette-neutral-4, #f3f2f1)",
  codeBackground: "var(--palette-neutral-4, #f3f2f1)",
  codeBorder: "transparent",
  horizontalRule: "var(--palette-neutral-20, #d2d0ce)",
  imageErrorBackground: "var(--palette-neutral-4, #f3f2f1)",

  // Scrollbar
  scrollbarBackground: "var(--palette-neutral-20, #d2d0ce)",
};
