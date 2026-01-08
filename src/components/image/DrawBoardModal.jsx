import React, { useEffect, useRef, useState } from "react";

/**
 * A tiny drawing board:
 * - Brush/eraser
 * - Color picker
 * - Size slider
 * - Clear
 * - Export to dataURL (returned via onExport)
 */
export default function DrawBoardModal({ open, onClose, onExport }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(6);
  const [mode, setMode] = useState("brush"); // brush | eraser

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    // HD canvas
    const w = 900, h = 1600; // vertical thumbnail sketch
    c.width = w;
    c.height = h;
    ctx.fillStyle = "#111"; // dark bg to mimic your UI
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, [open]);

  function down(e) {
    setIsDrawing(true);
    const { x, y } = point(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  }

  function move(e) {
    if (!isDrawing) return;
    const { x, y } = point(e);
    ctxRef.current.strokeStyle = mode === "brush" ? color : "#111";
    ctxRef.current.lineWidth = size;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  }

  function up() {
    setIsDrawing(false);
    ctxRef.current.closePath();
  }

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return { x: (clientX - rect.left) * (canvasRef.current.width / rect.width),
             y: (clientY - rect.top) * (canvasRef.current.height / rect.height) };
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="w-full max-w-[1000px] bg-neutral-950 text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">Draw thumbnail</div>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <input type="range" min={1} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-neutral-900 px-2 py-1 rounded">
                <option value="brush">Brush</option>
                <option value="eraser">Eraser</option>
              </select>
              <button
                onClick={() => {
                  const ctx = ctxRef.current;
                  ctx.fillStyle = "#111";
                  ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                }}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => onExport?.(canvasRef.current.toDataURL("image/png"))}
                className="px-3 py-1.5 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm"
              >
                Export
              </button>
              <button onClick={onClose} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/10 text-sm">
                Close
              </button>
            </div>
          </div>

          <div className="p-5">
            <div
              className="relative w-full max-w-[450px] mx-auto border border-white/10 rounded-lg overflow-hidden touch-none"
              onMouseDown={down}
              onMouseMove={move}
              onMouseUp={up}
              onMouseLeave={up}
              onTouchStart={down}
              onTouchMove={move}
              onTouchEnd={up}
            >
              <canvas ref={canvasRef} className="block w-full h-[800px]" />
            </div>
            <p className="text-xs text-white/50 mt-3 text-center">
              (This is a simple sketch board — we’ll send the PNG along with your prompt.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
