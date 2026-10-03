import { useLocation } from "react-router-dom";
import { getWorkspaceRouteSeoPolicy, SITE_URL } from "../../data/routeSeoPolicy.js";
import { useSEO } from "../../hooks/useSEO.js";
import { getPublicSeoMetadata, canonicalFor } from "../../data/publicSeoMetadata.js";
import { structuredDataFor } from "../../data/structuredData.js";

// Only Home carries structured data among these routes (Organization + WebSite).
const HOME_LD = structuredDataFor("/", getPublicSeoMetadata("/"), canonicalFor("/"));

export default function WorkspaceRouteSeo() {
  const { pathname } = useLocation();
  const policy = getWorkspaceRouteSeoPolicy(pathname);

  useSEO({
    enabled: Boolean(policy),
    title: policy?.title,
    description: policy?.description || "Zyvo application workspace.",
    canonical: policy ? `${SITE_URL}${policy.path}` : undefined,
    robots: policy?.seoVisibility === "public"
      ? "index, follow, max-image-preview:large"
      : "noindex, follow",
    ogType: "website",
    structuredData: pathname === "/" ? HOME_LD : undefined,
  });

  return null;
}
