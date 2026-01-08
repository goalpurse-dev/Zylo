import { useNavigate } from "react-router-dom";
import { launchJob } from "../lib/jobLauncher";

export function useLaunchJob() {
  const navigate = useNavigate();
  return (args: Omit<Parameters<typeof launchJob>[0], "navigate">) =>
    launchJob({ ...args, navigate });
}
