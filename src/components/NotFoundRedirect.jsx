import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function NotFoundRedirect() {
  const navigate = useNavigate();
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (count === 0) {
      navigate("/home", { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      setCount((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      
      <h1 className="text-4xl font-semibold text-white mb-3">
        Page Not Found
      </h1>

      <p className="text-gray-400 mb-6">
        The page you're looking for doesn't exist.
      </p>

      <div className="text-purple-400 text-lg">
        Redirecting to homepage in <span className="font-bold">{count}</span>...
      </div>

      <button
        onClick={() => navigate("/home")}
        className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
      >
        Go Home Now
      </button>
    </div>
  );
}