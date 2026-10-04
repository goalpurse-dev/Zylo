export const SITE_URL = "https://www.tryzyvo.com";

// Central indexing policy for application/workspace routes. These entries are
// based on the route's actual UI and access behavior, not on the /workspace/
// prefix. Public SEO landing pages live outside this registry.
// Home, at the site root. The title starts with the brand name.
export const HOME_SEO = {
  title: "Zyvo AI – AI Video Generator for YouTube, TikTok & Reels",
  description: "Zyvo turns one idea into finished videos: 8–15 minute YouTube explainers and viral 9:16 clips for TikTok, Reels and Shorts. Start free with 5 image generations.",
};

export const WORKSPACE_ROUTE_SEO_POLICIES = [
  { path: "/", seoVisibility: "public", routeType: "public-marketing", ...HOME_SEO },
  { path: "/workspace/creations", seoVisibility: "noindex", routeType: "private-app", title: "Zyvo Creations" },
  { path: "/workspace/creations/viral-videos", seoVisibility: "noindex", routeType: "private-app", title: "Zyvo Viral Video Creations" },
  { path: "/workspace/image-generator", seoVisibility: "noindex", routeType: "credit-application", publicLanding: "/image-generator", title: "Zyvo AI Image Generator" },
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
  { path: "/workspace/kit-swap", seoVisibility: "noindex", routeType: "paid-template", title: "Zyvo Kit Swap" },
  { path: "/workspace/two-am", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/2am-worlds-ai-generator", title: "Zyvo 2AM Worlds" },
  { path: "/workspace/thirty-days", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/30-days-video-maker", title: "Zyvo 30 Days Video Maker" },
  { path: "/workspace/cartoon-drive-by", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/cartoon-drive-by-video-maker", title: "Zyvo Cartoon Drive-By" },
  { path: "/workspace/behind-the-scenes", seoVisibility: "noindex", routeType: "paid-template", publicLanding: "/behind-the-scenes-video-maker", title: "Zyvo Behind the Scenes" },
  { path: "/workspace/publishv", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/publish", title: "Zyvo Publish" },
  { path: "/workspace/stats", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/stats", title: "Zyvo Stats" },
  { path: "/workspace/connections", seoVisibility: "noindex", routeType: "private-app", publicLanding: "/connections", title: "Zyvo Connections" },
  { path: "/workspace/image-gen-test", seoVisibility: "noindex", routeType: "test", title: "Zyvo Image Generator Test" },
  // The public pricing page (was /workspace/pricing: 301 in vercel.json).
  {
    path: "/pricing",
    seoVisibility: "public",
    routeType: "public-marketing",
    title: "Zyvo AI Pricing – Plans and Credits for AI Video Creation",
    description: "Compare Zyvo plans: Starter, Pro and Generative. Monthly credits for Long Form YouTube videos and viral short videos. Pay monthly or yearly, cancel anytime.",
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
