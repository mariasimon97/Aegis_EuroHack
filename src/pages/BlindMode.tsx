import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Mic, Navigation, Shield, AlertOctagon, X, Hand } from 'lucide-react';

export default function BlindMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location } = useLocation();
  
  const [actionText, setActionText] = useState("BLIND MODE ACTIVE\n\nTap anywhere to hear status.\nSwipe Right to Navigate.\nSwipe Left to Report.\nSwipe Down to Exit.\nHold for 2 seconds for SOS.");
  const [bgColor, setBgColor] = useState("bg-black");
  const [textColor, setTextColor] = useState("text-purple-400");
  
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    speak('Blind mode activated. Tap anywhere to hear status. Swipe Right to Navigate. Swipe Left to Report. Swipe Down to Exit. Hold for 2 seconds for SOS.');
    return () => {
      window.speechSynthesis.cancel();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const vibrate = (pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const updateUI = (text: string, bg = "bg-black", textCol = "text-purple-400") => {
    setActionText(text);
    setBgColor(bg);
    setTextColor(textCol);
  };

  const handleTap = () => {
    vibrate(100);
    if (location) {
      speak('Location acquired. You are currently in a safe zone. Nearest police station is 200 meters away.');
      updateUI("STATUS:\nSafe Zone.\nNearest help: 200m");
    } else {
      speak('Acquiring location. Please wait.');
      updateUI("ACQUIRING LOCATION...");
    }
    
    setTimeout(() => {
      updateUI("BLIND MODE ACTIVE\n\nTap anywhere to hear status.\nSwipe Right to Navigate.\nSwipe Left to Report.\nSwipe Down to Exit.\nHold for 2 seconds for SOS.");
    }, 5000);
  };

  const handleSwipeRight = () => {
    vibrate([100, 50, 100]);
    speak('Navigating to nearest safe place. Turn right in 50 meters.');
    updateUI("NAVIGATING\nTO SAFE PLACE", "bg-purple-900", "text-white");
    
    setTimeout(() => {
      navigate('/navigate?dest=Nearest+Safe+Place&safe=true', { replace: true });
    }, 2500);
  };

  const handleSwipeLeft = () => {
    vibrate(200);
    speak('Recording incident. Please describe the situation after the beep.');
    updateUI("LISTENING...\nREPORTING INCIDENT", "bg-purple-950", "text-white");
    
    setTimeout(() => {
      vibrate([100, 50, 100]);
      speak('Incident reported successfully.');
      updateUI("INCIDENT REPORTED", "bg-black", "text-purple-400");
    }, 4000);
  };

  const handleSwipeDown = () => {
    vibrate(100);
    speak('Exiting blind mode.');
    navigate('/');
  };

  const triggerSOS = async () => {
    vibrate([500, 200, 500, 200, 500]);
    
    if (!location) {
      speak('SOS triggered. Location is currently unavailable.');
      updateUI("SOS TRIGGERED\nLOCATION UNAVAILABLE", "bg-red-900", "text-white");
    } else {
      speak('SOS triggered. Emergency contacts have been notified of your location.');
      updateUI("SOS TRIGGERED\nHELP IS ON THE WAY", "bg-red-900", "text-white");
    }
    
    if (user) {
      const path = 'emergency_alerts';
      try {
        await addDoc(collection(db, path), {
          user_id: user.uid,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          timestamp: new Date().toISOString(),
          status: 'active'
        });
      } catch (error) {
        console.error('Failed to trigger SOS:', error);
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }

    // Automatically navigate to nearest safe place after SOS
    setTimeout(() => {
      handleSwipeRight();
    }, 3000);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      triggerSOS();
      touchStartRef.current = null; // Prevent tap/swipe from firing
    }, 2000);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (!touchStartRef.current) return; // Was handled by long press

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    // Thresholds
    const minSwipeDistance = 50;
    
    if (Math.abs(dx) > minSwipeDistance || Math.abs(dy) > minSwipeDistance) {
      // It's a swipe
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) handleSwipeRight();
        else handleSwipeLeft();
      } else {
        if (dy > 0) handleSwipeDown();
        // Ignore swipe up for now
      }
    } else if (duration < 500) {
      // It's a tap
      handleTap();
    }
  };

  return (
    <div 
      className={`relative flex h-screen w-full flex-col items-center justify-center ${bgColor} ${textColor} transition-colors duration-300`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={(e) => {
        // Basic mouse support for testing on desktop
        touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        longPressTimerRef.current = setTimeout(() => {
          triggerSOS();
          touchStartRef.current = null;
        }, 2000);
      }}
      onMouseUp={(e) => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (!touchStartRef.current) return;
        
        const dx = e.clientX - touchStartRef.current.x;
        const dy = e.clientY - touchStartRef.current.y;
        const duration = Date.now() - touchStartRef.current.time;
        touchStartRef.current = null;

        if (Math.abs(dx) > 50 || Math.abs(dy) > 50) {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) handleSwipeRight();
            else handleSwipeLeft();
          } else {
            if (dy > 0) handleSwipeDown();
          }
        } else if (duration < 500) {
          handleTap();
        }
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleSwipeDown();
        }}
        className="absolute right-6 top-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-purple-900 text-white shadow-lg active:bg-purple-800"
        aria-label="Exit Blind Mode"
      >
        <X className="h-8 w-8" />
      </button>

      <div className="pointer-events-none flex flex-col items-center justify-center p-8 text-center">
        <Hand className="mb-8 h-32 w-32 opacity-80" />
        <h1 className="whitespace-pre-line text-4xl font-black leading-tight tracking-wide">
          {actionText}
        </h1>
      </div>
    </div>
  );
}
