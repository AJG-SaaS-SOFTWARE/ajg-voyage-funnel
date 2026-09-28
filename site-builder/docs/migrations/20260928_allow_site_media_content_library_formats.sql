-- Align the public site-media bucket with formats accepted by the builder content library.
update storage.buckets
set public=true,
    file_size_limit=15728640,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp','image/avif',
      'video/mp4','video/webm',
      'audio/mpeg','audio/mp4','audio/ogg','audio/wav',
      'application/pdf','text/plain'
    ]::text[]
where id='site-media';
