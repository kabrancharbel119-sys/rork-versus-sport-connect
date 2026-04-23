import { Platform } from 'react-native';
import { supabase } from './supabase';

const mimeToExt: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp',
};

// Convert base64 to Uint8Array for React Native compatibility
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function uriToFileData(uri: string): Promise<{ data: Blob | ArrayBuffer; contentType: string }> {
  // Handle file:// URIs on React Native - use ArrayBuffer (Blob not supported)
  if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('ph://'))) {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    
    // Read file as base64 and convert to ArrayBuffer (using legacy API)
    const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    
    // Convert base64 to ArrayBuffer using atob (React Native compatible)
    const bytes = base64ToUint8Array(base64);
    return { data: bytes.buffer as ArrayBuffer, contentType };
  }
  
  // Handle data URIs - use ArrayBuffer
  if (uri.startsWith('data:')) {
    const contentType = uri.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg';
    const base64 = uri.split(',')[1];
    const bytes = base64ToUint8Array(base64);
    return { data: bytes.buffer as ArrayBuffer, contentType };
  }
  
  // Handle http/https URIs - use Blob (works in browser)
  const response = await fetch(uri);
  const blob = await response.blob();
  let contentType = blob.type || 'image/jpeg';
  if (!contentType.startsWith('image/')) contentType = 'image/jpeg';
  return { data: blob, contentType };
}

async function uploadToStorage(bucket: string, filePath: string, fileData: Blob | ArrayBuffer, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileData, { contentType, upsert: true });

  if (error) throw new Error(error.message);
  if (!data?.path) throw new Error('Upload échoué: pas de path retourné');

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function uploadAvatarImage(localUri: string, userId: string): Promise<string> {
  let { data, contentType } = await uriToFileData(localUri);
  if (localUri.startsWith('data:')) {
    contentType = localUri.match(/data:(image\/\w+);/)?.[1] || contentType;
  }
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `avatar-${userId}-${Date.now()}.${fileExtension}`;
  const filePath = `avatars/${fileName}`;

  return uploadToStorage('avatars', filePath, data, contentType);
}

export async function uploadVenueImage(localUri: string, venueOwnerId: string): Promise<string> {
  const { data, contentType } = await uriToFileData(localUri);
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `venue-${venueOwnerId}-${Date.now()}.${fileExtension}`;
  const filePath = `venues/${fileName}`;

  return uploadToStorage('venue-images', filePath, data, contentType);
}

export async function uploadTeamImage(localUri: string, teamId: string): Promise<string> {
  const { data, contentType } = await uriToFileData(localUri);
  const fileExtension = mimeToExt[contentType] || 'jpg';

  const fileName = `team-${teamId}-${Date.now()}.${fileExtension}`;
  const filePath = `teams/${fileName}`;

  return uploadToStorage('team-logos', filePath, data, contentType);
}
