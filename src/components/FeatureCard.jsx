export default function FeatureCard({ title, description, imgSrc }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition text-center">
      <img
        src={imgSrc}
        alt={title}
        className="w-16 h-16 mx-auto mb-4 object-contain"
      />
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
