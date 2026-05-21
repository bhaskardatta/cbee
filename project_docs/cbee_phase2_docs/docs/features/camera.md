# Feature: Native In-App Camera

**Goal:** Replace the current `<input type="file">` flow on `UploadPage` with a full-screen, in-app camera that captures photos and short videos with Instagram-style composition gridlines, branded in the app's teal `#26A69A`.

**Estimated effort:** 4 days (Day 6–9, Week 2 of the sprint).

---

## What ships

| Capability                                  | Status        |
| ------------------------------------------- | ------------- |
| Full-screen camera preview                  | ✓ in Phase 2  |
| Photo capture (JPEG)                        | ✓ in Phase 2  |
| Video capture (MP4, max 60s, max 1080p)     | ✓ in Phase 2  |
| Composition gridlines (off / thirds / 1:1 / 4:5 / 9:16) | ✓ in Phase 2 |
| Front/back camera flip                      | ✓ in Phase 2  |
| Flash toggle (auto / on / off)              | ✓ in Phase 2  |
| Tap-to-focus                                | ✓ in Phase 2 (via JS gesture → `setFocus({x,y})`) |
| Pinch-to-zoom                               | ✓ in Phase 2 (via JS gesture → `setZoom({level})`) |
| Save captured media to user gallery         | Configurable per-tap; default OFF in Phase 2 |
| Filters / stickers / trim                   | ✗ Phase 3+    |
| Boomerang / slowmo                          | ✗ Phase 3+    |
| Multi-clip recording                        | ✗ Phase 3+    |
| Music overlay                               | ✗ Phase 3+    |

---

## Plugin choice

`@capgo/camera-preview@^8.1.4` (Cap-go fork; see `docs/03_DECISIONS.md` ADR-002 for why, not the capacitor-community fork).

Install:
```bash
npm install @capgo/camera-preview@^8
npx cap sync
```

Add `import '@capgo/camera-preview'` to `src/main.tsx` so Capacitor registers the web platform from the plugin (matches `useNativePush` pattern).

---

## New / changed files

| File                                                   | Action  | Lines (est) |
| ------------------------------------------------------ | ------- | ----------- |
| `src/hooks/useNativeCamera.ts`                         | NEW     | ~120        |
| `src/components/camera/NativeCameraSheet.tsx`          | NEW     | ~280        |
| `src/components/camera/GridlinesOverlay.tsx`           | NEW     | ~110        |
| `src/components/camera/ShutterButton.tsx`              | NEW     | ~90         |
| `src/pages/UploadPage.tsx`                             | EDIT    | +~50        |
| `src/hooks/useMediaUpload.ts`                          | EDIT    | +~15        |
| `android/app/src/main/AndroidManifest.xml`             | EDIT    | +6 lines    |
| `ios/App/App/Info.plist`                               | EDIT    | +8 lines    |
| `capacitor.config.ts`                                  | EDIT    | none required (camera-preview reads no top-level config) |

---

## Permission strings

### `android/app/src/main/AndroidManifest.xml`

Inside `<manifest>`, alongside the existing `INTERNET` permission:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

`android:required="false"` matters: it lets the app install on tablets without rear cameras (rare, but a Play Store hygiene win).

### `ios/App/App/Info.plist`

Inside the top-level `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>cbee uses your camera to capture photos and short videos of your pets.</string>

<key>NSMicrophoneUsageDescription</key>
<string>cbee records audio when you film a video so your pet's voice comes through.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>cbee accesses your photo library so you can share existing photos and videos of your pets.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>cbee saves photos and videos you capture so you can revisit them later.</string>
```

Apple rejects iOS apps with missing usage strings on review. Get these right Day 1.

---

## `useNativeCamera.ts` — the hook

Mirror the shape of `src/hooks/useNativePush.ts` and `src/hooks/useMediaUpload.ts`.

Public API:

```ts
export type CameraMediaKind = 'photo' | 'video';

export type CameraCaptureResult =
  | { kind: 'photo'; file: File; width: number; height: number; aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' }
  | { kind: 'video'; file: File; durationSeconds: number; width: number; height: number; aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' };

export interface UseNativeCameraReturn {
  isPreviewing: boolean;
  permissionStatus: 'unknown' | 'prompt' | 'granted' | 'denied';
  requestPermissions: () => Promise<{ camera: boolean; mic: boolean }>;
  startPreview: (opts?: { position?: 'rear' | 'front'; aspectRatio?: '4:3' | '16:9' }) => Promise<void>;
  stopPreview: () => Promise<void>;
  capturePhoto: () => Promise<CameraCaptureResult>;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<CameraCaptureResult>;
  flipCamera: () => Promise<void>;
  setFlashMode: (mode: 'off' | 'on' | 'auto') => Promise<void>;
  setFocus: (x: number, y: number) => Promise<void>;        // normalized 0-1
  setZoom: (level: number) => Promise<void>;
  setGridMode: (mode: 'none' | '3x3' | '4x4') => Promise<void>;
}

export function useNativeCamera(): UseNativeCameraReturn;
```

Behavior notes:

- `startPreview` uses `storeToFile: true` so capture results return file paths, not 30MB base64 strings (see `docs/04_GOTCHAS.md` G-6).
- **Video recording uses an explicit bitrate cap**: `startRecordVideo({ videoBitrate: 3500000 })` — 3.5 Mbps. Default camera bitrates can hit 6-8 Mbps which doubles the bandwidth bill forever. 3.5 Mbps at 1080p looks identical on a phone screen and produces ~13MB for a 30s clip vs ~22MB at default. This is the single most impactful cost-control decision in the codebase.
- On permission denial, call `requestPermissions({ showSettingsAlert: true })` so the user gets a native "Open Settings" prompt.
- `capturePhoto()` reads the returned file path, converts via `getBase64FromFilePath` only if a small caller needs base64; otherwise returns a `File` object built from the file path (via `Filesystem.readFile` → `Blob` → `File`).
- `stopVideo()` returns a `File` of the MP4, reading via `Filesystem.readFile` from the path in `videoFilePath`.
- The aspect ratio in the result is computed from the captured width/height — match to the nearest of `'1:1' | '4:5' | '9:16' | '16:9'`.

**Uploading the captured file:** the camera's job ends at returning a `File`. The upload itself is handled by `useMediaUpload` which goes through the Cloudflare R2 architecture — see `docs/features/media_storage.md` for the full flow.

EXIF data is returned by `CameraPreview.capture()` — you don't need to read it separately for photos. For videos, read duration from the file metadata after upload (no MediaInfo dep needed; HTMLVideoElement.duration works once the file is loaded into a sandbox `<video>`).

---

## `NativeCameraSheet.tsx` — the UI

A full-screen Radix Dialog (or `vaul` Drawer if it looks cleaner in iOS — try both). Opens via prop `open={isOpen}` from `UploadPage`. Closes on a top-right X button or hardware back.

### Component tree

```
<Dialog open={...} onOpenChange={...}>
  <DialogContent className="w-screen h-screen p-0 max-w-none">
    <div className="relative w-full h-full bg-black">
      {/* The camera preview is rendered by the plugin in the native layer,
          BEHIND the WebView (toBack: true). The WebView itself shows transparent
          where this div is — see "Transparent background" below. */}

      <GridlinesOverlay mode={gridMode} className="absolute inset-0 pointer-events-none" />

      <div className="absolute top-0 inset-x-0 pt-[env(safe-area-inset-top)] px-4 flex justify-between items-center">
        <button onClick={onClose} aria-label="Close camera"><XIcon /></button>
        <button onClick={cycleFlash} aria-label={`Flash ${flashMode}`}>
          {flashMode === 'auto' && <FlashAutoIcon />}
          {flashMode === 'on' && <FlashOnIcon />}
          {flashMode === 'off' && <FlashOffIcon />}
        </button>
        <button onClick={flipCamera} aria-label="Flip camera"><FlipIcon /></button>
      </div>

      <div className="absolute top-16 right-4">
        <button
          onClick={cycleGridMode}
          aria-label={`Gridlines ${gridMode}`}
          className="px-3 py-1 bg-black/50 text-white rounded-full text-sm"
        >
          {labelForGridMode(gridMode)}
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 pb-[max(env(safe-area-inset-bottom),1rem)] flex flex-col items-center gap-3">
        <ModePillToggle mode={captureMode} onChange={setCaptureMode} />
        <ShutterButton
          mode={captureMode}
          onPhotoCapture={handlePhotoCapture}
          onVideoStart={handleVideoStart}
          onVideoStop={handleVideoStop}
          maxVideoMs={60_000}
        />
      </div>

      {/* JS-driven tap-to-focus and pinch-to-zoom layers */}
      <FocusGestureLayer onFocus={(x,y) => setFocus(x,y)} />
      <ZoomGestureLayer onZoom={(level) => setZoom(level)} />
    </div>
  </DialogContent>
</Dialog>
```

### Transparent background

The Cap-go plugin uses `toBack: true` by default. That means the native camera preview renders BEHIND the WebView, and the WebView must be transparent for the camera to show through. Add this to `src/index.css` (gated on a body class so it only applies when the camera sheet is open):

```css
body.camera-active {
  background: transparent !important;
}
body.camera-active #root {
  background: transparent !important;
}
```

Toggle the class via a `useEffect` in `NativeCameraSheet` on mount / unmount:

```ts
useEffect(() => {
  document.body.classList.add('camera-active');
  return () => document.body.classList.remove('camera-active');
}, []);
```

### Tap-to-focus gesture

The plugin disables native gesture handlers (intentional — they fight WebView touches). Implement JS:

```tsx
function FocusGestureLayer({ onFocus }: { onFocus: (x: number, y: number) => void }) {
  return (
    <div
      className="absolute inset-0"
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        onFocus(x, y);
        // Show a brief animated reticle at the tap point — Framer Motion
      }}
    />
  );
}
```

### Pinch-to-zoom gesture

Use Pointer Events (touch and pen). Track two-finger distance, map delta to zoom level (relative or absolute — relative is more natural).

```tsx
function ZoomGestureLayer({ onZoom }: { onZoom: (level: number) => void }) {
  // ~30 lines: track active pointers in a ref, compute distance on pointermove,
  // map dist delta to zoom level via getZoom() / setZoom().
}
```

---

## `GridlinesOverlay.tsx` — the overlay

Pure SVG, full-bleed, `pointer-events: none` so taps pass through. Props: `mode: 'off' | 'thirds' | '1:1' | '4:5' | '9:16'`.

**For `thirds`:** Two horizontal lines at 33.33% and 66.66%, two vertical lines at the same. Use `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` so the SVG scales to the container.

**For `1:1`, `4:5`, `9:16`:** Render the same thirds grid INSIDE a centered rectangle of the corresponding aspect ratio. Compute the rectangle's dimensions client-side based on the viewport — use `window.innerWidth` and `window.innerHeight`, then compute the inscribed rect.

```tsx
type GridMode = 'off' | 'thirds' | '1:1' | '4:5' | '9:16';

interface GridlinesOverlayProps {
  mode: GridMode;
  className?: string;
}

export default function GridlinesOverlay({ mode, className }: GridlinesOverlayProps) {
  if (mode === 'off') return null;

  // For 'thirds', the rectangle IS the viewport. Otherwise compute inscribed rect.
  const aspectRatio: number | null =
    mode === '1:1' ? 1 :
    mode === '4:5' ? 4 / 5 :
    mode === '9:16' ? 9 / 16 :
    null;

  // … render SVG (see ascii mock in tech plan section 6.4) …
}
```

Stroke styling: `stroke="white"`, `stroke-opacity="0.5"`, `stroke-width="1"`, plus a 1-pixel drop shadow for visibility against any backdrop:

```jsx
<g style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8))' }}>
  <line .../>
  ...
</g>
```

For the frame guides (1:1, 4:5, 9:16), render the rectangle outline at 1.5px white for slightly more prominence than the thirds lines.

Toggle behavior in `NativeCameraSheet`: button cycles `off → thirds → 1:1 → 4:5 → 9:16 → off`. Persist last choice via `@capacitor/preferences` so it survives sheet close.

---

## `ShutterButton.tsx` — the shutter

Tap = photo. Press-and-hold = start video; release or reach max = stop video.

```tsx
interface ShutterButtonProps {
  mode: 'photo' | 'video';
  onPhotoCapture: () => Promise<void> | void;
  onVideoStart: () => Promise<void> | void;
  onVideoStop: () => Promise<void> | void;
  maxVideoMs: number;
}
```

Visual: large circle (~80px), white border (~4px), white inner dot. When recording: red inner dot, animated progress ring around the perimeter (Framer Motion `motion.svg`).

Behavior:
- `onPointerDown` in video mode: start a timer, call `onVideoStart()`, transition to recording state.
- `onPointerUp` or auto at `maxVideoMs`: call `onVideoStop()`, transition back.
- Tap-only in photo mode: just call `onPhotoCapture()`.

Haptic feedback (`@capacitor/haptics`) on shutter press: `Haptics.impact({ style: ImpactStyle.Medium })`.

---

## `UploadPage.tsx` — the edit

The existing `UploadPage` uses a hidden `<input type="file">` triggered by a button. We add a "Take Photo or Video" button next to the existing "Choose from gallery" button. Tapping it opens `NativeCameraSheet`. On capture, the resulting File flows into the same `selectedFile` / `preview` state the file picker uses today.

Pseudo-diff:

```tsx
// Inside UploadPage component:
const [cameraOpen, setCameraOpen] = useState(false);
const [captureMeta, setCaptureMeta] = useState<{
  mediaKind: 'image' | 'video';
  mediaAspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  durationSeconds?: number;
} | null>(null);

const handleCameraCapture = async (result: CameraCaptureResult) => {
  setCameraOpen(false);
  setSelectedFile(result.file);

  if (result.kind === 'photo') {
    const resized = await resizeImage(result.file);   // existing logic
    setPreview(resized);
    setCaptureMeta({
      mediaKind: 'image',
      mediaAspectRatio: result.aspectRatio,
    });
  } else {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(result.file);
    setCaptureMeta({
      mediaKind: 'video',
      mediaAspectRatio: result.aspectRatio,
      durationSeconds: result.durationSeconds,
    });
  }
};

// In the JSX, alongside the existing "Choose from gallery" button:
<Button
  variant="default"
  className="bg-[#26A69A] hover:bg-[#1f8c81] text-white"
  onClick={() => setCameraOpen(true)}
>
  <CameraIcon className="mr-2 h-4 w-4" />
  Take Photo or Video
</Button>

<NativeCameraSheet
  open={cameraOpen}
  onClose={() => setCameraOpen(false)}
  onCapture={handleCameraCapture}
/>
```

And in the submit handler, pass `mediaKind`, `mediaAspectRatio`, `durationSeconds` through to `useCreatePost`. The migration's sync trigger keeps `posts.type` aligned automatically; we still write to `media_kind` directly.

---

## Gallery import — video duration cap

The existing gallery picker accepts videos up to 50MB but has NO duration cap. A user can pick a 5-minute pet video → it goes into the post → Reels feed tries to load it → 30+ seconds of buffering.

Add to `UploadPage` (or to `useMediaUpload` for centralization):

```ts
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video duration'));
    };
    v.src = url;
  });
}

// In the file handler:
if (file.type.startsWith('video/')) {
  const duration = await getVideoDuration(file);
  if (duration > 60) {
    toast({ title: 'Video too long', description: 'Pet videos must be 60 seconds or less.' });
    return;
  }
}
```

---

## `useMediaUpload.ts` — the edit

The camera hook returns a `File`. The upload itself happens via the rewritten `useMediaUpload` hook, which routes everything through the Cloudflare R2 architecture (signed PUT URLs from the `get-upload-url` Supabase Edge Function). Full details in `docs/features/media_storage.md`.

Quick reference:
```ts
const { upload, uploading, progress } = useMediaUpload();
const result = await upload(file, 'image' | 'video' | 'thumbnail');
// result.publicUrl  →  https://media.cbee.in/<user_id>/<timestamp>.<ext>
```

The chat `messages` bucket stays on Supabase Storage (Phase 1 legacy, low volume). Everything else goes to R2.

---

## Thumbnail generation for video

After a video file is captured (or imported), generate a JPEG thumbnail from the first frame at t=0.5s:

```ts
async function makeVideoThumbnail(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = 'anonymous';
  v.playsInline = true;
  v.muted = true;

  await new Promise<void>((resolve, reject) => {
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, v.duration / 2);
    };
    v.onseeked = () => resolve();
    v.onerror = (e) => reject(e);
  });

  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(v, 0, 0);
  URL.revokeObjectURL(url);

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], 'thumb.jpg', { type: 'image/jpeg' })),
      'image/jpeg',
      0.75
    );
  });
}
```

Upload this thumbnail via `upload(thumbFile, 'thumbnail')`. The R2 object key gets the `_thumbnail.jpg` suffix automatically (see `media_storage.md`). Save the returned `publicUrl` into `posts.thumbnail_url`.

---

## Edge cases to handle

| Case                                         | Behavior                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Camera permission denied                     | Sonner toast with "Open Settings" button → `requestPermissions({ showSettingsAlert: true })` |
| Mic permission denied (video record attempt) | Stay in preview, surface inline warning, allow photo capture only              |
| Low device storage                           | Catch write error from `Filesystem`; toast "Not enough space, free up storage" |
| Interrupted recording (phone call, app bg)   | `camera-preview` emits stop event; finalize partial video, prompt keep/discard |
| App killed mid-upload                        | TanStack mutation retries once; leftover temp file cleaned on next launch       |
| iOS WebView audio session collision          | See `docs/04_GOTCHAS.md` G-3 — tear down all `<video>` elements before opening |
| User rotates device mid-record               | Plugin emits `orientationChange`; lock orientation via `lockAndroidOrientation: true` in startPreview |

---

## Acceptance criteria (DoD)

A "done" camera feature means all of:

- [ ] On Android emulator: camera opens, gridlines render, photo capture saves to `posts` table with `media_kind='image'` and correct aspect ratio.
- [ ] On Android emulator: video capture (10s) saves to `posts` table with `media_kind='video'`, `duration_seconds=10.0±0.2`, `thumbnail_url` populated.
- [ ] On Pixel 7 real device: camera open → preview visible in < 800ms.
- [ ] On Pixel 7 real device: tap-to-focus visibly works (reticle animation appears at tap point, sharp area shifts).
- [ ] On Pixel 7 real device: pinch-to-zoom smoothly changes zoom from 1x to 5x.
- [ ] On Pixel 7: front/back flip works; flash modes cycle visibly affect output.
- [ ] On Redmi 12 real device: photo capture works without OOM; video record up to 60s works without OOM.
- [ ] On iOS simulator: same flows work (camera will be a placeholder on simulator, but UI must render correctly).
- [ ] On a real iPhone (Bhaskar's): all of the above + verify audio recording works (no silent recordings — see G-3).
- [ ] Permission-denied flow: toast appears, "Open Settings" deep-links correctly.
- [ ] Gallery-import flow: video > 60s rejected with clear message.

---

**Next:** `docs/features/reels.md` for the consumption side, or `docs/features/upload_flow.md` for the small refactor that wires this in.
