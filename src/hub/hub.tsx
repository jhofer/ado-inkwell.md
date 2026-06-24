import React, { useCallback, useEffect, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-sdk";
import { AdoEditorHost } from "./adoEditorHost";
import { listWikis, listWikiPages, WikiInfo, WikiPageSummary } from "./adoWikiClient";

// ─── Global styles ────────────────────────────────────────────────────────────
// These are injected once at module load via a <style> tag to keep the bundle
// self-contained (no separate CSS file to serve).
const globalCss = `
.ado-inkwell-host {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.ado-inkwell-toolbar {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--background-color, #fff);
  border-bottom: 1px solid var(--palette-neutral-10, #edebe9);
  gap: 8px;
  flex-shrink: 0;
}
.ado-inkwell-page-path {
  font-size: 12px;
  color: var(--text-secondary-color, #605e5c);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ado-inkwell-save-btn {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  background: var(--communication-background, #0078d4);
  color: #fff;
  min-width: 80px;
  transition: background 0.15s;
}
.ado-inkwell-save-btn:hover:not(:disabled) {
  background: var(--communication-background-hover, #106ebe);
}
.ado-inkwell-save-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.ado-inkwell-save-saved {
  background: var(--success-text, #107c10) !important;
}
.ado-inkwell-save-error {
  background: var(--status-error-background, #a80000) !important;
}
.ado-inkwell-editor-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.ado-inkwell-loading,
.ado-inkwell-error {
  padding: 24px;
  color: var(--text-primary-color, #323130);
}
.ado-inkwell-error {
  color: var(--status-error-text, #a80000);
}
/* ── Picker ── */
.ado-inkwell-picker {
  max-width: 480px;
  margin: 40px auto;
  padding: 24px;
  font-family: inherit;
}
.ado-inkwell-picker h2 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.ado-inkwell-picker label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary-color, #323130);
}
.ado-inkwell-picker select,
.ado-inkwell-picker input {
  width: 100%;
  padding: 6px 8px;
  font-size: 14px;
  border: 1px solid var(--palette-neutral-20, #d2d0ce);
  border-radius: 2px;
  background: var(--background-color, #fff);
  color: var(--text-primary-color, #323130);
  margin-bottom: 16px;
}
.ado-inkwell-picker select:focus,
.ado-inkwell-picker input:focus {
  outline: none;
  border-color: var(--communication-background, #0078d4);
}
.ado-inkwell-picker-open-btn {
  padding: 8px 16px;
  font-size: 14px;
  border: none;
  border-radius: 2px;
  background: var(--communication-background, #0078d4);
  color: #fff;
  cursor: pointer;
}
.ado-inkwell-picker-open-btn:hover:not(:disabled) {
  background: var(--communication-background-hover, #106ebe);
}
.ado-inkwell-picker-open-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.ado-inkwell-picker-error {
  color: var(--status-error-text, #a80000);
  font-size: 13px;
  margin-bottom: 12px;
}
`;

function injectGlobalCss(css: string) {
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

injectGlobalCss(globalCss);

// ─── Types ────────────────────────────────────────────────────────────────────
interface EditorTarget {
  project: string;
  wikiId: string;
  pagePath: string;
}

// ─── Hub component ────────────────────────────────────────────────────────────
/**
 * Top-level component for the inkwell.md ADO Wiki hub contribution.
 *
 * Lifecycle:
 *  1. Initialise the ADO Extension SDK.
 *  2. Read navigation params from the URL hash (set by the toolbar action or
 *     manual navigation).
 *  3. If params are present, show the editor immediately.
 *  4. If no params are present, show a wiki / page picker so the user can
 *     choose what to edit.
 */
export function Hub() {
  const [sdkReady, setSdkReady] = useState(false);
  const [project, setProject] = useState<string>("");
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // ── SDK init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    SDK.init({ loaded: false })
      .then(async () => {
        // Determine project from SDK context.
        try {
          const projectService = await SDK.getService<IProjectPageService>(
            CommonServiceIds.ProjectPageService
          );
          const proj = await projectService.getProject();
          setProject(proj?.name ?? "");
        } catch {
          // Not critical – the user can still type the project name in picker.
        }

        // Parse URL hash for pre-filled editor target.
        const hashParams = parseHashParams(window.location.hash);
        const wikiId = hashParams.get("wikiId") ?? "";
        const pagePath = hashParams.get("pagePath") ?? "";
        const projectParam = hashParams.get("project") ?? "";

        if (wikiId && pagePath) {
          setTarget({
            project: projectParam || project,
            wikiId,
            pagePath,
          });
        }

        setSdkReady(true);
        await SDK.notifyLoadSucceeded();
      })
      .catch((err) => {
        setInitError(String(err));
        setSdkReady(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePickerOpen = useCallback((t: EditorTarget) => {
    setTarget(t);
    // Update hash so the URL can be bookmarked / refreshed.
    window.location.hash = `wikiId=${encodeURIComponent(t.wikiId)}&pagePath=${encodeURIComponent(t.pagePath)}&project=${encodeURIComponent(t.project)}`;
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      if (target) {
        setTarget({ ...target, pagePath: path });
        window.location.hash = `wikiId=${encodeURIComponent(target.wikiId)}&pagePath=${encodeURIComponent(path)}&project=${encodeURIComponent(target.project)}`;
      }
    },
    [target]
  );

  if (!sdkReady) {
    return <div className="ado-inkwell-loading">Initializing…</div>;
  }

  if (initError) {
    return (
      <div className="ado-inkwell-error">
        <strong>Failed to initialize:</strong> {initError}
      </div>
    );
  }

  if (target) {
    return (
      <AdoEditorHost
        project={target.project}
        wikiId={target.wikiId}
        pagePath={target.pagePath}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <WikiPagePicker
      defaultProject={project}
      onOpen={handlePickerOpen}
    />
  );
}

// ─── Wiki / page picker ───────────────────────────────────────────────────────
interface WikiPagePickerProps {
  defaultProject: string;
  onOpen: (target: EditorTarget) => void;
}

function WikiPagePicker({ defaultProject, onOpen }: WikiPagePickerProps) {
  const [projectInput, setProjectInput] = useState(defaultProject);
  const [wikis, setWikis] = useState<WikiInfo[]>([]);
  const [selectedWikiId, setSelectedWikiId] = useState<string>("");
  const [pages, setPages] = useState<WikiPageSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("/");
  const [loadingWikis, setLoadingWikis] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wikis when project changes.
  const handleLoadWikis = useCallback(async () => {
    if (!projectInput.trim()) return;
    setError(null);
    setLoadingWikis(true);
    try {
      const found = await listWikis(projectInput.trim());
      setWikis(found);
      if (found.length > 0) {
        setSelectedWikiId(found[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingWikis(false);
    }
  }, [projectInput]);

  // Load pages when wiki selection changes.
  useEffect(() => {
    if (!selectedWikiId || !projectInput.trim()) return;
    setError(null);
    setLoadingPages(true);
    listWikiPages(projectInput.trim(), selectedWikiId)
      .then((ps) => {
        setPages(ps);
        if (ps.length > 0) setSelectedPath(ps[0].path);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoadingPages(false));
  }, [selectedWikiId, projectInput]);

  const handleOpen = () => {
    if (!projectInput.trim() || !selectedWikiId || !selectedPath) return;
    onOpen({
      project: projectInput.trim(),
      wikiId: selectedWikiId,
      pagePath: selectedPath,
    });
  };

  return (
    <div className="ado-inkwell-picker">
      <h2>inkwell.md — Open wiki page</h2>

      {error && <div className="ado-inkwell-picker-error">{error}</div>}

      <label htmlFor="ado-project">Project</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          id="ado-project"
          value={projectInput}
          onChange={(e) => setProjectInput(e.target.value)}
          placeholder="e.g. MyProject"
          style={{ flex: 1, marginBottom: 0 }}
        />
        <button
          className="ado-inkwell-picker-open-btn"
          onClick={handleLoadWikis}
          disabled={loadingWikis || !projectInput.trim()}
          style={{ whiteSpace: "nowrap" }}
        >
          {loadingWikis ? "Loading…" : "Load wikis"}
        </button>
      </div>

      {wikis.length > 0 && (
        <>
          <label htmlFor="ado-wiki">Wiki</label>
          <select
            id="ado-wiki"
            value={selectedWikiId}
            onChange={(e) => setSelectedWikiId(e.target.value)}
          >
            {wikis.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <label htmlFor="ado-page">Page</label>
          {loadingPages ? (
            <div style={{ marginBottom: 16, fontSize: 13, color: "#888" }}>
              Loading pages…
            </div>
          ) : pages.length > 0 ? (
            <select
              id="ado-page"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              size={Math.min(pages.length, 8)}
              style={{ height: "auto" }}
            >
              {pages.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="ado-page"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="/Home"
            />
          )}

          <br />
          <button
            className="ado-inkwell-picker-open-btn"
            onClick={handleOpen}
            disabled={!selectedWikiId || !selectedPath}
            style={{ marginTop: 8 }}
          >
            Open in inkwell.md
          </button>
        </>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseHashParams(hash: string): Map<string, string> {
  const map = new Map<string, string>();
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of raw.split("&")) {
    const [key, ...rest] = pair.split("=");
    if (key) {
      map.set(decodeURIComponent(key), decodeURIComponent(rest.join("=")));
    }
  }
  return map;
}
