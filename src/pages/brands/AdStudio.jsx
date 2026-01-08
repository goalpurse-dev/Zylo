import React, { useState } from 'react';
import AvatarPicker from '../../components/brands/AvatarPicker';
// import { createVideoJobSimple } from '../../lib/jobs'; // when backend is ready

export default function AdStudio() {
  const [picked, setPicked] = useState(null);
  const [script, setScript] = useState('');
  const [useForBrand, setUseForBrand] = useState(false); // local-only toggle

  async function generateAd() {
    if (!picked) return alert('Pick an avatar');

    const jobInput = {
      avatar_kind: 'stock-local',
      avatar_identity_id: picked.identityId,
      avatar_reference_scene: picked.scene,
      avatar_url: picked.url,                 // the key for your generator
      consistency: { method: 'instant-id', strength: 0.7 },
      actions: ['talk', 'hold_product_optional'],
      script
    };

    console.log('JOB INPUT ->', jobInput);

    // When your backend is ready:
    // await createVideoJobSimple({
    //   type: 'talking_avatar_ad',
    //   prompt: script,
    //   input: jobInput,
    //   settings: { duration: 10, model: 'zylo-v2' }
    // });

    alert('Ready to send to generator (check console for payload).');
  }

  return (
    <div className="p-6 space-y-6">
      <AvatarPicker onPick={setPicked} selected={picked} />

      <div className="flex items-center gap-3">
        <input id="brand" type="checkbox" checked={useForBrand} onChange={e=>setUseForBrand(e.target.checked)} />
        <label htmlFor="brand" className="text-sm text-zinc-300">Set as default brand avatar (local-only for now)</label>
      </div>

      <textarea
        className="w-full h-32 rounded-xl bg-zinc-900 text-white p-3 ring-1 ring-zinc-800 outline-none"
        placeholder="Write the script the avatar will say…"
        value={script}
        onChange={e=>setScript(e.target.value)}
      />

      <button
        onClick={generateAd}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500"
      >Generate Ad</button>
    </div>
  );
}
