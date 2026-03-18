import { supabase } from './supabase';

export async function uploadTeamImage(localUri: string, teamId: string): Promise<string> {
  try {
    console.log('[Upload] ========== UPLOAD START ==========');
    console.log('[Upload] Team ID:', teamId);
    console.log('[Upload] Local URI:', localUri);
    
    const fileExtension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `team-${teamId}-${Date.now()}.${fileExtension}`;
    const filePath = `teams/${fileName}`;
    console.log('[Upload] File path in storage:', filePath);
    console.log('[Upload] File extension:', fileExtension);

    console.log('[Upload] Fetching local file...');
    const response = await fetch(localUri);
    console.log('[Upload] Fetch response status:', response.status);
    
    const blob = await response.blob();
    console.log('[Upload] Blob created, size:', blob.size, 'type:', blob.type);
    
    // Map file extensions to proper MIME types
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    const contentType = mimeTypes[fileExtension] || 'image/jpeg';
    console.log('[Upload] Content type:', contentType);

    console.log('[Upload] Calling Supabase Storage upload...');
    const { data, error } = await supabase.storage
      .from('team-logos')
      .upload(filePath, blob, {
        contentType,
        upsert: true,
      });

    console.log('[Upload] Upload response - data:', data, 'error:', error);

    if (error) {
      console.error('[Upload] ❌ Error uploading to Supabase Storage:', JSON.stringify(error, null, 2));
      throw new Error(`Upload failed: ${error.message || JSON.stringify(error)}`);
    }
    
    if (!data) {
      console.error('[Upload] ❌ No data returned from upload');
      throw new Error('Upload failed: No data returned');
    }

    const { data: publicUrlData } = supabase.storage
      .from('team-logos')
      .getPublicUrl(filePath);

    console.log('[Upload] Image uploaded successfully:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('[Upload] Failed to upload image:', error);
    throw error;
  }
}
