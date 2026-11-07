import { BlobPreconditionFailedError, get, put } from '@vercel/blob';

const save = (path, data, options) => put(path, JSON.stringify(data), { access: 'private', contentType: 'application/json', ...options });

async function read(path) {
  const found = await get(path, { access: 'private', useCache: false });
  if (found?.statusCode !== 200) return null;
  return { data: await new Response(found.stream).json(), etag: found.blob.etag };
}

export const blobStore = {
  read,
  async create(path, data) {
    try {
      await save(path, data);
      return true;
    } catch (e) {
      // Writing over an existing file is refused. If another phone is writing it right now, it shows up in a moment.
      for (let i = 0; i < 6; i++) {
        if (await read(path)) return false;
        await new Promise((r) => setTimeout(r, 200));
      }
      throw e;
    }
  },
  async update(path, data, etag) {
    try {
      await save(path, data, { allowOverwrite: true, ifMatch: etag });
      return true;
    } catch (e) {
      // Two writers at the exact same moment get a plain error instead of the precondition one.
      if (e instanceof BlobPreconditionFailedError || /conflicting operation/i.test(e.message)) return false;
      throw e;
    }
  },
};
