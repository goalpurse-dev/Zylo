import React, { useEffect, useState } from 'react';
import { listAvatars } from '../../lib/api/avatars';

export default function AvatarPicker({ selected, onPick }) {
  const [rows, setRows] = useState([]);

  useEffect(() => { (async () => setRows(await listAvatars()))(); }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {rows.map(r => (
        <button
          key={r.id}
          onClick={() => onPick(r)}
          className={`relative rounded-lg overflow-hidden ring-1 ring-zinc-800 hover:ring-violet-500
            ${selected?.id === r.id ? 'outline outline-2 outline-violet-500' : ''}`}
          title={`${r.identity} • ${r.scene}`}
        >
          <img src={r.url} className="w-full h-40 object-cover" alt={r.scene}/>
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-[11px] text-white text-center py-1">
            {r.identity} · {r.scene}
          </div>
        </button>
      ))}
    </div>
  );
}
