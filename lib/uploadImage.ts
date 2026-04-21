import { Platform } from 'react-native';
import { supabase } from './supabase';

const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp',
};

async function uriToBlob(uri: string): Promise<{ blob: Blob; contentType: string }> {
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('ph://'))) {
    const FileSystem = await import('expo-file-system/legacy');
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    return { blob: new Blob([byteArr], { type: contentType }), contentType };
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  let contentType = blob.type || 'image/jpeg';
  if (!contentType.startsWith('image/')) contentType = 'image/jpeg';
  return { blob, contentType };
}

async function uploadToStorage(bucket: string, filePath: string, blob: Blob, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, { contentType, upsert: true });

  if (error) throw new Error(error.message);
  if (!data?.path) throw new Error('Upload échoué: pas de path retourné');

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadAvatarImage(localUri: string, userId: string): Promise<string> {
  let { blob, contentType } = await uriToBlob(localUri);
  if (localUri.startsWith('data:')) {
    contentType = localUri.match(/data:(image\/\w+);/)?.[1] || contentType;
  }
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `avatar-${userId}-${Date.now()}.${fileExtension}`;
  const filePath = `avatars/${fileName}`;

  return uploadToStorage('avatars', filePath, blob, contentType);
}

export async function uploadVenueImage(localUri: string, venueOwnerId: string): Promise<string> {
  const { blob, contentType } = await uriToBlob(localUri);
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `venue-${venueOwnerId}-${Date.now()}.${fileExtension}`;
  const filePath = `venues/${fileName}`;

  return uploadToStorage('venue-images', filePath, blob, contentType);
}

export async function uploadTeamImage(localUri: string, teamId: string): Promise<string> {
  const { blob, contentType } = await uriToBlob(localUri);
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `team-${teamId}-${Date.now()}.${fileExtension}`;
  const filePath = `teams/${fileName}`;

  return uploadToStorage('team-logos', filePath, blob, contentType);
}
