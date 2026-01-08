import React from "react";
import { Link } from "react-router-dom";

export default function Cancel() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center text-black">
      <div className="p-6 max-w-md">
        <h1 className="text-3xl font-bold mb-2">Payment canceled ❌</h1>
        <p className="text-gray-600 mb-4">
          Your payment was canceled or didn’t go through.  
          You can try again anytime from your account.
        </p>
        <Link
          to="/pricing"
          className="bg-[#1677FF] text-white font-semibold px-4 py-2 rounded-lg shadow"
        >
          Back to pricing
        </Link>
      </div>
    </div>
  );
}
