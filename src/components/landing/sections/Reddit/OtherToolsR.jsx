// src/components/landing/Sections/OtherTools.jsx
import React from "react";
import { Link } from "react-router-dom";
export default function OtherTools({ items=[] }) {
  return (
    <section className="py-12 bg-[#F6F7F9]">
      <div className="max-w-6xl mx-auto px-6">
        <h3 className="text-2xl font-extrabold mb-4">Discover more:</h3>
        <div className="flex flex-wrap gap-3">
          {items.map((t,i)=>(
            <Link key={i} to={t.to} className="px-3 py-2 text-sm rounded-full bg-white border hover:border-gray-300">
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
