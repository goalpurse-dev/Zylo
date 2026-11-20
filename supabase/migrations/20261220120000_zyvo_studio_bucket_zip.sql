-- THE ZYVO STUDIO KIT download (phase 3, 2026-11-20): the kit zip lives in the private zyvo-studio bucket at
-- kit/zyvo-studio-kit-<version>.zip (zyvoMcp/config.js KIT.path), so the bucket also takes application/zip.
-- Safe on live: one bucket setting; the bucket stays private (signed links only).
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'application/json', 'image/jpeg', 'application/zip']
 WHERE id = 'zyvo-studio';
