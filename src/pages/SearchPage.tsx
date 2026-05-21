import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Search, X, Clock } from "lucide-react";
import { useUserSearch, useSearchHistory, useSaveSearch, useDeleteSearchHistory } from "@/hooks/useSearch";
import PetAvatar from "@/components/PetAvatar";
import { Button } from "@/components/ui/button";

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { data: searchResults, isLoading } = useUserSearch(searchQuery);
  const { data: searchHistory } = useSearchHistory();
  const { mutate: saveSearch } = useSaveSearch();
  const { mutate: deleteHistory } = useDeleteSearchHistory();

  // Save search when user searches
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        saveSearch(searchQuery);
      }, 1000); // Debounce save

      return () => clearTimeout(timer);
    }
  }, [searchQuery, saveSearch]);

  const handleUserClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHistory(id);
  };

  return (
    <>
      <AppHeader title="Search" />
      <Layout>
        <div className="px-4 py-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for users..."
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Users</h3>
            {isLoading ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground">Searching...</div>
              </div>
            ) : searchResults?.length ? (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.id)}
                    className="w-full p-4 rounded-lg bg-card hover:bg-muted/50 flex items-center space-x-3 text-left transition-colors animate-fade-in hover-scale"
                  >
                    <PetAvatar
                      src={user.avatar_url}
                      name={user.username || user.full_name || "User"}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.full_name || "No name"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        @{user.username || "username"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No users found for "{searchQuery}"
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Try searching for different keywords
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search History when no search */}
        {!searchQuery && searchHistory && searchHistory.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Recent Searches</h3>
            <div className="space-y-2">
              {searchHistory.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleHistoryClick(item.query)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{item.query}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-8 w-8"
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no history */}
        {!searchQuery && (!searchHistory || searchHistory.length === 0) && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recent searches</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start searching to see your history
            </p>
          </div>
        )}
        </div>
      </Layout>
    </>
  );
};

export default SearchPage;
