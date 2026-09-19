import { useEffect, useState } from "react";
import api from "../services/api";

/**
 * Fetches a media URL with the authenticated axios instance (which attaches the
 * Bearer token) and returns a blob: URL usable as <img src>.
 *
 * Browser <img> requests cannot send an Authorization header, so authenticated
 * media endpoints (e.g. /api/storage/profile-photo) must be loaded this way.
 *
 * - Relative URLs ("/...") are fetched through the authed axios instance.
 * - Absolute/data/blob URLs (Supabase storage links, local previews) pass through.
 * - Pass null to skip. The object URL is revoked on change/unmount.
 */
export default function useAuthedMedia(url) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return undefined;
    }
    if (!url.startsWith("/")) {
      setSrc(url);
      return undefined;
    }

    let objectUrl = null;
    let cancelled = false;

    api
      .get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}
