import { ReactNode, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  hasHeader?: boolean;
  hasBottomNav?: boolean;
  className?: string;
}

const Layout = ({
  children,
  hasHeader = true,
  hasBottomNav = true,
  className,
}: LayoutProps) => {
  const [headerHeight, setHeaderHeight] = useState(56); // Default header height
  const [navbarHeight, setNavbarHeight] = useState(56); // Default navbar height
  const headerRef = useRef<ResizeObserver | null>(null);
  const navbarRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    // Observe header height changes
    const header = document.querySelector('header[data-header="true"]');
    if (header && hasHeader) {
      const updateHeaderHeight = () => {
        const height = header.getBoundingClientRect().height;
        setHeaderHeight(height);
      };

      // Initial measurement
      updateHeaderHeight();

      // Create ResizeObserver to track header size changes
      headerRef.current = new ResizeObserver(updateHeaderHeight);
      headerRef.current.observe(header);
    }

    // Observe navbar height changes
    const navbar = document.querySelector('nav[data-navbar="true"]');
    if (navbar && hasBottomNav) {
      const updateNavbarHeight = () => {
        const height = navbar.getBoundingClientRect().height;
        setNavbarHeight(height);
      };

      // Initial measurement
      updateNavbarHeight();

      // Create ResizeObserver to track navbar size changes
      navbarRef.current = new ResizeObserver(updateNavbarHeight);
      navbarRef.current.observe(navbar);
    }

    return () => {
      if (headerRef.current) {
        headerRef.current.disconnect();
      }
      if (navbarRef.current) {
        navbarRef.current.disconnect();
      }
    };
  }, [hasHeader, hasBottomNav]);

  return (
    <div
      className={cn("w-full", className)}
      style={{
        marginTop: hasHeader ? `${headerHeight}px` : 0,
        marginBottom: hasBottomNav ? `${navbarHeight}px` : 0,
        minHeight: `calc(100vh - ${hasHeader ? headerHeight : 0}px - ${hasBottomNav ? navbarHeight : 0}px)`,
      }}
    >
      {children}
    </div>
  );
};

export default Layout;
