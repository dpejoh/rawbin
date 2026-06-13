const RAV_B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const RAV_SHFL = "1dgWnocayqxU3r6vA5lCIPYfHmkV08b4tz+KMsp2NQ9LRXihODwSj7BEFJ/ZuGTe";

export function applyShuffle(input: string): string {
  return input.replace(/[A-Za-z0-9+/]/g, (c) => RAV_SHFL[RAV_B64.indexOf(c)] ?? c);
}
