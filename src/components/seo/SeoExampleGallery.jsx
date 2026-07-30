export default function SeoExampleGallery({ images, heading = "See What You Can Create" }) {
  if (!images?.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
      <h2 className="text-center text-[26px] font-black tracking-[-0.02em] text-white sm:text-[32px]">{heading}</h2>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {images.map((image, index) => (
          <div key={image.src} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <img
              src={image.src}
              alt={image.alt}
              width={540}
              height={960}
              loading={index < 3 ? "eager" : "lazy"}
              decoding="async"
              className="aspect-[9/16] w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
