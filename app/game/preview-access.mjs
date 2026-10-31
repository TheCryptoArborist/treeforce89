export const PREVIEW_BRANCH = 'feature/tree-paid-continue';

// Trust Netlify runtime metadata, never a browser-supplied preview flag.
// Function artifacts can be reused across deploys of the same Git branch;
// their build deploy ID is not necessarily the current runtime deploy ID.
export function previewAccessAllowed(build, context, request) {
  if (build?.branch !== PREVIEW_BRANCH || !context?.deploy?.id ||
      !['branch-deploy','deploy-preview'].includes(build.context) ||
      !['branch-deploy','deploy-preview'].includes(context.deploy.context) ||
      context.site?.id !== '35f5591a-5c7d-4bc6-ae9a-3e61e816b641') return false;
  const hosts = new Set([
    `${context.deploy.id}--treeforce89.netlify.app`,
    context.deploy.context === 'branch-deploy'
      ? 'feature-tree-paid-continue--treeforce89.netlify.app'
      : 'deploy-preview-7--treeforce89.netlify.app',
    // Reserved for the existing TREE FORCE branch deployment only. Netlify
    // domain/DNS configuration must independently route this hostname to
    // this exact site and branch; never attach it to production main.
    ...(context.deploy.context === 'branch-deploy' && build.context === 'branch-deploy'
      ? ['preview.tree-token.xyz'] : []),
  ]);
  const url = new URL(request.url);
  return url.protocol === 'https:' && hosts.has(url.host);
}
