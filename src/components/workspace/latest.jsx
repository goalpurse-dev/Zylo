import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  CREATION_TYPES,
  listCreationsByType,
} from "../../lib/creations";

/* ---------- responsive helper ---------- */
function useIsSmUp() {
  const [isSmUp, setIsSmUp] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 640 : false
  );

  useEffect(() => {
    const onResize = () => setIsSmUp(window.innerWidth >= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isSmUp;
}

export default function Latest() {
  const { user, loading } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [fetching, setFetching] = useState(true);

  const isSmUp = useIsSmUp();
  const maxItems = isSmUp ? 5 : 3;

  useEffect(() => {
    if (!user || loading) {
      setPhotos([]);
      setFetching(false);
      return;
    }

    listCreationsByType(user.id, CREATION_TYPES.PRODUCT_PHOTO)
      .then((data) => {
        // de-dupe by id + responsive limit
        const unique = Array.from(
          new Map((data || []).map((x) => [x.id, x])).values()
        );

        setPhotos(unique.slice(0, maxItems));
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [user, loading, maxItems]);

  return (
    <section>
      {/* Title */}
      <div className="flex justify-center px-10">
        <h1 className="text-[#110829] text-[clamp(23px,3vw,36px)] font-bold">
          Your Latest Creations
        </h1>
      </div>

      {/* Content */}
      <div className="flex justify-center px-10 mt-10">
        {fetching ? null : photos.length === 0 ? (
          <div className="border-[#4A4A55]/40 border rounded-lg w-full py-6 text-center">
            <p className="text-[#4A4A55] text-[16px]">
              No photos created yet
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            {photos.map((item) => (
              <div
                key={item.id}
                className="
                  rounded-lg overflow-hidden
                  h-[clamp(160px,20vw,360px)]
                  w-[110px]
                  sm:w-[clamp(110px,16vw,220px)]
                  bg-[#ECE8F2]
                "
              >
                <img
                  src={item.file_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex justify-center mt-10 lg:mt-20">
        <Link
          to="/workspace/creations"
          className="
            py-2 lg:py-3 px-8 lg:px-12 xl:px-16
            rounded-lg shadow-lg
            border-[#7A3BFF] border-2
            text-[#110829] font-semibold
            bg-white
          "
        >
          See All
        </Link>
      </div>
    </section>
  );
}
