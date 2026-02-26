/**
 * FLAC Vorbis Comment writer.
 *
 * FLAC stores metadata in METADATA_BLOCK structures. Block type 4 is
 * VORBIS_COMMENT which holds key=value pairs. This module parses the
 * FLAC file, updates/adds Vorbis Comment fields, and rebuilds the file.
 *
 * Reference: https://xiph.org/flac/format.html
 */

export interface VorbisCommentUpdates {
  [key: string]: string; // e.g. { GENRE: "Rock", BPM: "120", DATE: "2020" }
}

/** Parse and rewrite Vorbis Comments in a FLAC buffer. */
export function updateFlacVorbisComments(
  buffer: ArrayBuffer,
  updates: VorbisCommentUpdates,
): ArrayBuffer {
  const view = new DataView(buffer);

  // Verify fLaC magic
  if (
    view.getUint8(0) !== 0x66 || // f
    view.getUint8(1) !== 0x4c || // L
    view.getUint8(2) !== 0x61 || // a
    view.getUint8(3) !== 0x43    // C
  ) {
    throw new Error("Not a valid FLAC file");
  }

  // Parse all metadata blocks
  const blocks: MetadataBlock[] = [];
  let offset = 4;
  let isLast = false;

  while (!isLast && offset < buffer.byteLength) {
    const header = view.getUint8(offset);
    isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLength =
      (view.getUint8(offset + 1) << 16) |
      (view.getUint8(offset + 2) << 8) |
      view.getUint8(offset + 3);

    blocks.push({
      type: blockType,
      isLast,
      data: new Uint8Array(buffer, offset + 4, blockLength),
      offset: offset + 4,
      length: blockLength,
    });

    offset += 4 + blockLength;
  }

  const audioDataStart = offset;

  // Find existing VORBIS_COMMENT block (type 4)
  let vcBlockIndex = blocks.findIndex((b) => b.type === 4);

  // Parse existing comments or create empty
  let vendor = "deezer-downloader";
  let comments: string[] = [];

  if (vcBlockIndex !== -1) {
    const parsed = parseVorbisComment(blocks[vcBlockIndex].data);
    vendor = parsed.vendor;
    comments = parsed.comments;
  }

  // Apply updates (case-insensitive key matching)
  const upperUpdates = new Map<string, string>();
  for (const [key, value] of Object.entries(updates)) {
    upperUpdates.set(key.toUpperCase(), value);
  }

  // Update existing comments or remove them from the update set
  comments = comments.map((c) => {
    const eqIdx = c.indexOf("=");
    if (eqIdx === -1) return c;
    const key = c.substring(0, eqIdx).toUpperCase();
    if (upperUpdates.has(key)) {
      const newVal = upperUpdates.get(key)!;
      upperUpdates.delete(key);
      return `${key}=${newVal}`;
    }
    return c;
  });

  // Add any remaining new fields
  for (const [key, value] of upperUpdates) {
    comments.push(`${key}=${value}`);
  }

  // Build new VORBIS_COMMENT block data
  const newVcData = buildVorbisComment(vendor, comments);

  // Rebuild FLAC file
  if (vcBlockIndex === -1) {
    // Insert VC block after STREAMINFO (index 0)
    vcBlockIndex = 1;
    blocks.splice(1, 0, {
      type: 4,
      isLast: false,
      data: newVcData,
      offset: 0,
      length: newVcData.byteLength,
    });
  } else {
    blocks[vcBlockIndex] = {
      ...blocks[vcBlockIndex],
      data: newVcData,
      length: newVcData.byteLength,
    };
  }

  // Recalculate isLast flags
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].isLast = i === blocks.length - 1;
  }

  // Calculate total size
  const metadataSize = blocks.reduce((sum, b) => sum + 4 + b.length, 0);
  const audioData = new Uint8Array(buffer, audioDataStart);
  const totalSize = 4 + metadataSize + audioData.byteLength;

  // Write new buffer
  const result = new ArrayBuffer(totalSize);
  const out = new Uint8Array(result);
  const outView = new DataView(result);

  // fLaC magic
  out[0] = 0x66; out[1] = 0x4c; out[2] = 0x61; out[3] = 0x43;

  let writeOffset = 4;
  for (const block of blocks) {
    // Block header: 1 byte (isLast flag + type) + 3 bytes (length)
    const headerByte = (block.isLast ? 0x80 : 0x00) | (block.type & 0x7f);
    outView.setUint8(writeOffset, headerByte);
    outView.setUint8(writeOffset + 1, (block.length >> 16) & 0xff);
    outView.setUint8(writeOffset + 2, (block.length >> 8) & 0xff);
    outView.setUint8(writeOffset + 3, block.length & 0xff);
    out.set(block.data, writeOffset + 4);
    writeOffset += 4 + block.length;
  }

  // Audio data
  out.set(audioData, writeOffset);

  return result;
}

// ---- Internal types & helpers ----

interface MetadataBlock {
  type: number;
  isLast: boolean;
  data: Uint8Array;
  offset: number;
  length: number;
}

function parseVorbisComment(data: Uint8Array): {
  vendor: string;
  comments: string[];
} {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  // Vendor string (little-endian length + UTF-8 string)
  const vendorLen = view.getUint32(offset, true);
  offset += 4;
  const vendor = new TextDecoder().decode(data.subarray(offset, offset + vendorLen));
  offset += vendorLen;

  // Number of comments
  const numComments = view.getUint32(offset, true);
  offset += 4;

  const comments: string[] = [];
  for (let i = 0; i < numComments; i++) {
    const commentLen = view.getUint32(offset, true);
    offset += 4;
    const comment = new TextDecoder().decode(
      data.subarray(offset, offset + commentLen),
    );
    comments.push(comment);
    offset += commentLen;
  }

  return { vendor, comments };
}

function buildVorbisComment(vendor: string, comments: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const vendorBytes = encoder.encode(vendor);

  // Calculate total size
  let size = 4 + vendorBytes.byteLength + 4; // vendor length + vendor + comment count
  const commentBytes: Uint8Array[] = [];
  for (const c of comments) {
    const bytes = encoder.encode(c);
    commentBytes.push(bytes);
    size += 4 + bytes.byteLength; // length + data per comment
  }

  const result = new Uint8Array(size);
  const view = new DataView(result.buffer);
  let offset = 0;

  // Vendor
  view.setUint32(offset, vendorBytes.byteLength, true);
  offset += 4;
  result.set(vendorBytes, offset);
  offset += vendorBytes.byteLength;

  // Comments
  view.setUint32(offset, comments.length, true);
  offset += 4;
  for (const bytes of commentBytes) {
    view.setUint32(offset, bytes.byteLength, true);
    offset += 4;
    result.set(bytes, offset);
    offset += bytes.byteLength;
  }

  return result;
}
