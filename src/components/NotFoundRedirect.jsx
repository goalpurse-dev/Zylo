import { Link } from "react-router-dom";
import { useSEO } from "../hooks/useSEO.js";

export default function NotFoundRedirect() {
  useSEO({
    title: "Page Not Found | Zyvo",
    description: "The requested Zyvo page could not be found.",
    robots: "noindex, nofollow",
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      
      <h1 className="text-4xl font-semibold text-white mb-3">
        Page Not Found
      </h1>

      <p className="text-gray-400 mb-6">
        The page you're looking for doesn't exist.
      </p>

      <Link
        to="/workspace/home"
        className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
      >
        Go to Zyvo Home
      </Link>
    </div>
  );
}
