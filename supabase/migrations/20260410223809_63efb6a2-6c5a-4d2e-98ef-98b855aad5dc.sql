-- Fix all monthly_assessments that have photos in storage but NULL URLs in the table
-- Build URLs from the known storage path pattern: {user_id}/monthly/{assessment_id}/{label}.{ext}
UPDATE monthly_assessments ma
SET 
  foto_frente = COALESCE(ma.foto_frente, (
    SELECT 'https://vcvjgtouzdjenofoaorb.supabase.co/storage/v1/object/public/anamnese-photos/' || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'anamnese-photos'
    AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/frente.%'
    LIMIT 1
  )),
  foto_costas = COALESCE(ma.foto_costas, (
    SELECT 'https://vcvjgtouzdjenofoaorb.supabase.co/storage/v1/object/public/anamnese-photos/' || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'anamnese-photos'
    AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/costas.%'
    LIMIT 1
  )),
  foto_lado_direito = COALESCE(ma.foto_lado_direito, (
    SELECT 'https://vcvjgtouzdjenofoaorb.supabase.co/storage/v1/object/public/anamnese-photos/' || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'anamnese-photos'
    AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/lado_direito.%'
    LIMIT 1
  )),
  foto_lado_esquerdo = COALESCE(ma.foto_lado_esquerdo, (
    SELECT 'https://vcvjgtouzdjenofoaorb.supabase.co/storage/v1/object/public/anamnese-photos/' || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'anamnese-photos'
    AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/lado_esquerdo.%'
    LIMIT 1
  )),
  foto_perfil_lado = COALESCE(ma.foto_perfil_lado, (
    SELECT 'https://vcvjgtouzdjenofoaorb.supabase.co/storage/v1/object/public/anamnese-photos/' || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'anamnese-photos'
    AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/perfil_lado.%'
    LIMIT 1
  ))
WHERE ma.foto_frente IS NULL
AND EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.bucket_id = 'anamnese-photos'
  AND so.name LIKE ma.user_id::text || '/monthly/' || ma.id::text || '/%'
);
