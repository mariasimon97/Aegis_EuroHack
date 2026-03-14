import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { AlertOctagon, X, Send, MapPin } from 'lucide-react';

export default function SOSButton() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location } = useLocation();
  const { isDarkMode } = useTheme();
  const [isTriggering, setIsTriggering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [contactsNotified, setContactsNotified] = useState<{ name: string; phone: string }[]>([]);
  const [customMessage, setCustomMessage] = useState('');

  const handleInitialClick = async () => {
    if (!user || isTriggering) return;
    
    // Fetch emergency contacts first to show in confirmation
    const userRef = doc(db, 'users', user.uid);
    let contacts: { name: string; phone: string }[] = [];
    try {
      const userSnap = await getDoc(userRef);
      contacts = userSnap.exists() ? (userSnap.data().emergency_contacts || []) : [];
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
    
    setContactsNotified(contacts);
    
    const mapsLink = location 
      ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
      : 'Location unavailable';
    
    const contactList = contacts.length > 0 
      ? contacts.map((c: any) => `${c.name} (${c.phone})`).join(', ')
      : 'No emergency contacts configured';

    const defaultMsg = `Emergency Alert!\nI may be in danger.\nLocation: ${mapsLink}\nTimestamp: ${new Date().toLocaleString()}\n\nContacts to notify: ${contactList}`;
    
    setCustomMessage(defaultMsg);
    setIsConfirming(true);
    
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  const triggerSOS = async () => {
    if (!user || isTriggering) return;
    
    setIsTriggering(true);
    setIsConfirming(false);
    
    try {
      // Create an emergency alert in Firestore
      const path = 'emergency_alerts';
      try {
        await addDoc(collection(db, path), {
          user_id: user.uid,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          timestamp: new Date().toISOString(),
          status: 'active',
          contacts_notified: contactsNotified,
          message: customMessage
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }

      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }

      // Attempt to share via Web Share API
      let shared = false;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Emergency Alert - Aegis',
            text: customMessage,
            url: location ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : undefined,
          });
          shared = true;
        } catch (shareError) {
          console.warn('Web Share API failed or was cancelled:', shareError);
        }
      } 
      
      if (!shared) {
        setModalMessage(customMessage);
      } else {
        // If shared successfully, we can still show a success state or just reset
        setModalMessage("SOS Broadcast Sent Successfully.");
      }
      
    } catch (error) {
      console.error('Failed to trigger SOS:', error);
      setModalMessage('Failed to trigger SOS. Please call emergency services directly.');
    } finally {
      setIsTriggering(false);
      navigate('/');
    }
  };

  return (
    <>
      <button
        onClick={handleInitialClick}
        disabled={isTriggering || isConfirming}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/30 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        aria-label="Trigger SOS"
      >
        <AlertOctagon className="h-8 w-8" />
      </button>

      {isConfirming && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className={`w-full max-w-md rounded-3xl p-8 shadow-2xl transition-colors ${isDarkMode ? 'bg-slate-900 border border-red-900/50' : 'bg-white'}`}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <AlertOctagon className="h-8 w-8 animate-pulse" />
                <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Confirm SOS</h3>
              </div>
              <button 
                onClick={() => setIsConfirming(false)} 
                className={`rounded-full p-2 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className={`mb-6 rounded-2xl p-4 ${isDarkMode ? 'bg-red-950/30 border border-red-900/30' : 'bg-red-50'}`}>
              <p className={`text-sm font-bold uppercase mb-2 ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>Emergency Broadcast Details</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className={`h-4 w-4 mt-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Current Location</p>
                    <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Detecting...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Send className={`h-4 w-4 mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Notifying Contacts</p>
                    <p className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {contactsNotified.length > 0 ? contactsNotified.map(c => c.name).join(', ') : 'No contacts set'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <label className={`block text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SOS Message</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                className={`w-full rounded-2xl border-0 p-4 text-sm shadow-inner ring-1 ring-inset transition-all focus:ring-2 focus:ring-inset ${
                  isDarkMode 
                    ? 'bg-slate-950 text-white ring-slate-800 focus:ring-red-500' 
                    : 'bg-slate-50 text-slate-900 ring-slate-200 focus:ring-red-600'
                }`}
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={triggerSOS}
                className="w-full rounded-2xl bg-red-600 py-4 text-xl font-black text-white shadow-xl shadow-red-600/40 transition-all hover:bg-red-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                SEND SOS NOW
              </button>
              <button
                onClick={() => setIsConfirming(false)}
                className={`w-full rounded-2xl py-4 text-lg font-bold transition-all hover:bg-opacity-80 ${
                  isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black p-4 backdrop-blur-xl">
          <div className="w-full max-w-md animate-in fade-in zoom-in rounded-3xl border border-purple-900/50 bg-black p-8 shadow-[0_0_50px_rgba(168,85,247,0.2)] duration-500">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-purple-900/20 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <AlertOctagon className="h-12 w-12 animate-pulse text-purple-500" />
              </div>
              <h3 className="mb-2 text-3xl font-black uppercase tracking-tighter text-white">SOS Broadcasted</h3>
              <p className="text-purple-300/70">Emergency signals have been deployed.</p>
            </div>
            
            <div className="mb-8 space-y-4">
              <div className="rounded-2xl border border-purple-900/30 bg-purple-950/20 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400">
                  <Send className="h-3 w-3" />
                  Recipients Notified
                </div>
                <div className="flex flex-wrap gap-2">
                  {contactsNotified.length > 0 ? (
                    contactsNotified.map((c, i) => (
                      <span key={i} className="rounded-full bg-purple-900/40 px-3 py-1 text-xs font-medium text-purple-200 border border-purple-800/50">
                        {c.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-purple-500">No contacts configured</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-purple-900/30 bg-purple-950/20 p-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-purple-400">Message Content</div>
                <p className="font-mono text-[10px] leading-relaxed text-purple-300/60 line-clamp-3">
                  {modalMessage}
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalMessage(null)}
              className="group relative w-full overflow-hidden rounded-2xl bg-purple-600 py-4 font-black uppercase tracking-widest text-white transition-all hover:bg-purple-500 active:scale-95"
            >
              <span className="relative z-10">I am Safe Now</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
            
            <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-widest text-purple-500/50">
              Aegis Sentinel Protection Active
            </p>
          </div>
        </div>
      )}
    </>
  );
}
