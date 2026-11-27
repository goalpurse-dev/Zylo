// A Studio v2 page (Maestro, Create, the Director, Quick Generate) only for accounts the server lets in
// (src/lib/studioV2.js). Anyone else gets exactly what an unknown address gives today (NotFoundRedirect).
import NotFoundRedirect from "./NotFoundRedirect";
import { useStudioV2 } from "../lib/studioV2";

export default function StudioV2Only({ children }) {
  const { on, ready } = useStudioV2();
  if (on) return children;
  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;
  return <NotFoundRedirect />;
}
