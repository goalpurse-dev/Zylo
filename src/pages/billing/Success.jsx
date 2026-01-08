import React from "react";
import { Link } from "react-router-dom";

export default function Success() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center text-black">
      <div className="p-6 max-w-md">
        <h1 className="text-3xl font-bold mb-2">Payment successful 🎉</h1>
        <p className="text-gray-600 mb-4">
          Your plan is active and credits are being added to your account.  
          This may take a few seconds to update.
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <Link to="/home" className="bg-[#1677FF] text-white font-semibold px-4 py-2 rounded-lg shadow">
            Go to app 
          </Link>
          <Link to="/billing" className="border border-gray-400 text-gray-700 font-semibold px-4 py-2 rounded-lg">
            View billing
          </Link>
        </div>
      </div>
    </div>
  );
}
