import React from "react";
import CanvasStage from "../thumbnail/CanvasStage";
import ToolBar from "../thumbnail/ToolBar";
import RightPanel from "../thumbnail/RightPanel";
import UploadDropzone from "../thumbnail/UploadDropzone";
import LayerList from "../thumbnail/LayerList";
import TextStickerTray from "../thumbnail/TextStickerTray";
import EmojiTray from "../thumbnail/EmojiTray";
import SafeZonesOverlay from "../thumbnail/SafeZonesOverlay";
import PreviewPanel from "../thumbnail/PreviewPanel";
import ExportPanel from "../thumbnail/ExportPanel";
import CreditPill from "../thumbnail/CreditPill";

const ThumbnailGenerator = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-4 py-8">
        <div className="flex-1 space-y-4">
          <ToolBar />
          <CanvasStage />
          <LayerList />
          <SafeZonesOverlay />
          <UploadDropzone />
        </div>
        <div className="w-full md:w-96 flex flex-col space-y-4">
          <CreditPill />
          <RightPanel />
          <PreviewPanel />
          <TextStickerTray />
          <EmojiTray />
          <ExportPanel />
        </div>
      </div>
    </div>
  );
};

export default ThumbnailGenerator;