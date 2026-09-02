export const CANONICAL_IMAGE_SOURCE_ROOT = "/assets/image-sources/";
const PUBLIC_IMAGE_ROOT = "/assets/img/";

export const getCanonicalImageSourcePath = (fallbackPath) => {
  if (!fallbackPath.startsWith(PUBLIC_IMAGE_ROOT)) {
    throw new Error(`Unsupported public image path: ${fallbackPath}`);
  }

  return fallbackPath.replace(
    PUBLIC_IMAGE_ROOT,
    CANONICAL_IMAGE_SOURCE_ROOT,
  );
};

const createImageAsset = ({
  key,
  fallbackPath,
  height,
  width,
  responsiveWidths = [width],
  sizes,
  sourcePath = getCanonicalImageSourcePath(fallbackPath),
}) =>
  Object.freeze({
    key,
    fallbackPath,
    height,
    responsiveWidths: Object.freeze([...responsiveWidths]),
    ...(sizes ? { sizes } : {}),
    sourcePath,
    width,
  });

export const MODERN_IMAGE_FORMATS = Object.freeze([
  Object.freeze({ extension: "avif", mimeType: "image/avif" }),
  Object.freeze({ extension: "webp", mimeType: "image/webp" }),
]);

export const HERO_IMAGE_SIZES = [
  "(min-width: 1120px) 520px",
  "(min-width: 780px) calc((100vw - 80px) / 2)",
  "(min-width: 552px) 520px",
  "calc(100vw - 32px)",
].join(", ");

export const CONTENT_IMAGE_ASSETS = Object.freeze([
  createImageAsset({
    key: "homepage-hero",
    fallbackPath: "/assets/img/hero/hero-01-1080.jpg",
    width: 1600,
    height: 1200,
    responsiveWidths: [540, 720, 1080],
    sizes: HERO_IMAGE_SIZES,
    sourcePath: "/assets/image-sources/hero/hero-01.jpg",
  }),
  createImageAsset({
    key: "contact-hero",
    fallbackPath: "/assets/img/hero/hero-08-1080.jpg",
    width: 1600,
    height: 1200,
    responsiveWidths: [540, 720, 1080],
    sizes: HERO_IMAGE_SIZES,
    sourcePath: "/assets/image-sources/hero/hero-08.jpg",
  }),
  createImageAsset({
    key: "about-portrait",
    fallbackPath: "/assets/img/about/lauren.jpg",
    width: 420,
    height: 480,
  }),
]);

export const getModernImagePath = (fallbackPath, extension) =>
  fallbackPath.replace(/\.(?:jpe?g|png)$/i, `.${extension}`);

export const getImageCandidateWidths = (asset) =>
  asset.responsiveWidths ?? [asset.width];

export const getImageVariantPath = (asset, width, extension = "jpg") => {
  const widths = getImageCandidateWidths(asset);
  if (!widths.includes(width)) {
    throw new Error(`Unsupported ${asset.key} candidate width: ${width}`);
  }

  const formatPath =
    extension === "jpg"
      ? asset.fallbackPath
      : getModernImagePath(asset.fallbackPath, extension);
  return widths.length === 1
    ? formatPath
    : formatPath.replace(
        /-\d+(?=\.(?:jpe?g|png|avif|webp)$)/i,
        `-${width}`,
      );
};

export const getImageCandidates = (asset, extension = "jpg") =>
  getImageCandidateWidths(asset).map((width) =>
    Object.freeze({
      height: Math.round((width * asset.height) / asset.width),
      path: getImageVariantPath(asset, width, extension),
      width,
    }),
  );

export const getImagePaths = (asset) =>
  ["jpg", ...MODERN_IMAGE_FORMATS.map(({ extension }) => extension)].flatMap(
    (extension) =>
      getImageCandidates(asset, extension).map(({ path }) => path),
  );

export const getImageSrcset = (asset, extension) =>
  getImageCandidates(asset, extension)
    .map(({ path, width }) =>
      getImageCandidateWidths(asset).length === 1
        ? path
        : `${path} ${width}w`,
    )
    .join(", ");

export const getFallbackImagePath = (asset) =>
  getImageVariantPath(
    asset,
    getImageCandidateWidths(asset).at(-1),
  );

export const CONTENT_IMAGE_PATHS = Object.freeze(
  CONTENT_IMAGE_ASSETS.flatMap(getImagePaths),
);
