import { useState, useEffect, useRef } from "react";

export default function ScriptChat({ onGenerate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    type: "",
    platform: "",
    length: "",
    style: "",
    idea: "",
  });

  const chatRef = useRef(null);
  const bottomRef = useRef(null);

  const next = () => setStep((prev) => prev + 1);

  const handleSelect = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => next(), 300); // smooth delay
  };

  const handleGenerate = () => {
    onGenerate(form);
  };

  // 🔥 Auto Scroll
useEffect(() => {
  const container = chatRef.current?.parentElement;
  if (!container) return;

  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });
}, [step]);

  const BotMessage = ({ children }) => (
    <div className="flex items-start gap-3 animate-slideUp">
      <img
        className="h-10 w-10 rounded-full shadow-md"
        src="/assets/ai/robot.webp"
      />
      <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-lg px-5 py-3 rounded-2xl rounded-tl-sm text-white text-sm max-w-[85%] border border-white/10 shadow-md">
        {children}
      </div>
    </div>
  );

  const UserMessage = ({ children }) => (
    <div className="flex justify-end animate-slideUp">
      <div className="bg-gradient-to-r from-[#7A3BFF] via-[#8E5CFF] to-[#6F3AE6] px-5 py-3 rounded-2xl rounded-tr-sm text-white text-sm max-w-[75%] shadow-lg shadow-purple-600/30">
        {children}
      </div>
    </div>
  );

  const OptionButton = ({ label, onClick }) => (
    <button
      onClick={onClick}
      className="w-full text-left bg-gradient-to-r from-white/5 to-white/10 hover:from-[#7A3BFF]/20 hover:to-[#6F3AE6]/20 border border-white/10 hover:border-[#7A3BFF]/50 transition-all duration-300 px-4 py-3 rounded-xl text-white text-sm hover:scale-[1.03] hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98]"
    >
      {label}
    </button>
  );

  return (
    <div
      ref={chatRef}
      className="flex flex-col gap-6 pr-3"
    >
      {/* STEP 0 */}
      {step >= 0 && (
        <>
          <BotMessage>
            👋 Let’s build something people can’t scroll past.
            <div className="mt-2 opacity-70 text-xs">
              What are we creating today?
            </div>
          </BotMessage>

          {step === 0 && (
            <div className="space-y-3 animate-fadeIn">
              <OptionButton label="🔥 Viral Hook" onClick={() => handleSelect("type", "Viral Hook")} />
              <OptionButton label="🎬 Full Script" onClick={() => handleSelect("type", "Full Script")} />
              <OptionButton label="🧠 Hook + Script Combo" onClick={() => handleSelect("type", "Combo")} />
            </div>
          )}
        </>
      )}

      {form.type && <UserMessage>{form.type}</UserMessage>}

      {/* STEP 1 */}
      {/* STEP 1 */}
{step >= 1 && (
  <>
    <BotMessage>
      Nice. Where will this be posted?
    </BotMessage>

    {step === 1 && (
      <div className="space-y-3 animate-fadeIn">
        <OptionButton label="TikTok" onClick={() => handleSelect("platform", "TikTok")} />
        <OptionButton label="Instagram Reels" onClick={() => handleSelect("platform", "Reels")} />
        <OptionButton label="YouTube Shorts" onClick={() => handleSelect("platform", "Shorts")} />
        <OptionButton label="YouTube Long" onClick={() => handleSelect("platform", "YouTube Long")} />
        <OptionButton label="Other" onClick={() => handleSelect("platform", "other")} />
      </div>
    )}

    {form.platform === "other" && step === 2 && (
      <div className="animate-fadeIn">
        <input
          type="text"
          placeholder="Enter platform name..."
          className="w-full bg-white/10 border border-white/20 focus:border-[#7A3BFF] outline-none p-3 rounded-xl text-white text-sm"
          onBlur={(e) =>
            setForm((prev) => ({ ...prev, platform: e.target.value }))
          }
        />
      </div>
    )}
  </>
)}

      {form.platform && <UserMessage>{form.platform}</UserMessage>}

     {/* STEP 2 */}
{step >= 2 && (
  <>
    <BotMessage>
      Got it. How long will the video be?
    </BotMessage>

    {step === 2 && (
      <div className="animate-fadeIn space-y-4">
        <div className="flex gap-3">
          <input
            type="number"
            min="1"
            max={durationUnit === "minutes" ? 10 : 600}
            value={durationValue}
            onChange={(e) => {
              const value = e.target.value;
              setDurationValue(value);
            }}
            className="flex-1 bg-white/10 border border-white/20 focus:border-[#7A3BFF] outline-none p-3 rounded-xl text-white text-sm"
            placeholder="Enter duration"
          />

          <select
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value)}
            className="bg-white/10 border border-white/20 focus:border-[#7A3BFF] outline-none px-3 rounded-xl text-white text-sm"
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
          </select>
        </div>

        <button
          onClick={() => {
            if (!durationValue) return;

            const numeric = parseInt(durationValue);

            if (durationUnit === "minutes" && numeric > 10) return;

            setForm((prev) => ({
              ...prev,
              length: `${numeric} ${durationUnit}`,
            }));

            next();
          }}
          className="w-full bg-gradient-to-r from-[#7A3BFF] via-[#8E5CFF] to-[#6F3AE6] py-2 rounded-xl text-white text-sm font-semibold"
        >
          Continue →
        </button>
      </div>
    )}
  </>
)}

      {form.length && <UserMessage>{form.length}</UserMessage>}

      {/* STEP 3 */}
      {step >= 3 && (
        <>
          <BotMessage>
            Do you want to base this on a proven viral blueprint?
          </BotMessage>

          {step === 3 && (
            <div className="space-y-3 animate-fadeIn">
              <OptionButton label="⚡ Curiosity Gap" onClick={() => handleSelect("style", "Curiosity Gap")} />
              <OptionButton label="💀 Shock" onClick={() => handleSelect("style", "Shock")} />
              <OptionButton label="🎭 Storytelling" onClick={() => handleSelect("style", "Storytelling")} />
              <OptionButton label="📊 Authority" onClick={() => handleSelect("style", "Authority")} />
              <OptionButton label="🎲 AI Choose Best" onClick={() => handleSelect("style", "AI Choice")} />
            </div>
          )}
        </>
      )}

      {form.style && <UserMessage>{form.style}</UserMessage>}

      {/* STEP 4 */}
      {step >= 4 && (
        <>
          <BotMessage>
            Perfect. What’s this video about?
          </BotMessage>

          {step === 4 && (
            <div className="space-y-4 animate-fadeIn pb-10">
              <textarea
                onFocus={(e) => {
    e.target.scrollIntoView({ block: "nearest" });
  }}
                className="w-full bg-white/10 border-white/20 border focus:border-[#7A3BFF] outline-none transition-all p-4 rounded-xl text-white text-sm resize-none focus:shadow-lg focus:shadow-purple-500/20"
                rows={4}
                placeholder="Describe the core idea..."
                value={form.idea}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, idea: e.target.value }))
                }
              />
              <button
                onClick={handleGenerate}
                className="w-full bg-gradient-to-r from-[#7A3BFF] via-[#8E5CFF] to-[#6F3AE6] py-3 rounded-xl text-white font-semibold hover:scale-[1.03] transition-all shadow-xl shadow-purple-600/40 active:scale-[0.97]"
              >
                Generate Script →
              </button>
            </div>
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}