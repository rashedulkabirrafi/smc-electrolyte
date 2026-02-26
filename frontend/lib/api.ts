const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const publicBase = trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
const serverBase = trimTrailingSlash(
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
);

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }
  return publicBase ? `${publicBase}${path}` : path;
}

export function serverApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }
  return `${serverBase}${path}`;
}
