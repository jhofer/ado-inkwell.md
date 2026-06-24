/**
 * Toolbar action handler for the inkwell.md "Edit with inkwell.md" menu item.
 *
 * This script is loaded in a hidden iframe by ADO when the menu item is shown.
 * It registers an `execute` handler that, when the item is clicked, navigates
 * the host page to the inkwell.md hub with the current wiki page pre-loaded.
 */
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  IHostNavigationService,
} from "azure-devops-extension-sdk";

SDK.init().then(async () => {
  const contributionId = SDK.getContributionId();

  SDK.register(contributionId, {
    execute: async (actionContext: Record<string, any>) => {
      try {
        // ADO passes different shapes depending on the wiki version.
        // Try every known property name so we stay compatible.
        const project: string =
          actionContext?.project?.name ??
          actionContext?.projectName ??
          actionContext?.teamProjectName ??
          "";

        const wikiId: string =
          actionContext?.wiki?.id ??
          actionContext?.wiki?.objectId ??
          actionContext?.wikiId ??
          "";

        const pagePath: string =
          actionContext?.page?.path ??
          actionContext?.pagePath ??
          "/";

        const ctx = SDK.getExtensionContext();
        const hubContributionId = `${ctx.publisherId}.${ctx.extensionId}.inkwell-wiki-hub`;

        // Build the hash so the hub knows which page to load immediately.
        const hash = [
          `wikiId=${encodeURIComponent(wikiId)}`,
          `pagePath=${encodeURIComponent(pagePath)}`,
          `project=${encodeURIComponent(project)}`,
        ].join("&");

        // Build the hub URL.  ADO extensions are served at:
        //   https://dev.azure.com/{org}/{project}/_apps/hub/{contributionId}
        const webContext = await SDK.getWebContext();
        const orgUrl = webContext.host.uri.replace(/\/$/, "");
        const hubUrl = `${orgUrl}/${encodeURIComponent(project)}/_apps/hub/${hubContributionId}#${hash}`;

        const navService = await SDK.getService<IHostNavigationService>(
          CommonServiceIds.HostNavigationService
        );
        navService.navigate(hubUrl);
      } catch (err) {
        console.error("inkwell.md toolbar action error:", err);
      }
    },
  });

  await SDK.notifyLoadSucceeded();
});
