import * as SDK from "azure-devops-extension-sdk";

export interface WikiPageContent {
  content: string;
  /** ETag / version token required for the PATCH If-Match header. */
  version: string;
}

export interface WikiInfo {
  id: string;
  name: string;
  projectId: string;
}

export interface WikiPageSummary {
  path: string;
  id?: number;
  remoteUrl?: string;
}

/**
 * Returns the base URL for the current ADO organization.
 * Works whether the extension is loaded on dev.azure.com or a self-hosted server.
 */
async function getOrgUrl(): Promise<string> {
  const ctx = await SDK.getWebContext();
  return ctx.host.uri.replace(/\/$/, "");
}

/**
 * Returns authentication headers that can be used for ADO REST API calls.
 */
async function getBearerHeaders(): Promise<Record<string, string>> {
  const token = await SDK.getAccessToken();
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
}

/**
 * Fetches a wiki page including its content and ETag version.
 */
export async function getWikiPage(
  project: string,
  wikiIdentifier: string,
  pagePath: string
): Promise<WikiPageContent> {
  const orgUrl = await getOrgUrl();
  const encodedPath = encodeURIComponent(pagePath);
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?path=${encodedPath}&includeContent=true&api-version=7.1`;

  const headers = await getBearerHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to load wiki page "${pagePath}": ${response.status} ${response.statusText}`
    );
  }

  const version = response.headers.get("ETag") || "";
  const data = await response.json();
  return { content: data.content ?? "", version };
}

/**
 * Creates or updates a wiki page.
 * Pass the ETag `version` obtained from `getWikiPage` to enable optimistic
 * concurrency control.  Use an empty string to create a brand-new page.
 */
export async function saveWikiPage(
  project: string,
  wikiIdentifier: string,
  pagePath: string,
  content: string,
  version: string
): Promise<WikiPageContent> {
  const orgUrl = await getOrgUrl();
  const encodedPath = encodeURIComponent(pagePath);
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?path=${encodedPath}&api-version=7.1`;

  const headers: Record<string, string> = {
    ...(await getBearerHeaders()),
    // Required for updates; use "*" or omit only when creating a page.
    ...(version ? { "If-Match": version } : {}),
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to save wiki page "${pagePath}": ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`
    );
  }

  const newVersion = response.headers.get("ETag") || version;
  const data = await response.json();
  return { content: data.content ?? content, version: newVersion };
}

/**
 * Lists all wikis in the given project.
 */
export async function listWikis(project: string): Promise<WikiInfo[]> {
  const orgUrl = await getOrgUrl();
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis?api-version=7.1`;

  const headers = await getBearerHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to list wikis: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return (data.value ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    projectId: w.projectId,
  }));
}

/**
 * Lists all pages in a wiki (up to the first 1000).
 */
export async function listWikiPages(
  project: string,
  wikiIdentifier: string
): Promise<WikiPageSummary[]> {
  const orgUrl = await getOrgUrl();
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?recursionLevel=full&api-version=7.1`;

  const headers = await getBearerHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to list wiki pages: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  function flattenPages(page: any): WikiPageSummary[] {
    const pages: WikiPageSummary[] = [{ path: page.path, id: page.id, remoteUrl: page.remoteUrl }];
    if (page.subPages) {
      for (const sub of page.subPages) {
        pages.push(...flattenPages(sub));
      }
    }
    return pages;
  }

  return flattenPages(data);
}

/**
 * Uploads an image file to the wiki as an attachment and returns the
 * URL at which it can be embedded in wiki content.
 *
 * Returns: `{ displayUrl: string; markdownUrl: string }`
 *   - `displayUrl`  – Webview URL usable as an <img src> value.
 *   - `markdownUrl` – Relative path to embed in the markdown source.
 */
export async function uploadWikiAttachment(
  project: string,
  wikiIdentifier: string,
  fileName: string,
  fileData: ArrayBuffer
): Promise<{ displayUrl: string; markdownUrl: string }> {
  const orgUrl = await getOrgUrl();
  const encodedName = encodeURIComponent(fileName);
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/attachments?name=${encodedName}&api-version=7.1`;

  const token = await SDK.getAccessToken();
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/octet-stream",
    },
    body: fileData,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload attachment "${fileName}": ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const displayUrl: string = data.url ?? "";
  // Markdown-friendly relative attachment path expected by ADO wiki
  const markdownUrl = `.attachments/${fileName}`;
  return { displayUrl, markdownUrl };
}
