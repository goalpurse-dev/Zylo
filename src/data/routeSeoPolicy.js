export const SITE_URL = "https://www.tryzyvo.com";

// Central indexing policy for application/workspace routes. These entries are
// based on the route's actual UI and access behavior, not on the /workspace/
// prefix. Public SEO landing pages live outside this registry.
export const WORKSPACE_ROUTE_SEO_POLICIES = [
  { path: "/workspace/home", seoVisibility: "noindex", routeType: "private-app", title: "Zyvo Workspace" },
  { path: "/workspace/creations", seoVisibility: "noindex", routeType: "private-app", title: "Zyvo Creations" },
  { path: "/workspace/creations/viral-videos", seoVisibility: "noindex", routeType: "private-app", title: "Zyvo Viral Video Creations" },
  { path: "/workspace/image-generator", seoVisibility: "noindex", routeType: "credit-application", title: "Zyvo AI Image Generator" },
  { path: "/workspace/video-generator", seoVisibility: "noindex", routeType: "credit-application", title: "Zyvo AI Video Generator" },
  { path: "/workspace/viral-script", seoVisibility: "noindex", routeType: "credit-application", title: "Zyvo Viral Script Generator" },
  { path: "/workspace/viral-score", seoVisibility: "noindex", routeType: "credit-application", title: "Zyvo Viral Score" },
  { path: "/workspace/lip-sync", seoVisibility: "noindex", routeType: "credit-application", title: "Zyvo Lip Sync" },
  { path: "/workspace/ai-fruit-story", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/ai-fruit-story-maker", title: "Zyvo AI Fruit Story" },
  { path: "/workspace/face-asmr", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/face-asmr-maker", title: "Zyvo Face ASMR" },
  { path: "/workspace/skeleton-shorts", seoVisibility: "noindex", routeType: "credit-template", title: "Zyvo Skeleton Shorts" },
  { path: "/workspace/micro-camera-animal", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/micro-camera-animal-maker", title: "Zyvo Micro Camera Animal" },
  { path: "/workspace/clay-rescue", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/clay-rescue-maker", title: "Zyvo Clay Rescue" },
  { path: "/workspace/ai-cooking-matic", seoVisibility: "noindex", routeType: "credit-template", title: "Zyvo AI Cooking Matic" },
  { path: "/workspace/footballer-nationality-swap", seoVisibility: "noindex", routeType: "paid-template", title: "Zyvo Footballer Nationality Swap" },
  { path: "/workspace/two-am", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/2am-worlds-ai-generator", title: "Zyvo 2AM Worlds" },
  { path: "/workspace/cartoon-drive-by", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/cartoon-drive-by-video-maker", title: "Zyvo Cartoon Drive-By" },
  { path: "/workspace/behind-the-scenes", seoVisibility: "noindex", routeType: "paid-template", title: "Zyvo Behind the Scenes" },
  { path: "/workspace/publishv", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/publish", title: "Zyvo Publish" },
  { path: "/workspace/stats", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/stats", title: "Zyvo Stats" },
  { path: "/workspace/connections", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/connections", title: "Zyvo Connections" },
  { path: "/workspace/image-gen-test", seoVisibility: "noindex", routeType: "test", title: "Zyvo Image Generator Test" },
  {
    path: "/workspace/pricing",
    seoVisibility: "public",
    routeType: "public-marketing",
    title: "Zyvo Pricing – Plans for AI Content Creation",
    description: "Compare Zyvo plans and credits for AI image, video, and short-form content creation tools.",
  },
];

export function getWorkspaceRouteSeoPolicy(pathname) {
  return WORKSPACE_ROUTE_SEO_POLICIES.find((policy) => policy.path === pathname) || null;
}

export function getNoindexWorkspaceRoutes() {
  return WORKSPACE_ROUTE_SEO_POLICIES.filter((policy) => policy.seoVisibility === "noindex");
}

export function getPublicWorkspaceRoutes() {
  return WORKSPACE_ROUTE_SEO_POLICIES.filter((policy) => policy.seoVisibility === "public");
}
