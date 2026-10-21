export const PREVIEW_BRANCH = 'feature/tree-paid-continue';

// Trust Netlify runtime metadata, never a browser-supplied preview flag.
export function previewAccessAllowed(build, context, request) {
  if (build?.branch !== PREVIEW_BRANCH || !build.deployId ||
      !['branch-deploy','deploy-preview'].includes(build.context) ||
      context?.deploy?.context !== build.context || context.deploy.id !== build.deployId) return false;
  const hosts = new Set([
    `${build.deployId}--treeforce89.netlify.app`,
    build.context === 'branch-deploy'
      ? 'feature-tree-paid-continue--treeforce89.netlify.app'
      : 'deploy-preview-7--treeforce89.netlify.app',
  ]);
  const url = new URL(request.url);
  return url.protocol === 'https:' && hosts.has(url.host);
}
