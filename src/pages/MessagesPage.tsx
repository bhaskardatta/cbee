import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  CheckCheck,
  Image as ImageIcon,
  Video,
  Smile,
  Paperclip,
} from "lucide-react";
import EmojiPicker from "@/components/EmojiPicker";
import AnimatedEmoji from "@/components/AnimatedEmoji";
import {
  useMessages,
  useSendMessage,
  useConversations,
  useMarkAsRead,
} from "@/hooks/useMessages";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import PetAvatar from "@/components/PetAvatar";
import {
  format,
  isToday,
  isYesterday,
  formatDistanceToNow,
  isSameMinute,
} from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useMediaUpload, MediaType } from "@/hooks/useMediaUpload";
import { useMobileKeyboard } from "@/hooks/useMobileKeyboard";
import { useMobileKeyboardGap } from "@/hooks/useMobileKeyboardGap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OptimisticMessage = {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  media_url?: string;
  media_type?: MediaType;
  isOptimistic?: boolean;
  isSending?: boolean;
};

const MessagesPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<
    OptimisticMessage[]
  >([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newEmojiMessages, setNewEmojiMessages] = useState<Set<string>>(
    new Set()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMedia, isUploading } = useMediaUpload();
  const { inputRef: mobileInputRef } = useMobileKeyboard();
  const { keyboardHeight, isKeyboardOpen, reducedGap } = useMobileKeyboardGap();

  const { data: profile } = useProfile(userId);
  const { data: messages, isLoading } = useMessages(userId);
  const { data: conversations } = useConversations();
  const { mutate: sendMessage, isPending } = useSendMessage();
  const { mutate: markAsRead } = useMarkAsRead();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, optimisticMessages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [userId]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (!messages || !user || !userId) return;

    const unreadMessages = messages.filter(
      (msg: any) => msg.receiver_id === user.id && !msg.is_read
    );

    unreadMessages.forEach((msg: any) => {
      markAsRead({ messageId: msg.id });
    });
  }, [messages, user, userId, markAsRead]);

  const handleSendMessage = async (
    mediaUrl?: string,
    mediaType?: MediaType
  ) => {
    if ((!messageText.trim() && !mediaUrl) || !userId || !user?.id) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,
      content: messageText.trim(),
      sender_id: user.id,
      receiver_id: userId,
      created_at: new Date().toISOString(),
      media_url: mediaUrl,
      media_type: mediaType,
      isOptimistic: true,
      isSending: true,
    };

    // Add optimistic message immediately
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);

    // Track emoji messages for animation
    if (isEmojiMessage(messageText.trim())) {
      setNewEmojiMessages((prev) => new Set([...prev, optimisticId]));
      // Remove from animation set after animation completes
      setTimeout(() => {
        setNewEmojiMessages((prev) => {
          const newSet = new Set(prev);
          newSet.delete(optimisticId);
          return newSet;
        });
      }, 1000);
    }

    setMessageText("");

    sendMessage(
      {
        receiverId: userId,
        content: messageText.trim() || "",
        mediaUrl,
        mediaType,
      },
      {
        onSuccess: () => {
          // Remove optimistic message after real message arrives
          setOptimisticMessages((prev) =>
            prev.filter((msg) => msg.id !== optimisticId)
          );
        },
        onError: () => {
          // Remove failed optimistic message
          setOptimisticMessages((prev) =>
            prev.filter((msg) => msg.id !== optimisticId)
          );
          toast({
            title: "Failed to send message",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleMediaSelect = async (mediaType: MediaType) => {
    if (!user) return;

    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";

    if (
      mediaType === "image" ||
      mediaType === "gif" ||
      mediaType === "sticker"
    ) {
      input.accept = "image/*";
    } else if (mediaType === "video") {
      input.accept = "video/*";
    }

    // Add to DOM temporarily
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const mediaUrl = await uploadMedia(file, user.id, mediaType);
        if (mediaUrl) {
          handleSendMessage(mediaUrl, mediaType);
        }
      } catch (error) {
        console.error("Error uploading media:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload media. Please try again.",
          variant: "destructive",
        });
      } finally {
        // Clean up
        document.body.removeChild(input);
      }
    };

    input.oncancel = () => {
      // Clean up if user cancels
      document.body.removeChild(input);
    };

    input.click();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setShowEmojiPicker(false);
  };

  // Helper function to detect if message contains only emojis
  const isEmojiMessage = (content: string) => {
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    const nonEmojiChars = content.replace(emojiRegex, "").trim();
    return emojis.length > 0 && nonEmojiChars.length === 0;
  };

  // Handle mobile keyboard events
  useEffect(() => {
    const handleMobileKeyboard = (e: KeyboardEvent) => {
      // Handle mobile keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            handleSendMessage();
            break;
          case "e":
            e.preventDefault();
            setShowEmojiPicker(!showEmojiPicker);
            break;
        }
      }
    };

    document.addEventListener("keydown", handleMobileKeyboard);
    return () => document.removeEventListener("keydown", handleMobileKeyboard);
  }, [showEmojiPicker]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        showEmojiPicker &&
        !target.closest("[data-emoji-picker]") &&
        !target.closest("[data-emoji-button]")
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Format date for grouping
  const formatMessageDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd MMM yyyy");
  };

  if (!userId) {
    return (
      <>
        <AppHeader title="Messages" />
        <Layout>
          <div className="px-4 py-6">
            <h2 className="text-xl font-bold mb-4">Your Conversations</h2>
            {conversations?.length ? (
              <div className="space-y-2">
                {conversations.map((conversation: any) => (
                  <button
                    key={conversation.user.id}
                    onClick={() =>
                      navigate(`/messages/${conversation.user.id}`)
                    }
                    className="w-full p-4 rounded-lg bg-card hover:bg-muted/50 flex items-center space-x-3 text-left"
                  >
                    <PetAvatar
                      src={conversation.user.avatar_url}
                      name={
                        conversation.user.username ||
                        conversation.user.full_name
                      }
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {conversation.user.full_name ||
                          conversation.user.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.lastMessage.content}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(conversation.lastMessage.created_at)
                        )}{" "}
                        ago
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-primary text-white text-xs rounded-full px-2 py-1 mt-1">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No conversations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start a conversation by visiting a user's profile
                </p>
              </div>
            )}
          </div>
        </Layout>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Messages" showBackButton />
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading messages...</div>
          </div>
        </Layout>
      </>
    );
  }

  // Combine real messages with optimistic messages
  const allMessages = [...(messages || []), ...optimisticMessages];

  // Group messages by date
  const groupedMessages = allMessages.reduce((acc: any, message: any) => {
    const dateKey = formatMessageDate(message.created_at);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(message);
    return acc;
  }, {});

  // Helper to check if messages are consecutive from same user
  const isConsecutiveMessage = (currentMsg: any, prevMsg: any) => {
    if (!prevMsg) return false;
    return (
      currentMsg.sender_id === prevMsg.sender_id &&
      isSameMinute(
        new Date(currentMsg.created_at),
        new Date(prevMsg.created_at)
      )
    );
  };

  return (
    <>
      <AppHeader
        title={profile?.full_name || profile?.username || "Messages"}
        showBackButton
        className="!translate-y-0" // Force header to stay visible
      />
      <Layout className="flex flex-col" hasBottomNav={false}>
        {/* Messages Container */}
        <div className="flex-1 px-4 py-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {allMessages.length > 0 ? (
            <div className="space-y-1">
              {Object.entries(groupedMessages || {}).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date Divider */}
                  <div className="flex justify-center my-3">
                    <span className="bg-muted/80 text-muted-foreground text-[11px] px-2.5 py-1 rounded-md">
                      {date}
                    </span>
                  </div>

                  {/* Messages for this date */}
                  {(msgs as any[]).map((message: any, index: number) => {
                    const isOwn = message.sender_id === user?.id;
                    const prevMessage =
                      index > 0 ? (msgs as any[])[index - 1] : null;
                    const isConsecutive = isConsecutiveMessage(
                      message,
                      prevMessage
                    );

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isOwn ? "justify-end" : "justify-start"
                        } ${isConsecutive ? "mb-0.5" : "mb-2"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {message.media_url && (
                            <div className="mb-1">
                              {(message.media_type === "image" ||
                                message.media_type === "gif" ||
                                message.media_type === "sticker") && (
                                <img
                                  src={message.media_url}
                                  alt="Media"
                                  className="rounded-lg max-w-[250px] max-h-[300px] object-cover cursor-pointer"
                                  onClick={() => window.open(message.media_url, "_blank")}
                                />
                              )}
                              {message.media_type === "video" && (
                                <video
                                  src={message.media_url}
                                  controls
                                  className="rounded-lg max-w-[250px] max-h-[300px]"
                                />
                              )}
                            </div>
                          )}
                          {message.content && (
                            <div className="text-[15px] leading-5 break-words">
                              {isEmojiMessage(message.content) ? (
                                <div className="emoji-message">
                                  {message.content
                                    .split("")
                                    .map((char, index) => {
                                      const emojiRegex =
                                        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
                                      if (emojiRegex.test(char)) {
                                        return (
                                          <AnimatedEmoji
                                            key={index}
                                            emoji={char}
                                            isVisible={newEmojiMessages.has(
                                              message.id
                                            )}
                                          />
                                        );
                                      }
                                      return char;
                                    })}
                                </div>
                              ) : (
                                <p>{message.content}</p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span
                              className={`text-[10px] ${
                                isOwn
                                  ? "text-primary-foreground/60"
                                  : "text-muted-foreground/60"
                              }`}
                            >
                              {format(new Date(message.created_at), "p")}
                            </span>
                            {isOwn && (
                              <>
                                {message.isSending ? (
                                  <span className="text-primary-foreground/60">
                                    <svg
                                      className="w-3 h-3"
                                      viewBox="0 0 12 12"
                                      fill="currentColor"
                                    >
                                      <circle cx="2" cy="6" r="1">
                                        <animate
                                          attributeName="opacity"
                                          values="0.3;1;0.3"
                                          dur="1.4s"
                                          repeatCount="indefinite"
                                          begin="0s"
                                        />
                                      </circle>
                                      <circle cx="6" cy="6" r="1">
                                        <animate
                                          attributeName="opacity"
                                          values="0.3;1;0.3"
                                          dur="1.4s"
                                          repeatCount="indefinite"
                                          begin="0.2s"
                                        />
                                      </circle>
                                      <circle cx="10" cy="6" r="1">
                                        <animate
                                          attributeName="opacity"
                                          values="0.3;1;0.3"
                                          dur="1.4s"
                                          repeatCount="indefinite"
                                          begin="0.4s"
                                        />
                                      </circle>
                                    </svg>
                                  </span>
                                ) : (
                                  <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start the conversation!
              </p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div
          className="mobile-keyboard-gap p-2 border-t bg-background/95 backdrop-blur-sm relative"
          style={{
            marginBottom: isKeyboardOpen ? `${reducedGap}px` : "0px",
          }}
        >
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9 shrink-0"
                  disabled={isUploading}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => handleMediaSelect("image")}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMediaSelect("video")}>
                  <Video className="w-4 h-4 mr-2" />
                  Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMediaSelect("gif")}>
                  <Smile className="w-4 h-4 mr-2" />
                  GIF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMediaSelect("sticker")}>
                  <Smile className="w-4 h-4 mr-2" />
                  Sticker
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              ref={inputRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={handleInputFocus}
              placeholder="Message..."
              className="flex-1 rounded-full border-muted bg-muted/50 focus:bg-background h-9 px-4"
              disabled={isUploading}
              data-mobile-keyboard="true"
              inputMode="text"
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
            />

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 shrink-0"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              data-emoji-button="true"
            >
              <Smile className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => handleSendMessage()}
              disabled={(!messageText.trim() && !isUploading) || isPending}
              size="icon"
              className="rounded-full h-9 w-9 shrink-0 hover:bg-[#26A69A] transition-colors"
              data-send-button="true"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div data-emoji-picker="true">
            <EmojiPicker
              isOpen={showEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        </div>
      </Layout>
    </>
  );
};

export default MessagesPage;
