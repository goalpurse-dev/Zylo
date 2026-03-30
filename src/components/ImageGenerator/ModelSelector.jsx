import React from "react";
import { ChevronRight } from "lucide-react";

const ModelSelector = React.memo(
  ({ selectedModel, openModel, setOpenModel }) => {
    return (
      <button
        onClick={() => setOpenModel((p) => !p)}
        className="rounded-xl border border-white/10 px-4 py-3 text-left"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-white/40">Model</span>
            <div className="text-white">{selectedModel.label}</div>
          </div>

          <ChevronRight
            className={`w-4 h-4 ${
              openModel ? "rotate-90 text-purple-400" : ""
            }`}
          />
        </div>
      </button>
    );
  }
);

export default ModelSelector;