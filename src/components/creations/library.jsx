// src/pages/Library.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  CREATION_TYPES,
  listCreationsByType,
  deleteCreation,
} from "../../lib/creations";
import { Download, X } from "lucide-react";

export default function Library() {
  const { user, loading } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [activeItem, setActiveItem] = useState(null);

  useEffect(() => {
    if (!user || loading) return;

    const load = async () => {
      const list = await listCreationsByType(
        user.id,
        CREATION_TYPES.PRODUCT_PHOTO
      );

      const sorted = [...list].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      const keep = sorted.slice(0, 20);
      const overflow = sorted.slice(20);

      for (const item of overflow) {
        deleteCreation(item).catch(() => {});
      }

      setPhotos(keep);
    };

    load();
  }, [user, loading]);

  return (
    <section>
      {/* Header */}
      <div className="flex flex-col gap-4 items-center mt-20 px-5 md:px-8">
        <h1 className="text-[#110829] font-semibold text-[20px] sm:text-[22px] md:text-[24px] cursor-default">
          Your Every Creation Will Come Here
        </h1>
        <p className="text-[#4A4A55] text-[14px] sm:text-[16px] text-center cursor-default">
          Max 20 per tool, oldest are removed automatically
        </p>
      </div>

      {/* Product Photos */}
      <div className="mt-20 px-6 lg:px-10 xl:px-12">
        <h1 className="text-[#110829] text-[20px] sm:text-[22px] font-semibold cursor-default">
          Product Photos
        </h1>

        <div className="flex gap-4 flex-wrap">
          {photos.map((item) => (
            <div key={item.id} className="mt-6">
              {/* Image */}
              <button
                onClick={() => setActiveItem(item)}
                className="overflow-hidden rounded-md block"
              >
                <img
                  src={item.file_url}
                  alt=""
                  className="object-cover h-[140px] md:h-[160px] lg:h-[180px]
                             w-[140px] md:w-[160px] lg:w-[180px]
                             hover:opacity-90 transition"
                />
              </button>

              {/* Date */}
              <div
                className="bg-[#ECE8F2] border border-[#4A4A55]/20
                           flex items-center justify-center
                           h-[40px] md:h-[45px]
                           w-[140px] md:w-[160px] lg:w-[180px] cursor-default"
              >
                <p className="text-[#4A4A55] text-[12px]">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}

          {photos.length === 0 && (
            <p className="mt-6 text-[#4A4A55]">No product photos yet.</p>
          )}
        </div>
      </div>

      {/* OPENED VIEW (MODAL) */}
      {activeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="bg-[#ECE8F2] p-7 rounded-md w-full max-w-[700px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <div className="flex justify-end">
              <button onClick={() => setActiveItem(null)}>
                <X className="text-[#4A4A55] h-4 w-4" />
              </button>
            </div>

            {/* Image */}
            <div className="mt-3 rounded-md overflow-hidden ">
              <img
                src={activeItem.file_url}
                alt=""
                className="w-full max-h-[420px] object-contain bg-black rounded-md"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-4 px-4 ">
              <p className="text-[#110829] text-[14px] cursor-default">
                {new Date(activeItem.created_at).toLocaleDateString()}
              </p>

              <a href={activeItem.file_url} download>
                <Download className="text-[#4A4A55] h-4 w-4 hover:opacity-70 transition" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
