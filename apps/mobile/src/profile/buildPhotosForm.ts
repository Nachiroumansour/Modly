function fileFromUri(uri: string) {
  const name = uri.split('/').pop() ?? 'photo.jpg';
  const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name, type };
}

/** Construit le multipart des photos de profil (champs `avatar` et/ou `cover`). */
export function buildPhotosForm(input: { avatarUri?: string; coverUri?: string }): FormData {
  const form = new FormData();
  if (input.avatarUri) form.append('avatar', fileFromUri(input.avatarUri) as unknown as Blob);
  if (input.coverUri) form.append('cover', fileFromUri(input.coverUri) as unknown as Blob);
  return form;
}
