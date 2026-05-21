import { useNavigate } from "react-router-dom";
import { Settings2, MessageSquare, DollarSign, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";

const FeedbackSupport = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleFeedback = () => {
    navigate("/feedback");
  };

  const handleSupport = () => {
    navigate("/support");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="p-0 m-0 bg-transparent hover:bg-transparent focus:outline-none focus:ring-0 border-none shadow-none"
        >
          <Settings2 className="h-10 w-10 text-[#26A69A]/100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleFeedback}
          className="cursor-pointer hover:bg-accent"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Feedback
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSupport}
          className="cursor-pointer hover:bg-accent"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Support
        </DropdownMenuItem>

        {/* 
        <DropdownMenuItem
          onClick={toggleTheme}
          className="cursor-pointer hover:bg-accent"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 mr-2" />
          ) : (
            <Moon className="h-4 w-4 mr-2" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FeedbackSupport;
