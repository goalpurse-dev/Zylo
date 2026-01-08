import FeatureCard from './FeatureCard';
import ImageCreator from '../assets/ImageCreator.png';

const features = [
  { title: 'Image Generator', description: 'Generate images from text using advanced AI models.', imgSrc: ImageCreator },
  { title: 'Thumbnail Generator', description: 'Create viral thumbnails in seconds with AI assistance.', imgSrc: ImageCreator },
  { title: 'Motivational Generator', description: 'Generate powerful speech-based motivational videos.', imgSrc: ImageCreator },
  { title: 'Settings', description: 'Customize your preferences and account settings.', imgSrc: ImageCreator },
  { title: 'Reddit Stories', description: 'Create Viral Reddit Stories with AI.', imgSrc: ImageCreator },
];

export default function FeaturesGrid() {
  return (
    <section className="py-16 bg-transparent">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
