import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface NotificationOptions {
  enabled?: boolean;
  soundEnabled?: boolean;
  toastEnabled?: boolean;
}

// Generate a simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the notification sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure sound - pleasant notification tone
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.type = "sine";
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Second tone for a pleasant "ding-dong" effect
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.setValueAtTime(1108.73, audioContext.currentTime); // C#6 note
      osc2.type = "sine";
      
      gain2.gain.setValueAtTime(0, audioContext.currentTime);
      gain2.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
      gain2.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.25);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.25);
    }, 150);
    
  } catch (error) {
    console.log("Could not play notification sound:", error);
  }
};

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

// Show browser notification
const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
    tag: "whatsapp-message",
  });
  
  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

export function useMessageNotifications(options: NotificationOptions = {}) {
  const { 
    enabled = true, 
    soundEnabled = true, 
    toastEnabled = true 
  } = options;
  
  const hasRequestedPermission = useRef(false);
  
  // Request permission on mount
  useEffect(() => {
    if (enabled && !hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestNotificationPermission();
    }
  }, [enabled]);
  
  const notify = useCallback((
    senderName: string | null,
    messagePreview: string,
    onNotificationClick?: () => void
  ) => {
    if (!enabled) return;
    
    const displayName = senderName || "Nouveau message";
    const truncatedMessage = messagePreview.length > 50 
      ? messagePreview.substring(0, 50) + "..." 
      : messagePreview;
    
    // Play sound
    if (soundEnabled) {
      playNotificationSound();
    }
    
    // Show toast notification
    if (toastEnabled) {
      toast.message(displayName, {
        description: truncatedMessage,
        duration: 5000,
        action: onNotificationClick ? {
          label: "Voir",
          onClick: onNotificationClick,
        } : undefined,
      });
    }
    
    // Show browser notification if tab is not focused
    if (document.hidden) {
      showBrowserNotification(
        displayName,
        truncatedMessage,
        onNotificationClick
      );
    }
  }, [enabled, soundEnabled, toastEnabled]);
  
  return { notify, playNotificationSound };
}
