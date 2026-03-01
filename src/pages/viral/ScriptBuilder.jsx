import { useState } from "react";
import ScriptChat from "../../components/ScriptBuilder/ScriptChat";
import ScriptResult from "../../components/ScriptBuilder/ScriptResult";

export default function ScriptBuilder() {
  const [scriptData, setScriptData] = useState(null);

  return (
    <div className="h-screen w-full flex overflow-hidden">

      {/* LEFT PANEL */}
      <div className="w-full md:max-w-[450px] md:min-w-[400px] border-r border-white/5 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-6 [overflow-anchor:none]">
          <ScriptChat onGenerate={setScriptData} />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 overflow-y-auto p-6">
        <ScriptResult data={scriptData} />
      </div>

    </div>
  );
}