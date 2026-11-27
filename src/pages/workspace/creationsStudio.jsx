// THE OWNER'S COPY of the Library (Studio v2, owner-only 2026-11-27). Customers get creations.jsx.
import { useEffect } from "react";
import LibraryV2 from "../../components/creations/LibraryV2.jsx";

// Creations (2026-11-26): the redesigned Library (shelves with counts, the green glow, a big viewer). The old page's
// component (components/creations/library.jsx) is kept, unused, until the new one has been checked on the preview.
export default function Creations() {
  useEffect(() => {
    document.title = "Your Creations | Zyvo";
  }, []);
  return <LibraryV2 />;
}
