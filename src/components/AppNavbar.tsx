import {
  Home,
  Search,
  ShoppingCart,
  UserRound,
  Play,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { colorClasses } from "@/lib/theme";
import { usePlatform } from "@/hooks/usePlatform";

const AppNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isNative } = usePlatform();

  const handleNavClick = (to: string, e: React.MouseEvent) => {
    e.preventDefault();

    const isCurrentlyActive =
      to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(
            to.split("/").slice(0, -1).join("/") || to
          );

    if (isCurrentlyActive) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate(to);
  };

  // Phase 2 nav order: Home / Find / Reels / Trove / Space.
  // The Upload (+) tab was removed; a Camera FAB on Home + Find surfaces
  // the create-post action instead. See src/components/CameraFab.tsx.
  const navItems = [
    { icon: Home, to: "/", label: "Home" },
    { icon: Search, to: "/search", label: "Find" },
    { icon: Play, to: "/reels", label: "Reels" },
    { icon: ShoppingCart, to: "/activity", label: "Trove" },
    {
      icon: UserRound,
      to: user ? `/profile/${user.id}` : "/login",
      label: "Space",
    },
  ];

  const isRouteActive = (to: string) => {
    return to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(
          to.split("/").slice(0, -1).join("/") || to
        );
  };

  return (
    <nav
      data-navbar="true"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border flex justify-around select-none"
      )}
      style={{
        paddingTop: "12px",
        paddingBottom: "calc(12px + var(--safe-bottom, 0px))",
        minHeight: "56px",
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-label={item.label}
          title={item.label}
          onClick={(e) => handleNavClick(item.to, e)}
          className="flex flex-col items-center min-w-0 group select-none"
        >
          <item.icon
            className={cn(
              "w-6 h-6 mb-1 md:w-7 md:h-7 transition-all duration-300 ease-out",
              "group-hover:scale-110 group-hover:-translate-y-0.5",
              isRouteActive(item.to)
                ? `${colorClasses.primary} stroke-2`
                : `text-muted-foreground group-hover:${colorClasses.primary}`
            )}
          />
        </Link>
      ))}
    </nav>
  );
};

export default AppNavbar;
