import React from "react";
import { Stage, Layer } from "react-konva";

const CanvasStage = () => {
  // This would handle drawing, layers, etc.
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-2 font-bold text-white">Canvas Stage (Konva)</div>
      <div className="border border-gray-700 bg-black rounded overflow-hidden">
        <Stage width={640} height={360}>
          <Layer />
        </Stage>
      </div>
    </div>
  );
};

export default CanvasStage;