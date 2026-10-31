import type { Metadata } from "next";

/**
 * Builds the per-page `metadata` export. The site name is appended by the
 * title template in the root layout, so pages pass only their own title.
 */
export function pageMetadata(
  title: string,
  description: string,
  options: { index?: boolean } = {},
): Metadata {
  const index = options.index ?? true;
  return {
    title,
    description,
    robots: { index, follow: index },
  };
}
