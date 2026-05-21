import { useLocation, useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";

/**
 * Floating "create post" action button. Visible only on Home and Search
 * (the two consumption surfaces where a quick capture entry-point makes
 * sense). On all other routes it returns null so it doesn't fight with
 * page-level CTAs.
 *
 * Sits above the bottom nav, respecting the safe-area inset so it doesn't
 * land under the gesture pill on iOS or the system bar on Android.
 */
const FAB_VISIBLE_ROUTES = new Set<string>(["/", "/search"]);

const CameraFab = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!FAB_VISIBLE_ROUTES.has(location.pathname)) return null;

  return (
    <button
      type="button"
      aria-label="Create post"
      onClick={() => navigate("/upload")}
      // 88px clears the 56px navbar + safe-area padding
      style={{ bottom: "calc(88px + var(--safe-bottom, 0px))" }}
      className="fixed right-5 z-40 grid place-items-center w-14 h-14 rounded-full bg-[#26A69A] text-white shadow-lg shadow-[#26A69A]/40 transition-transform active:scale-95 hover:shadow-xl hover:shadow-[#26A69A]/50"
    >
      <Camera className="w-6 h-6" />
    </button>
  );
};

export default CameraFab;
