# Feature: Bottom Navigation Reshuffle + Camera FAB

**Goal:** Make room for the Reels tab without exceeding 5 nav items. Promote the upload entry point to a more discoverable place by replacing the Upload tab with a floating action button (FAB).

**Estimated effort:** ~3 hours (Day 10, end of Week 2).

---

## Phase 1 nav (5 tabs)

```
┌──────┬──────┬──────┬──────┬──────┐
│      │      │      │      │      │
│ Home │ Find │  +   │ Trove│Space │
│      │      │ (Up) │ (Act)│(Prof)│
└──────┴──────┴──────┴──────┴──────┘
```

## Phase 2 nav (5 tabs + FAB)

```
                                        ┌────┐
                                        │ 📷 │  ← FAB
                                        └────┘
┌──────┬──────┬──────┬──────┬──────┐
│      │      │      │      │      │
│ Home │ Find │Reels │ Trove│Space │
│      │      │      │      │      │
└──────┴──────┴──────┴──────┴──────┘
```

The FAB is anchored bottom-right, ~16px above the nav bar's top edge and ~16px in from the right edge. It's visible only on Home and Search pages (the most likely places a user thinks "I want to share something").

---

## Why this layout

See `docs/03_DECISIONS.md` ADR-009. Short version:
- Reels deserves the visual anchor (center) slot — it's the new flagship.
- 6 tabs cram visually on 5.5" 720p phones.
- A FAB for camera matches Instagram + WhatsApp; users already know the pattern.
- The upload remains 1 tap from the home feed, just located differently.

---

## File: `src/components/Layout.tsx`

Single file change. The component renders the bottom nav today. Phase 2 changes:

1. Replace the "Upload" tab with a "Reels" tab.
2. Add a `<FAB>` component, conditionally rendered based on route.

### Current code (approx)

```tsx
// Layout.tsx, today
const tabs = [
  { to: '/home', icon: HomeIcon, label: 'Home' },
  { to: '/search', icon: SearchIcon, label: 'Find' },
  { to: '/upload', icon: CirclePlusIcon, label: '' },         // big + button
  { to: '/activity', icon: BellIcon, label: 'Trove' },
  { to: '/profile', icon: UserIcon, label: 'Space' },
];

return (
  <div className="flex flex-col h-screen">
    <main className="flex-1 overflow-y-auto">
      <Outlet />
    </main>
    <nav className="border-t bg-white flex pb-[max(env(safe-area-inset-bottom),0px)]">
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} className="flex-1 py-3 flex flex-col items-center">
          <tab.icon className="h-6 w-6" />
          <span className="text-xs">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
);
```

### Phase 2 code

```tsx
import { CameraIcon, HomeIcon, SearchIcon, BellIcon, UserIcon, VideoIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { to: '/home', icon: HomeIcon, label: 'Home' },
  { to: '/search', icon: SearchIcon, label: 'Find' },
  { to: '/reels', icon: VideoIcon, label: 'Reels' },          // CHANGED
  { to: '/activity', icon: BellIcon, label: 'Trove' },
  { to: '/profile', icon: UserIcon, label: 'Space' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // FAB visible on Home and Search only; hidden in Reels (full-screen), Trove, Space, etc.
  const showFab = ['/home', '/search'].includes(location.pathname);

  return (
    <div className="flex flex-col h-screen relative">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {showFab && (
        <button
          onClick={() => navigate('/upload')}
          aria-label="Create post"
          className="
            absolute right-4
            bottom-[calc(env(safe-area-inset-bottom)+5rem)]
            w-14 h-14 rounded-full
            bg-[#26A69A] hover:bg-[#1f8c81]
            text-white shadow-lg shadow-[#26A69A]/40
            flex items-center justify-center
            transition-transform active:scale-95
          "
        >
          <CameraIcon className="h-6 w-6" />
        </button>
      )}

      <nav className="border-t bg-white flex pb-[max(env(safe-area-inset-bottom),0px)]">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 py-2.5 flex flex-col items-center gap-0.5 ${
                isActive ? 'text-[#26A69A]' : 'text-gray-500'
              }`
            }
          >
            <tab.icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

---

## FAB position math

The nav bar is approximately 56px tall + safe-area-bottom. The FAB sits ~16px above the top edge of the nav:

```css
bottom: calc(env(safe-area-inset-bottom) + 5rem)
```

(`5rem` = 80px = 56px nav + 24px spacing.)

On Pixel 7 (gesture nav, safe-area-inset-bottom ≈ 32px): FAB bottom = 32 + 80 = 112px from physical bottom — comfortably visible.

On Redmi 12 with 3-button nav (rare in 2026 but exists): safe-area-inset-bottom = 0px because the OS reserves space for the nav bar itself. FAB bottom = 80px from screen edge. Still good.

---

## Hide-on-scroll (optional)

To avoid the FAB obscuring content, optionally hide it when the user scrolls down and re-show when they scroll up. ~10 lines using a scroll listener + a `transform: translateY(120px)` class:

```tsx
const [hidden, setHidden] = useState(false);
const lastScrollY = useRef(0);

useEffect(() => {
  const main = document.querySelector('main');
  if (!main) return;
  const onScroll = () => {
    const y = main.scrollTop;
    setHidden(y > lastScrollY.current + 20);   // hide on scroll down
    if (y < lastScrollY.current - 20) setHidden(false);
    lastScrollY.current = y;
  };
  main.addEventListener('scroll', onScroll);
  return () => main.removeEventListener('scroll', onScroll);
}, []);

// Class:
className={`… transition-transform ${hidden ? 'translate-y-32' : 'translate-y-0'}`}
```

Verdict: nice-to-have. Skip unless time permits — adds gestural complexity that can fight with the page's own scroll behavior.

---

## Active-state styling for Reels tab

When the user is on `/reels`, the page is full-screen black. The nav bar is also visible (NOT hidden). The active tab indicator should:
- Use the teal color `#26A69A` for the active icon + label
- Underline or pill style — match whatever Phase 1 uses (verify on Day 1)

Don't hide the nav on Reels page. Users need to navigate away.

---

## Icon choices

Use Lucide React (already in deps). Recommended icons:

| Tab     | Icon                     | Why                                       |
| ------- | ------------------------ | ----------------------------------------- |
| Home    | `HomeIcon`               | unchanged from Phase 1                    |
| Find    | `SearchIcon`             | unchanged from Phase 1                    |
| Reels   | `VideoIcon` or `ClapperboardIcon` | `Video` is cleaner; `Clapperboard` is more Reels-y |
| Trove   | `BellIcon`               | unchanged from Phase 1                    |
| Space   | `UserIcon`               | unchanged from Phase 1                    |
| FAB     | `CameraIcon`             | hints at the camera-first upload flow     |

Try `Video` first; if Swaroop wants more visual emphasis, swap to `Clapperboard` (it has the kid-of-Reels look).

---

## Edge cases

| Case                                       | Behavior                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Keyboard is open                           | Nav stays at bottom; safe-area math handles keyboard inset. FAB is hidden when keyboard is open (it'd float over the keyboard) — check `useNativeKeyboard.ts` value. |
| Reels page in immersive landscape (Phase 3+) | Hide nav and FAB                                                                  |
| User is unauthenticated                    | Not applicable — `Layout` is only rendered inside `ProtectedRoute`.                  |
| Notification banner pushes content down    | Nav and FAB unaffected (they're absolute/fixed, the banner pushes only main).        |

---

## Acceptance criteria (DoD)

- [ ] Layout renders 5 tabs (Home, Find, Reels, Trove, Space) with no overflow on a 360px-wide screen.
- [ ] Tapping the Reels tab navigates to `/reels`.
- [ ] FAB appears on `/home` and `/search` pages.
- [ ] FAB does NOT appear on `/reels`, `/activity`, `/profile`, `/messages`, `/upload`.
- [ ] Tapping the FAB navigates to `/upload`.
- [ ] Active tab indicator uses the teal `#26A69A` color.
- [ ] On Pixel 7 with gesture nav: FAB is not occluded by gestural area.
- [ ] On Redmi 12 with 3-button nav: FAB is not occluded by nav.
- [ ] On iPhone: FAB clears the home indicator area.

---

**Next:** `docs/features/moderation_mvp.md` for the report button.
