import { supabase } from '../supabaseClient';

export async function listAvatars() {
  const { data, error } = await supabase
    .from('assets')
    .select('id, storage_path, meta')
    .eq('kind', 'avatar')
    .order('storage_path', { ascending: true });
  if (error) throw error;

  return data.map((a) => {
    const relative = a.storage_path.replace(/^avatars\//, ''); // "seed/..jpg"
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(relative);
    return {
      id: a.id,
      url: urlData.publicUrl,
      identity: a.meta?.identity ?? 'unknown',
      scene: a.meta?.scene ?? 'unknown'
    };
  });
}

export async function setBrandPrimaryAvatar(brandId, assetId) {
  await supabase.from('brand_avatars')
    .update({ is_primary: false })
    .eq('brand_id', brandId)
    .eq('is_primary', true);

  const { error } = await supabase.from('brand_avatars').insert({
    brand_id: brandId,
    asset_id: assetId,
    role: 'spokesperson',
    style: 'realistic',
    is_primary: true,
    meta_json: { source: 'avatars' }
  });
  if (error) throw error;
}
