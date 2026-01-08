// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";



const ItemLink = ({ label, to, href }) => {
  const cls = "block hover:underline hover:text-white transition-colors";
  if (href) return (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {label}
    </a>
  );
  return (
    <Link to={to || "#"} className={cls}>
      {label}
    </Link>
  );
};

export default function Footer() {
  // NEW compact layout
  const cols = [
    {
      title: "Brands",
      items: [
        { label: "Brand Home",       to: { pathname: "/brand", search: "?tool=brand-home" } },
        { label: "Brand Workspace",   to: { pathname: "/brand/workspace", search: "?tool=avatar-ads" } },
        { label: "Ad Studio",       to: { pathname: "/ad-studio", search: "?tool=ad-studio" } },
        { label: "Product Photos",  to: { pathname: "/product-photos", search: "?tool=product-photo" } },

      ],
    },
    {
      title: "Other Tools",
      items: [
        { label: "Library",        to: "/library" },
        { label: "Text to Video",  to: "/textvideo" },
        { label: "Text to Image",   to: "/textimage"},
      ],
    },
    {
      title: "Pricing",
      items: [{ label: "Plans", to: "/pricing" }],
    },
    {
      title: "Help",
      items: [
        { label: "Contact us",     to: "/help?tab=contact" },
        { label: "Support Center", to: "/help" },
        { label: "Tutorials",      to: "/tutorials" },
        { label: "Blog",           to: "/blog" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[#262626] bg-[#0f0f0f] text-gray-300 py-12">
      {/* Top grid */}
      <div className="page grid grid-cols-2 md:grid-cols-4 gap-10 text-sm">
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="font-semibold text-white mb-3">{col.title}</h3>
            <ul className="space-y-2">
              {col.items.map((it) => (
                <li key={it.label}>
                  <ItemLink {...it} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Row (centered legal links) */}
<div className="mt-12 border-t border-[#1e1e1e] pt-6 text-xs text-gray-500">
  <div className="flex items-center justify-center gap-6">
    <ItemLink label="Privacy Policy" to="/support/policies" />
    <ItemLink label="Terms & Conditions" to="/support/policies#terms" />
  </div>
  <div className="mt-3 text-center">©2025 ZyloAI</div>
</div>
    </footer>
  );
}
