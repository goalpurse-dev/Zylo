import { VIDEO_TEMPLATES } from "../../components/video-templates/templates";

export default function VideoTemplate({ onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {VIDEO_TEMPLATES.map((template) => (
        <div
          key={template.id}
          onClick={() => onSelect(template)}
          className="cursor-pointer rounded-2xl bg-white/5 hover:bg-white/10 p-3 transition"
        >
          <img
            src={template.previewImage}
            alt={template.name}
            className="rounded-xl mb-2"
          />
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <p className="text-xs text-white/60">
            {template.description}
          </p>
        </div>
      ))}
    </div>
  );
}