import { Navigate } from "react-router-dom";
import { blockyWorldsRoute } from "../../../data/blockyWorlds";
import useBlockyWorldsAccess from "./api/blockyWorldsAccess";

/**
 * The /workspace/blocky-worlds route's guard: the page (and its code) loads only once the server said this visitor may
 * see Blocky Worlds. While asking: an empty dark screen with nothing Blocky Worlds on it. Closed or failed: home.
 */
export default function BlockyWorldsGate({ children }) {
  const route = blockyWorldsRoute(useBlockyWorldsAccess());
  if (route === "show") return children;
  if (route === "wait") return <div className="h-full w-full bg-[#0B0D0F]" aria-busy="true" />;
  return <Navigate to="/" replace />;
}
