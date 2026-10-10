import { Link, useNavigate } from "react-router-dom";
import { publicLandingFor } from "../../data/routeSeoPolicy.js";

// A link to a tool. The tool pages (/workspace/…) are noindex, so the link's
// href is the tool's public page where it has one (routeSeoPolicy.js
// `publicLanding`): that is the page crawlers follow from Home. A plain click
// still opens the tool itself. An onClick that cancels the event (a carousel
// side card) cancels that too.
export default function ToolLink({ to, onClick, ...rest }) {
  const navigate = useNavigate();
  const landing = publicLandingFor(to);
  const open = (event) => {
    onClick?.(event);
    if (!landing || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <Link to={landing ?? to} onClick={open} {...rest} />;
}
