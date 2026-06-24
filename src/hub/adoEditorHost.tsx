import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor from "inkwell-md/src/client/editor";
import "inkwell-md/src/client/style.css";
import { adoTheme } from "./adoTheme";
import { renderPlantUml } from "./plantUmlClient";
import {
  getWikiPage,
  saveWikiPage,
  listWikiPages,
  uploadWikiAttachment,
  WikiPageContent,
  WikiPageSummary,
} from "./adoWikiClient";

// Minimal type mirroring the SearchResult shape expected by the Editor.
interface SearchResult {
  title: string;
  url: string;
  subtitle?: string;
}

// Debounce helper (mirrors the one in inkwell-md's utils).
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;

  const debounced = ((...args: any[]) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...(lastArgs as any[]));
      lastArgs = null;
    }, ms);
  }) as T & { flush: () => void };

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}

export interface AdoEditorHostProps {
  /** ADO project name. */
  project: string;
  /** Wiki identifier (name or ID). */
  wikiId: string;
  /** Full path of the page, e.g. "/Home/Overview". */
  pagePath: string;
  /** Called when the user navigates away via a wiki link. */
  onNavigate?: (path: string) => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function AdoEditorHost({
  project,
  wikiId,
  pagePath,
  onNavigate,
}: AdoEditorHostProps) {
  const [pageContent, setPageContent] = useState<WikiPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Track the current markdown in a ref so the debounced save closure always
  // has the latest value without needing to re-create the callback.
  const currentMarkdownRef = useRef<string>("");
  const versionRef = useRef<string>("");

  // ─── Load page ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getWikiPage(project, wikiId, pagePath)
      .then((page) => {
        if (cancelled) return;
        setPageContent(page);
        currentMarkdownRef.current = page.content;
        versionRef.current = page.version;
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoadError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project, wikiId, pagePath]);

  // ─── Auto-save (debounced, 1 s after last keystroke) ─────────────────────
  const performSave = useCallback(async () => {
    const markdown = currentMarkdownRef.current;
    const version = versionRef.current;
    setSaveStatus("saving");
    try {
      const updated = await saveWikiPage(
        project,
        wikiId,
        pagePath,
        markdown,
        version
      );
      versionRef.current = updated.version;
      setSaveStatus("saved");
      // Reset to "idle" after a brief flash
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err: any) {
      setSaveStatus("error");
      console.error("inkwell.md save error:", err);
    }
  }, [project, wikiId, pagePath]);

  const debouncedSave = useMemo(() => debounce(performSave, 1000), [performSave]);

  const handleChange = useCallback(
    (getVal: () => string) => {
      currentMarkdownRef.current = getVal();
      debouncedSave();
    },
    [debouncedSave]
  );

  const handleSave = useCallback(() => {
    debouncedSave.flush();
  }, [debouncedSave]);

  // ─── Link search (wiki pages) ─────────────────────────────────────────────
  const handleSearchLink = useCallback(
    async (term: string): Promise<SearchResult[]> => {
      try {
        const pages = await listWikiPages(project, wikiId);
        const lower = term.toLowerCase();
        return pages
          .filter((p: WikiPageSummary) =>
            p.path.toLowerCase().includes(lower)
          )
          .slice(0, 20)
          .map((p: WikiPageSummary) => ({
            title: p.path.split("/").pop() || p.path,
            url: p.path,
            subtitle: p.path,
          }));
      } catch {
        return [];
      }
    },
    [project, wikiId]
  );

  const handleCreateLink = useCallback(
    async (title: string): Promise<string> => {
      // Derive a page path from the title slug.
      const slug = title
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      return `/${slug}`;
    },
    []
  );

  // ─── Image upload ─────────────────────────────────────────────────────────
  const handleUploadImage = useCallback(
    async (file: File): Promise<string> => {
      const arrayBuffer = await file.arrayBuffer();
      const { displayUrl } = await uploadWikiAttachment(
        project,
        wikiId,
        file.name,
        arrayBuffer
      );
      return displayUrl;
    },
    [project, wikiId]
  );

  // ─── Link clicks ──────────────────────────────────────────────────────────
  const handleClickLink = useCallback(
    (href: string, _event: MouseEvent) => {
      if (href.startsWith("http://") || href.startsWith("https://")) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else if (onNavigate) {
        onNavigate(href);
      }
    },
    [onNavigate]
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="ado-inkwell-loading">Loading page…</div>;
  }

  if (loadError) {
    return (
      <div className="ado-inkwell-error">
        <strong>Could not load wiki page:</strong> {loadError}
      </div>
    );
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
      ? "Saved ✓"
      : saveStatus === "error"
      ? "Save failed ✗"
      : "Save";

  return (
    <div className="ado-inkwell-host">
      <div className="ado-inkwell-toolbar">
        <span className="ado-inkwell-page-path">{pagePath}</span>
        <button
          className={`ado-inkwell-save-btn ado-inkwell-save-${saveStatus}`}
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          title="Save the page (Ctrl+S also works)"
        >
          {saveLabel}
        </button>
      </div>
      <div className="ado-inkwell-editor-wrap">
        <Editor
          placeholder="Start writing…"
          theme={adoTheme}
          defaultValue={pageContent?.content ?? ""}
          onChange={handleChange}
          onSearchLink={handleSearchLink}
          onCreateLink={handleCreateLink}
          uploadImage={handleUploadImage}
          onClickLink={handleClickLink}
          onRenderPlantUml={renderPlantUml}
          onSave={handleSave}
          autoFocus
        />
      </div>
    </div>
  );
}
