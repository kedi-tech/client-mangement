/**
 * Readable, reasonably strong temporary password: 16 characters from an
 * alphabet without look-alikes (no 0/O, 1/l/I). Runs in the browser.
 */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
