import { useLocation } from "react-router-dom";
import { getWorkspaceRouteSeoPolicy, SITE_URL } from "../../data/routeSeoPolicy.js";
import { useSEO } from "../../hooks/useSEO.js";

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
  });

  return null;
}
