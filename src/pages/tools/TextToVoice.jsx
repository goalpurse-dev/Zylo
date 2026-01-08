// src/pages/tools/TextToVoice.jsx
import React, { useState, useRef, useEffect } from "react";
import { Volume2, Loader2, Sparkles, Play, Pause } from "lucide-react";
import VoiceLibrary, {
  VOICE_PRESETS,
} from "../../components/voice/VoiceLibrary";

export default function TextToVoice() {
  const [text, setText] = useState("");
  
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // selected voice preview
  const voiceAudioRef = useRef(null);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [voicePreviewProgress, setVoicePreviewProgress] = useState(0);

  // output preview
  const outputAudioRef = useRef(null);
  const [outputPlaying, setOutputPlaying] = useState(false);
  const [outputProgress, setOutputProgress] = useState(0);

  // reset voice preview when switching voice
  useEffect(() => {
    if (voiceAudioRef.current) {
      try {
        voiceAudioRef.current.pause();
        voiceAudioRef.current.currentTime = 0;
      } catch {}
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewProgress(0);
  }, [selectedVoice?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedVoice) return;

    setIsGenerating(true);
    setLastAudioUrl(null);
    setOutputPlaying(false);
    setOutputProgress(0);

    try {
      // TODO: call your Edge Function here with:
      // { text, language, voiceId: selectedVoice.elevenId }
      await new Promise((res) => setTimeout(res, 900));

      // When backend is wired, set the returned public MP3 URL here:
      // setLastAudioUrl(publicAudioUrl);
    } catch (err) {
      console.error("TTS error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleVoicePreview = () => {
    if (!selectedVoice || !voiceAudioRef.current) return;
    const audio = voiceAudioRef.current;

    if (!audio.paused) {
      audio.pause();
      setVoicePreviewPlaying(false);
      return;
    }
    audio
      .play()
      .then(() => setVoicePreviewPlaying(true))
      .catch(() => setVoicePreviewPlaying(false));
  };

  const toggleOutputPreview = () => {
    if (!lastAudioUrl || !outputAudioRef.current) return;
    const audio = outputAudioRef.current;

    if (!audio.paused) {
      audio.pause();
      setOutputPlaying(false);
      return;
    }
    audio
      .play()
      .then(() => setOutputPlaying(true))
      .catch(() => setOutputPlaying(false));
  };

  return (
    <div className="zy-container min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* header */}
        <div className="zy-fadeup">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7a3bff]" />
            <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-[0.16em]">
              AUDIO TOOL · BETA
            </span>
          </div>

          <h1 className="zy-h1 mb-2">
            Turn{" "}
            <span className="zy-gradient-text">
              text into studio-grade voice
            </span>{" "}
            in seconds.
          </h1>
          <p className="zy-sub max-w-xl">
            Write your script once. Zylo sends it to ElevenLabs and returns a
            clean MP3 ready for ads, TikToks, and product videos.
          </p>
        </div>

        {/* main body: editor or library */}
        {showLibrary ? (
          <VoiceLibrary
            initialVoiceId={selectedVoice?.id}
            onBack={() => setShowLibrary(false)}
            onUse={(voice) => {
              setSelectedVoice(voice);
              setShowLibrary(false);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 md:gap-6">
            {/* left: form */}
            <form
              onSubmit={handleSubmit}
              className="zy-card p-4 md:p-6 flex flex-col gap-4 zy-fadeup"
            >
              {/* stepper */}
              <div className="zy-stepper mb-1">
                <div className="zy-step zy-step--active">
                  <div className="zy-step__dot">1</div>
                  <span>Write your script</span>
                </div>
                <div className="zy-step__bar zy-step__bar--filled" />
                <div className="zy-step">
                  <div className="zy-step__dot">2</div>
                  <span>Choose voice</span>
                </div>
                <div className="zy-step__bar" />
                <div className="zy-step">
                  <div className="zy-step__dot">3</div>
                  <span>Generate MP3</span>
                </div>
              </div>

              {/* script */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-[#0b1220]">
                    Script
                    <span className="zy-badge-optional">
                      Ideal 5–60 seconds
                    </span>
                  </label>
                  <span className="text-[11px] text-[#9ca3af]">
                    {text.length}/600
                  </span>
                </div>
                <textarea
                  className="zy-textarea min-h-[130px]"
                  maxLength={600}
                  placeholder='Write what you want the voice to say. Example: “Hey, I’m your AI assistant from Zylo. In 10 seconds, I’ll show you how to turn any product photo into a TikTok-ready ad.”'
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              {/* settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* language */}
               

                {/* voice display (no dropdown) */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#0b1220]">
                    Voice
                  </label>
                  <div className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#0b1220] truncate">
                        {selectedVoice
                          ? `${selectedVoice.name} · ${selectedVoice.gender}, ${selectedVoice.age}`
                          : "No voice selected"}
                      </span>
                      {selectedVoice && (
                        <button
                          type="button"
                          onClick={toggleVoicePreview}
                          className="h-7 w-7 rounded-full border border-[#e5e7eb] flex items-center justify-center bg-[#f9fafb] hover:bg-[#f3f4ff]"
                        >
                          {voicePreviewPlaying ? (
                            <Pause className="h-3.5 w-3.5 text-[#7a3bff]" />
                          ) : (
                            <Play className="h-3.5 w-3.5 text-[#7a3bff]" />
                          )}
                        </button>
                      )}
                    </div>

                    {selectedVoice && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
                          <div
                            className="h-full bg-[#7a3bff] transition-[width] duration-100"
                            style={{
                              width: `${Math.min(
                                100,
                                voicePreviewProgress * 100 || 0,
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#9ca3af]">
                          Preview
                        </span>
                      </div>
                    )}

                    <audio
                      ref={voiceAudioRef}
                      src={selectedVoice?.sampleUrl || ""}
                      className="hidden"
                      onTimeUpdate={(e) => {
                        const { currentTime, duration } = e.target;
                        if (!duration) return;
                        setVoicePreviewProgress(currentTime / duration);
                      }}
                      onEnded={() => {
                        setVoicePreviewPlaying(false);
                        setVoicePreviewProgress(0);
                      }}
                    />
                  </div>
                </div>

                {/* browse voices */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#0b1220]">
                    Find a different style
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLibrary(true)}
                    className="zy-btn-soft flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4 text-[#7a3bff]" />
                    <span className="text-[13px] font-semibold">
                      Browse voices
                    </span>
                  </button>
                </div>
              </div>

              {/* CTA */}
              <div className="pt-3 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isGenerating || !text.trim() || !selectedVoice}
                  className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg bg-[length:200%_100%] transition-all ${
                    isGenerating || !text.trim() || !selectedVoice
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:opacity-95 active:scale-[.99]"
                  }`}
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg,#7A3BFF,#5B5CE2,#FF57B2)",
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating voice...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 mr-2" />
                      Create MP3 with this script
                    </>
                  )}
                </button>
                <p className="zy-sub text-[11px]">
                  Zylo uses ElevenLabs under the hood. Your script is processed
                  securely and stored only for your account.
                </p>
              </div>
            </form>

            {/* right: output + tips */}
            <div className="space-y-4">
              <div className="zy-card p-4 md:p-5 zy-fadeup">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="zy-section-title text-[13px] mb-0.5">
                      Latest output
                    </div>
                    <p className="zy-sub">
                      Listen back and download the MP3 from your last
                      generation.
                    </p>
                  </div>
                  {selectedVoice && (
                    <div className="text-right">
                      <div className="text-[12px] font-semibold text-[#0b1220]">
                        {selectedVoice.name}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">
                        {selectedVoice.gender} · {selectedVoice.age}
                      </div>
                    </div>
                  )}
                </div>

                {lastAudioUrl ? (
                  <div className="zy-filechip mt-2 flex-col items-start sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-3">
                      <div className="zy-filechip__thumb flex items-center justify-center bg-[#ede9ff]">
                        <Volume2 className="h-5 w-5 text-[#7a3bff]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="zy-filechip__name truncate">
                          voice-export.mp3
                        </div>
                        <div className="zy-filechip__meta">
                          Ready to drop into your Zylo ads or export anywhere.
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                      {/* play line */}
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={toggleOutputPreview}
                          className="h-8 w-8 rounded-full border border-[#e5e7eb] flex items-center justify-center bg-[#f9fafb] hover:bg-[#f3f4ff]"
                        >
                          {outputPlaying ? (
                            <Pause className="h-4 w-4 text-[#7a3bff]" />
                          ) : (
                            <Play className="h-4 w-4 text-[#7a3bff]" />
                          )}
                        </button>
                        <div className="flex-1 h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
                          <div
                            className="h-full bg-[#7a3bff] transition-[width] duration-100"
                            style={{
                              width: `${Math.min(
                                100,
                                outputProgress * 100 || 0,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <a
                        href={lastAudioUrl}
                        download="zylo-voice.mp3"
                        className="zy-btn-soft flex items-center justify-center gap-1 text-[12px] sm:w-auto w-full"
                      >
                        Download
                      </a>

                      <audio
                        ref={outputAudioRef}
                        src={lastAudioUrl}
                        className="hidden"
                        onTimeUpdate={(e) => {
                          const { currentTime, duration } = e.target;
                          if (!duration) return;
                          setOutputProgress(currentTime / duration);
                        }}
                        onEnded={() => {
                          setOutputPlaying(false);
                          setOutputProgress(0);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#e5e7eb] rounded-2xl p-4 text-center">
                    <p className="zy-sub">
                      Generate your first voice to see it here. You’ll get a
                      clean MP3 you can drop directly into Zylo ads or export.
                    </p>
                  </div>
                )}
              </div>

              <div className="zy-card p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-[#f3f4ff] flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-[#7a3bff]" />
                  </div>
                  <div className="space-y-1">
                    <div className="zy-section-title text-[13px]">
                      Script tips for better audio
                    </div>
                    <ul className="list-disc list-inside text-[12px] text-[#6b7280] space-y-1">
                      <li>Write like you speak — short, clear sentences.</li>
                      <li>Add pauses with commas or line breaks.</li>
                      <li>Mention your product name early and once again.</li>
                      <li>End with one clear call to action.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
