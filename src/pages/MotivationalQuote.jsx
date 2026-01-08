import React, { useState } from 'react';

const Motivational = () => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState('30');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    // Simuloidaan AI-videon generointia
    setTimeout(() => {
      setVideoUrl(`https://example.com/fakevideo-${duration}s.mp4`);
      setLoading(false);
    }, 2000); // korvataan myöhemmin oikealla API:lla
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center space-y-4">
      <h1 className="text-3xl font-bold text-white">Motivational Video Generator</h1>

      <textarea
        placeholder="Write your motivational theme..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full max-w-md p-3 rounded bg-gray-800 text-white focus:outline-none focus:ring focus:ring-indigo-500"
        rows={4}
      />

      <select
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className="px-4 py-2 bg-gray-800 text-white rounded focus:outline-none focus:ring focus:ring-indigo-500"
      >
        <option value="15">15 seconds</option>
        <option value="30">30 seconds</option>
        <option value="45">45 seconds</option>
        <option value="60">60 seconds</option>
      </select>

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt}
        className="bg-gradient-to-r from-indigo-500 to-pink-500 px-6 py-3 rounded text-white font-semibold hover:brightness-110 transition disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Video'}
      </button>

      {videoUrl && (
        <video controls className="mt-6 rounded-lg shadow-lg max-w-md">
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}
    </div>
  );
};

export default Motivational;

