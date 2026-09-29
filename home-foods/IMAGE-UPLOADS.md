# Home Foods image uploads

## Storage and setup

Uploads use **Home Foods server filesystem storage**, not browser storage or an
external object-storage provider. No storage provider was configured previously.
Development works without credentials: the default directory is `.data/uploads`
in this project (ignored by Git). Back it up together with the PostgreSQL database.
Do not delete this directory when clearing build caches.

On a self-hosted deployment, set server-only `HOMEFOODS_UPLOAD_DIR` to an absolute
path on a persistent, writable volume. Production refuses uploads without this
setting. All application instances must share the volume and upload controls must
be coordinated before scaling beyond one Node server. An ephemeral/serverless
filesystem is **not supported**: choose an object-storage adapter before deploying
there. This task does not activate the previously held production-readiness work.

Images are retrieved through `/api/media/<shop-id>/<random-uuid>.webp`; these
relative URLs work on localhost, the LAN address and a future public host. Menu
photos are public, including uploaded drafts; do not use this uploader for private
identity documents. Only the random public media path is exposed. Filesystem paths
and credentials are not returned to the browser.

## Seller workflow

`ImageUpload` (`src/components/image-upload.tsx`) is used for new/existing dishes,
new menu categories, kitchen logos and kitchen covers. Existing category editing
retains its URL dialog. Meal plans have no image field in the current schema.

1. Choose **Upload image** (native browser/OS file picker), drag one file onto the
   target, or choose **Take photo** (rear-camera capture hint).
2. Review the preview. Replace/retake or discard an accidental selection.
3. Choose **Confirm & upload**. A real XHR reports transfer progress; 100% means
   processing until the server confirms success. Retry/cancel preserves the form.
4. Use **Save dish**, **Add dish**, or **Save kitchen profile**. An unconfirmed
   selection blocks form submission. Uploading alone does not alter a saved dish.

Android/iOS/iPadOS choose which photo, files and camera providers to show. Desktop
capture may simply open a file chooser. Camera permission is not requested on page
load. Native chooser cancellation leaves the draft intact; browsers do not reliably
expose whether cancellation was caused by denied permission, so guidance stays
visible. No camera API bypass or custom file browser is used.

**Remove image** asks for confirmation and clears the draft; saving clears the
database reference. Existing Home Foods fallback images then apply. New immutable
URLs avoid stale replacement caches. Basket image references refresh on opening.

## Limits and security

- JPG/JPEG, PNG and WebP, up to 8 MiB input; HEIC/HEIF, SVG, GIF and other formats
  are rejected. Export unsupported phone photos to JPG first.
- Single image, minimum 64 × 64 pixels, maximum 40 million input pixels.
- Sharp fully decodes, applies orientation, resizes within 2000 × 2000 and
  re-encodes as WebP. GPS/EXIF metadata and appended source payloads are discarded.
- Streamed request size limit is enforced without trusting Content-Length.
- Seller session/role and owned kitchen checked server-side; save routes reject
  another kitchen's managed image reference and nonexistent uploads.
- Same-origin mutation checks, UUID filenames, strict path parsing, no original
  filenames on disk, public image-only response with `nosniff` and immutable cache.
- One active upload per kitchen and four per process; 60 attempts/hour per kitchen
  per process. Disk-based limits: 30 successful uploads/hour, 1000 images and
  250 MiB stored per kitchen. These are single-server protections, not a distributed
  rate limiter.
- Existing external image URLs are preserved. New URL entries must be HTTPS;
  the server does not fetch external links. A search/share page is not an image.

No database migration: existing MenuItem/MenuCategory `imageUrl` and Shop
`logoUrl`/`coverImageUrl` store the public reference, never base64 or local paths.

## Replacement and cleanup

The old object is never deleted before the database update succeeds. Replaced and
removed managed references are queued under `.data/uploads/cleanup`. Abandoned
uploads are also covered by the maintenance scan. Retention is at least seven days.

Run `npx tsx scripts/cleanup-images.ts` for a read-only report. To delete eligible
unreferenced objects, **stop all application writers first**, back up storage and
the database, then run `npx tsx scripts/cleanup-images.ts --apply --writers-stopped`.
The maintenance flag is the operator's assertion that all writers are stopped;
it does not stop them. The script checks all live menu, category, kitchen and avatar
references. It never deletes referenced images or files less than seven days old.
Cleanup is intentionally manual to prevent a save/cleanup race. Queue records are
an audit trail; the scan uses current database references as the source of truth.

## Verification

Automated coverage lives in `tests/image-upload.test.mjs` and
`scripts/check-image-uploads.ts`. The latter creates isolated accounts/kitchens,
uses real storage and database writes and removes its own fixtures afterwards.
It covers the Chrome native file-chooser event, preview, required confirmation,
JPG/PNG/WebP decoding/retrieval, failed-network retry, invalid content/size,
authorization, creation, replacement, removal, refresh persistence and customer
views. Responsive screenshots cover 390px and 1440px in both themes.

Physical Windows file-picker interaction, macOS Finder, Safari/WebKit, Firefox,
Android/iOS/iPadOS photo libraries and camera permission flows have not all been
physically verified. Native inputs provide compatibility; physical-device testing
remains necessary. Playwright WebKit and Firefox runtimes are not installed here.

### Completed checks — 29 September 2026

TypeScript, 53 unit tests, Chrome integration tests and production build passed.
Lint passed with one existing `next/no-img-element` warning in the meal-plan page.
The read-only cleanup report found no files eligible for deletion. Browser checks
also verified desktop drag-and-drop, logo/cover persistence, favourites, search and
existing basket image refresh. Only temporary test accounts and records were used.

## Changed files

- Storage and policy: `src/lib/image-storage.ts`, `src/lib/upload-policy.ts`,
  `app/api/uploads/route.ts`, `app/api/media/[shopId]/[file]/route.ts`.
- Seller persistence: `app/api/seller/route.ts`, `src/lib/kitchen-profile.ts`.
- UI: `src/components/image-upload.tsx`, `src/components/seller-kitchen-editor.tsx`,
  `src/components/kitchen-settings.tsx`, `app/image-upload.css`, `app/layout.tsx`.
- Basket image refresh: `src/lib/basket-images.ts`,
  `src/components/kitchen-basket.tsx`, `app/page.tsx`.
- Maintenance and verification: `scripts/cleanup-images.ts`,
  `scripts/check-image-uploads.ts`, `tests/image-upload.test.mjs`.
- Dependency and documentation: `package.json`, `package-lock.json`, `.gitignore`,
  `README.md`, this document. Sharp was already present transitively and is now
  declared as a direct runtime dependency. No schema or environment file changed.
