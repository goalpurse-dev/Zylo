export default function Hero() {
  return (
    <section className="w-full bg-[#F7F5FA] py-24 px-6">
      <div className="max-w-5xl mx-auto text-center">

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-semibold text-gray-900 leading-tight">
          Turn ideas into viral content <br className="hidden md:block" />
          with AI
        </h1>

        {/* Subtext */}
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          Generate scroll-stopping videos and images in seconds using 25+ AI models 
          built for creators who want to grow.
        </p>

        {/* Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">

          {/* Google Button */}
          <button className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition font-medium text-gray-800">
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5"
            />
            Start Free with Google
          </button>

          {/* Purple Button */}
          <button className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-medium shadow-lg shadow-purple-500/30 hover:scale-[1.03] transition">
            Start Creating Free
          </button>

        </div>

      </div>
    </section>
  );
}