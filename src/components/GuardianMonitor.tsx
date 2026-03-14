import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { AlertOctagon, X } from 'lucide-react';

export default function GuardianMonitor() {
  const { user } = useAuth();
  const { location } = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}`;
    const unsub = onSnapshot(doc(db, 'users', user.uid), 
      (docSnap) => {
        if (docSnap.exists()) {
          setIsActive(docSnap.data().guardian_mode === true);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!isActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsPrompting(false);
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      if (isPrompting) return;

      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      // Calculate magnitude of acceleration vector
      const magnitude = Math.sqrt(
        (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2
      );

      // Normal gravity is ~9.8 m/s^2. 
      // A sudden stop or rapid shaking would cause a spike.
      // Threshold of 25 is arbitrary for prototype purposes.
      if (magnitude > 25) {
        triggerPrompt();
      }
    };

    // Request permission for iOS 13+ devices
    const requestPermission = async () => {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('devicemotion', handleMotion);
          }
        } catch (error) {
          console.error('Error requesting device motion permission:', error);
        }
      } else {
        window.addEventListener('devicemotion', handleMotion);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isActive, isPrompting]);

  const triggerPrompt = () => {
    setIsPrompting(true);
    if (navigator.vibrate) {
      navigator.vibrate([500, 500, 500]);
    }

    // Start 10 second countdown
    timeoutRef.current = setTimeout(() => {
      handleSOS();
    }, 10000);
  };

  const handleSafe = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPrompting(false);
  };

  const handleSOS = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPrompting(false);
    
    if (!user || !location) return;

    const path = 'emergency_alerts';
    try {
      await addDoc(collection(db, path), {
        user_id: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
        status: 'active'
      });
      
      if (navigator.vibrate) {
        navigator.vibrate([1000, 500, 1000, 500, 1000]);
      }
      setModalMessage('Guardian Mode: SOS Triggered due to lack of response.');
    } catch (error) {
      console.error('Failed to trigger SOS from Guardian Mode:', error);
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  return (
    <>
      {isPrompting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in fade-in zoom-in rounded-3xl bg-white p-8 text-center shadow-2xl duration-300">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <AlertOctagon className="h-12 w-12 animate-pulse text-red-600" />
            </div>
            
            <h2 className="mb-2 text-3xl font-black text-slate-900">Are you safe?</h2>
            <p className="mb-8 text-lg text-slate-600">
              Abnormal motion detected. SOS will trigger automatically in 10 seconds.
            </p>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleSafe}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-xl font-bold text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                I'm Safe
              </button>
              
              <button
                onClick={handleSOS}
                className="w-full rounded-2xl bg-red-600 py-4 text-xl font-bold text-white shadow-lg shadow-red-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Trigger SOS Now
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertOctagon className="h-6 w-6" />
                <h3 className="text-xl font-bold">Guardian Alert</h3>
              </div>
              <button 
                onClick={() => setModalMessage(null)} 
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="whitespace-pre-line text-slate-700">{modalMessage}</p>
            <button
              onClick={() => setModalMessage(null)}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
