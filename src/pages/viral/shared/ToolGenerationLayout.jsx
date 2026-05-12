import React from "react";

export default function ToolGenerationLayout({ left, right }) {
  const hasRightPanel = Boolean(right);

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-4 sm:py-4">
        <div
          className={
            hasRightPanel
              ? "grid grid-cols-1 gap-4 lg:grid-cols-[460px_minmax(0,1fr)] xl:grid-cols-[500px_minmax(0,1fr)]"
              : "mx-auto grid w-full max-w-[560px] grid-cols-1"
          }
        >
          <aside className="min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-32px)]">
            {left}
          </aside>

          {hasRightPanel && (
            <main className="hidden min-w-0 lg:block">{right}</main>
          )}
        </div>
      </div>
    </div>
  );
}