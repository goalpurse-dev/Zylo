import React from "react";

const ToolBar = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
      <span className="font-semibold text-white">ToolBar</span>
      <span className="text-gray-400">[Brush] [Eraser] [Shape] [Move] [Zoom]</span>
    </div>
  );
};

export default ToolBar;