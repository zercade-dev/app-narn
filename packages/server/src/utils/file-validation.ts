/**
 * Structural/content anti-malware validation shared by every file-accepting
 * import route (CSV entry import, glossary CSV/TBX import, backup restore).
 *
 * Deliberately NOT a virus-scan integration (the owner chose structural/
 * content validation over standing up a scanning service) — this only
 * verifies the upload is what it claims to be:
 *
 *   - file-extension allowlist on the user-supplied filename
 *   - path-traversal / null-byte guard on that same filename
 *   - magic-byte sniffing of the ACTUAL file bytes (never the client-supplied
 *     extension or `Content-Type`, both of which are attacker-controlled)
 *   - rejection of obviously executable/script payloads (shebang, ELF, PE/DOS,
 *     Mach-O) even when the file is mis-named with an allowed extension
 *
 * Size caps and (for zip archives) decompression-bomb/zip-slip guards are
 * enforced by the caller (multer's `limits.fileSize` and, for backups,
 * M13-backup-manager's entry-count/uncompressed-size/path checks) — this
 * module only covers the "is this actually the file type it claims to be"
 * question.
 */
import path from 'node:path';
import { ValidationError } from '../types/errors.js';

/** A signature match against the START of a file's bytes. */
interface Signature {
  name: string;
  matches: (buf: Buffer) => boolean;
}

const EXECUTABLE_SIGNATURES: Signature[] = [
  {
    name: 'ELF binary',
    matches: (b) =>
      b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46,
  },
  {
    // A bare 'MZ' stub alone is only 2 bytes — too short to distinguish a real
    // DOS/PE executable from text content that coincidentally starts with
    // "MZ" (e.g. a CSV/TBX cell beginning with a country code, name, or
    // abbreviation). Every genuine PE carries a DOS stub whose byte at offset
    // 0x3C (e_lfanew) points to a 'PE\0\0' signature elsewhere in the file —
    // require that structural link too, which text content will essentially
    // never satisfy by coincidence.
    name: 'Windows PE/DOS executable',
    matches: (b) => {
      if (b.length < 0x40 || b[0] !== 0x4d || b[1] !== 0x5a) return false;
      const peOffset = b.readUInt32LE(0x3c);
      return peOffset + 4 <= b.length && b.readUInt32LE(peOffset) === 0x00004550; // 'PE\0\0'
    },
  },
  {
    name: 'Mach-O binary',
    matches: (b) => {
      if (b.length < 4) return false;
      const be = b.readUInt32BE(0);
      const le = b.readUInt32LE(0);
      const magics = [0xfeedface, 0xfeedfacf, 0xcafebabe, 0xcafebabf];
      return magics.includes(be) || magics.includes(le);
    },
  },
  {
    // `#!` shebang — a shell/interpreter script, regardless of extension.
    // Real shebangs are followed by an interpreter path (almost always
    // absolute, so a literal '/' at byte 2) — require that too, so text
    // content that happens to start with "#!" (e.g. a CSV comment/header
    // convention) isn't misdetected as a script.
    name: 'shebang script',
    matches: (b) => b.length >= 3 && b[0] === 0x23 && b[1] === 0x21 && b[2] === 0x2f,
  },
];

/** Returns the matched signature's human-readable name, or null if none match. */
export function detectExecutablePayload(buf: Buffer): string | null {
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (sig.matches(buf)) return sig.name;
  }
  return null;
}

const ZIP_MAGICS: Buffer[] = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // local file header
  Buffer.from([0x50, 0x4b, 0x05, 0x06]), // empty archive (end of central directory)
  Buffer.from([0x50, 0x4b, 0x07, 0x08]), // spanned archive
];

/** True when `buf` starts with a recognized ZIP magic-byte sequence. */
export function looksLikeZip(buf: Buffer): boolean {
  return ZIP_MAGICS.some(
    (magic) => buf.length >= magic.length && buf.subarray(0, magic.length).equals(magic),
  );
}

/**
 * Guards a user-supplied filename against path traversal, absolute paths, and
 * null-byte injection. Cheap defense-in-depth even on routes that never use
 * the filename to build a filesystem path (originalname is otherwise only
 * used for extension sniffing / cosmetic display), so a future change that
 * starts trusting it inherits the guard for free.
 */
export function assertSafeFilename(name: string | undefined): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new ValidationError('Missing file name');
  }
  if (name.includes('\0') || name.includes('..') || path.isAbsolute(name)) {
    throw new ValidationError('Invalid file name');
  }
}

export interface FileValidationOptions {
  /** Allowed lower-cased extensions, including the leading dot (e.g. ['.csv']). */
  allowedExtensions: string[];
  /**
   * When true, the file's bytes must start with a recognized ZIP magic-byte
   * sequence. Use for archive-upload routes (backup restore).
   */
  requireZipMagic?: boolean;
  /**
   * When true (the default), reject content whose bytes match a known
   * executable/script signature (ELF/PE/Mach-O/shebang) — defense against a
   * malicious payload mis-named with an allowed extension. Leave enabled
   * unless the route itself expects binary archive content (zip archives
   * never match these signatures, so this is safe to leave on everywhere).
   */
  rejectExecutablePayloads?: boolean;
}

/**
 * Validates an uploaded file's name and actual byte content against
 * `opts`. Throws `ValidationError` (mapped to 400 by the central error
 * handler) on any violation. Call AFTER multer's size-limit/fileFilter have
 * already run, with the buffered content available.
 */
export function validateUploadedFile(
  originalname: string | undefined,
  content: Buffer,
  opts: FileValidationOptions,
): void {
  assertSafeFilename(originalname);
  const name = originalname as string;
  const ext = path.extname(name).toLowerCase();
  if (!opts.allowedExtensions.includes(ext)) {
    throw new ValidationError(
      `Unsupported file extension "${ext || '(none)'}" — expected one of: ${opts.allowedExtensions.join(', ')}`,
    );
  }

  if (opts.requireZipMagic && !looksLikeZip(content)) {
    throw new ValidationError('File content does not match the expected ZIP archive format');
  }

  if (opts.rejectExecutablePayloads !== false) {
    const hit = detectExecutablePayload(content);
    if (hit) {
      throw new ValidationError(
        `Rejected: file content matches a ${hit} signature, not the expected file type`,
      );
    }
  }
}

/**
 * A multer `fileFilter` that rejects (client-supplied) filenames outside an
 * extension allowlist before the upload is even buffered — fast rejection
 * layer. Content is NOT available at this point (multer streams it after
 * fileFilter approves), so this is a cheap first gate only; the authoritative
 * check is {@link validateUploadedFile} on the buffered content once the
 * upload completes.
 */
export function extensionFileFilter(
  allowedExtensions: string[],
): (
  req: unknown,
  file: { originalname: string },
  cb: (err: Error | null, accept?: boolean) => void,
) => void {
  const allowed = allowedExtensions.map((e) => e.toLowerCase());
  return (_req, file, cb) => {
    if (typeof file.originalname !== 'string' || file.originalname.includes('..')) {
      cb(new ValidationError('Invalid file name'));
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new ValidationError(`Unsupported file extension "${ext || '(none)'}"`));
      return;
    }
    cb(null, true);
  };
}
