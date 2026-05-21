# Mobile Safe Areas Implementation

This document explains the safe area implementation for the mobile app to prevent UI elements from being overlapped by system bars (status bar, navigation bar, notch).

## What was implemented:

### 1. Tailwind Configuration
Added safe area utilities to `tailwind.config.ts`:
- `pt-safe-top` / `pb-safe-bottom` for padding
- `safe-top` / `safe-bottom` for spacing
- Support for all safe area insets (top, bottom, left, right)

### 2. Platform Detection Hook
Created `src/hooks/usePlatform.ts` to detect:
- Whether app is running natively (vs web)
- Platform type (iOS, Android, Web)
- Helper booleans for easy platform checks

### 3. Updated Components

#### AppHeader (`src/components/AppHeader.tsx`)
- Added `pt-safe-top` padding when running natively
- Prevents header from being hidden behind status bar/notch

#### AppNavbar (`src/components/AppNavbar.tsx`)
- Added `pb-safe-bottom` padding when running natively  
- Prevents navigation bar from being hidden behind Android navigation buttons

#### StatusBar Configuration (`src/components/StatusBarConfig.tsx`)
- Automatically configures status bar style based on theme
- Sets appropriate background colors for light/dark mode
- Uses dynamic imports to avoid build errors on web

### 4. CSS Updates
Updated `src/index.css` to include base safe area support in body element.

## How it works:

1. **Platform Detection**: The `usePlatform` hook detects if the app is running natively
2. **Conditional Styling**: Safe area classes are only applied when `isNative` is true
3. **Dynamic StatusBar**: StatusBar style adapts to light/dark theme automatically
4. **CSS Variables**: Uses `env(safe-area-inset-*)` CSS environment variables

## For development:

When testing on physical devices or emulators:
1. Export project to GitHub
2. Git pull locally
3. Run `npm install`
4. Add platforms: `npx cap add android` / `npx cap add ios`
5. Build: `npm run build`
6. Sync: `npx cap sync`
7. Run: `npx cap run android` / `npx cap run ios`

## Dependencies added:
- `@capacitor/status-bar` - For native status bar configuration

The implementation ensures that:
- ✅ Top header never gets hidden behind status bar/notch
- ✅ Bottom navigation never gets hidden behind system navigation
- ✅ Safe areas only apply on native builds (not web)
- ✅ StatusBar style matches app theme automatically
- ✅ Works on both Android and iOS devices