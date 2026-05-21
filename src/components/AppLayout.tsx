import { Outlet } from "react-router-dom";
import AppNavbar from "./AppNavbar";
import CameraFab from "./CameraFab";

const AppLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground select-none">
      <main className="flex-1 pb-20 select-text">
        <Outlet />
      </main>
      {/* Camera FAB self-hides on routes other than Home / Find */}
      <CameraFab />
      {/* Show navbar on all devices after authentication */}
      <AppNavbar />
    </div>
  );
};

export default AppLayout;
