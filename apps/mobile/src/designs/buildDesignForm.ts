import type { DesignCategory, PostType } from '@moodly/shared';

export type PublishInput = {
  uris: string[];
  title: string;
  category: DesignCategory;
  description?: string;
  postType: PostType;
  sourceCredit?: string;
};

function fileFromUri(uri: string) {
  const name = uri.split('/').pop() ?? 'model.jpg';
  const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { uri, name, type };
}

/** Construit le multipart de publication : chaque image sous le champ `media`. */
export function buildDesignForm(input: PublishInput): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('category', input.category);
  if (input.description) form.append('description', input.description);
  form.append('postType', input.postType);
  // Une création originale n'a pas de source externe : on n'envoie le crédit
  // que pour une inspiration.
  if (input.postType === 'INSPIRATION' && input.sourceCredit) {
    form.append('sourceCredit', input.sourceCredit);
  }
  for (const uri of input.uris) {
    form.append('media', fileFromUri(uri) as unknown as Blob);
  }
  return form;
}
