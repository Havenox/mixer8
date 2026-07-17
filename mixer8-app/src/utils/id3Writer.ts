/**
 * ID3v2.3 Metadata Tag Writer for MP3 files in TypeScript.
 * Embeds Title, Artist, Album, and APIC (Attached Picture / Cover Art).
 */

export interface IID3Metadata {
  title: string;
  artist: string;
  album?: string;
  coverImageBuffer?: ArrayBuffer | null;
  mimeType?: string;
}

// Helper to encode a string as UTF-8 / ISO-8859-1 bytes
const encodeText = (str: string): Uint8Array => {
  const textEncoder = new TextEncoder();
  return textEncoder.encode(str);
};

// Converts integer to 4-byte synchsafe integer (7 bits per byte)
const toSynchsafe = (num: number): number[] => {
  return [
    (num >> 21) & 0x7f,
    (num >> 14) & 0x7f,
    (num >> 7) & 0x7f,
    num & 0x7f
  ];
};

// Converts integer to standard 4-byte big-endian integer
const toBigEndian4 = (num: number): number[] => {
  return [
    (num >> 24) & 0xff,
    (num >> 16) & 0xff,
    (num >> 8) & 0xff,
    num & 0xff
  ];
};

// Creates a standard text frame (TIT2, TPE1, TALB)
const createTextFrame = (id: string, text: string): Uint8Array => {
  if (!text) return new Uint8Array(0);
  const textBytes = encodeText(text);
  // 1 byte encoding flag (0x03 for UTF-8) + text bytes
  const payloadSize = 1 + textBytes.length;
  const frameHeader = new Uint8Array(10);

  // Frame ID (4 bytes)
  for (let i = 0; i < 4; i++) frameHeader[i] = id.charCodeAt(i);
  // Frame Size (4 bytes)
  const sizeBytes = toBigEndian4(payloadSize);
  for (let i = 0; i < 4; i++) frameHeader[4 + i] = sizeBytes[i];
  // Flags (2 bytes, 0x00 0x00)
  frameHeader[8] = 0x00;
  frameHeader[9] = 0x00;

  const frame = new Uint8Array(10 + payloadSize);
  frame.set(frameHeader, 0);
  frame[10] = 0x03; // UTF-8 Encoding
  frame.set(textBytes, 11);
  return frame;
};

// Creates an APIC (Attached Picture / Cover Art) frame
const createCoverFrame = (imageBuffer: ArrayBuffer, mimeType = 'image/webp'): Uint8Array => {
  const imgBytes = new Uint8Array(imageBuffer);
  const mimeBytes = encodeText(mimeType);

  // Layout: Encoding (1B) + MimeType (NB) + 0x00 + PictureType (1B) + Description (0x00) + ImageBytes
  const payloadSize = 1 + mimeBytes.length + 1 + 1 + 1 + imgBytes.length;
  const frameHeader = new Uint8Array(10);

  // Frame ID: "APIC"
  const id = "APIC";
  for (let i = 0; i < 4; i++) frameHeader[i] = id.charCodeAt(i);
  // Frame Size
  const sizeBytes = toBigEndian4(payloadSize);
  for (let i = 0; i < 4; i++) frameHeader[4 + i] = sizeBytes[i];
  // Flags
  frameHeader[8] = 0x00;
  frameHeader[9] = 0x00;

  const frame = new Uint8Array(10 + payloadSize);
  frame.set(frameHeader, 0);

  let offset = 10;
  frame[offset++] = 0x00; // ISO-8859-1 encoding for mime/desc
  frame.set(mimeBytes, offset);
  offset += mimeBytes.length;
  frame[offset++] = 0x00; // Null terminator for mime
  frame[offset++] = 0x03; // Picture Type: Cover (front)
  frame[offset++] = 0x00; // Null terminator for description (empty)

  frame.set(imgBytes, offset);
  return frame;
};

/**
 * Prepends an ID3v2.3 tag header to raw MP3 audio bytes.
 */
export const addID3v2Tags = (mp3AudioBlob: Blob, metadata: IID3Metadata): Promise<Blob> => {
  return new Promise(async (resolve) => {
    try {
      const frames: Uint8Array[] = [];

      if (metadata.title) {
        frames.push(createTextFrame('TIT2', metadata.title));
      }
      if (metadata.artist) {
        frames.push(createTextFrame('TPE1', metadata.artist));
      }
      if (metadata.album) {
        frames.push(createTextFrame('TALB', metadata.album));
      }
      if (metadata.coverImageBuffer) {
        frames.push(createCoverFrame(metadata.coverImageBuffer, metadata.mimeType || 'image/webp'));
      }

      let totalFramesSize = 0;
      for (const frame of frames) {
        totalFramesSize += frame.length;
      }

      if (totalFramesSize === 0) {
        resolve(mp3AudioBlob);
        return;
      }

      // ID3v2 Header (10 bytes)
      const header = new Uint8Array(10);
      header[0] = 0x49; // 'I'
      header[1] = 0x44; // 'D'
      header[2] = 0x33; // '3'
      header[3] = 0x03; // Version 2.3
      header[4] = 0x00; // Revision
      header[5] = 0x00; // Flags

      const synchsafe = toSynchsafe(totalFramesSize);
      for (let i = 0; i < 4; i++) {
        header[6 + i] = synchsafe[i];
      }

      const audioArrayBuffer = await mp3AudioBlob.arrayBuffer();
      const audioBytes = new Uint8Array(audioArrayBuffer);

      const taggedMp3 = new Uint8Array(10 + totalFramesSize + audioBytes.length);
      taggedMp3.set(header, 0);

      let offset = 10;
      for (const frame of frames) {
        taggedMp3.set(frame, offset);
        offset += frame.length;
      }
      taggedMp3.set(audioBytes, offset);

      resolve(new Blob([taggedMp3], { type: 'audio/mp3' }));
    } catch (err) {
      console.warn('[ID3] Erro ao anexar metadados ID3v2:', err);
      resolve(mp3AudioBlob); // Fallback para áudio sem tag em caso de erro
    }
  });
};
