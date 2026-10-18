/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Shared JSON decoding for release data and Catalog assets. HTTP servers may
 * already have decoded Content-Encoding; inspect bytes rather than filenames.
 */
export async function decodeJsonBytes(buffer, Decompression = globalThis.DecompressionStream) {
  const bytes = new Uint8Array(buffer);
  let text;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof Decompression !== 'function') throw new Error('Browser does not support gzip data');
    const stream = new Blob([bytes]).stream().pipeThrough(new Decompression('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  return JSON.parse(text);
}
