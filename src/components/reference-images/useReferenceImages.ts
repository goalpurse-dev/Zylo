import { useEffect, useState } from "react";

const MAX_STORED_IMAGES = 20;

export type ReferenceImage = {
  id: string;
  url: string;
};

export function useReferenceImages(maxSelectable: number) {
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [selected, setSelected] = useState<ReferenceImage[]>([]);

  // add uploaded image
  const addImage = (img: ReferenceImage) => {
    setImages((prev) => {
      const updated = [img, ...prev];
      return updated.slice(0, MAX_STORED_IMAGES);
    });
  };

  // toggle select
  const toggleSelect = (img: ReferenceImage) => {
    setSelected((prev) => {
      if (prev.some((i) => i.id === img.id)) {
        return prev.filter((i) => i.id !== img.id);
      }

      if (prev.length >= maxSelectable) {
        return prev;
      }

      return [...prev, img];
    });
  };

  // ⚠️ model changed → trim selection
  useEffect(() => {
    setSelected((prev) => prev.slice(0, maxSelectable));
  }, [maxSelectable]);

  return {
    images,
    selected,
    addImage,
    toggleSelect,
    setSelected,
  };
}
