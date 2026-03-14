import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { Shield, MapPin, EyeOff, AlertTriangle, ShieldCheck, Navigation2, LogOut, Phone, Plus, Trash2, User as UserIcon, Moon, Sun } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Distinct User Location Icon (Blue Pulsing Dot)
const currentUserIcon = L.divIcon({
  html: `
    <div class="user-location-marker">
      <div class="pulse"></div>
      <div class="dot"></div>
    </div>
  `,
  className: 'user-location-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to recenter map when location changes
function MapUpdater({ center, zoom }: { center: [number, number], zoom?: number }) {
  const map = useMap();
  const [hasCentered, setHasCentered] = useState(false);

  useEffect(() => {
    if (!hasCentered && center[0] !== 0) {
      if (zoom) {
        map.setView(center, zoom);
      } else {
        map.setView(center, map.getZoom());
      }
      setHasCentered(true);
    }
  }, [center, zoom, map, hasCentered]);
  return null;
}

export default function Home() {
  const { user, logout } = useAuth();
  const { location } = useLocation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [safestRoute, setSafestRoute] = useState(true);
  const [guardianMode, setGuardianMode] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<{ name: string; phone: string }[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [showContactForm, setShowContactForm] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => console.error("Error getting location:", error),
      { enableHighAccuracy: true }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => console.error("Error watching location:", error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid))
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setGuardianMode(data.guardian_mode || false);
            setEmergencyContacts(data.emergency_contacts || []);
          }
        })
        .catch((error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
    }
  }, [user]);

  const toggleGuardianMode = async () => {
    if (!user) return;
    const newMode = !guardianMode;
    setGuardianMode(newMode);
    try {
      await updateDoc(doc(db, 'users', user.uid), { guardian_mode: newMode });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
    
    if (newMode && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const handleAddContact = async () => {
    if (!user || !newContact.name || !newContact.phone) return;
    const updatedContacts = [...emergencyContacts, newContact];
    setEmergencyContacts(updatedContacts);
    try {
      await updateDoc(doc(db, 'users', user.uid), { emergency_contacts: updatedContacts });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
    setNewContact({ name: '', phone: '' });
    setShowContactForm(false);
  };

  const handleRemoveContact = async (index: number) => {
    if (!user) return;
    const updatedContacts = emergencyContacts.filter((_, i) => i !== index);
    setEmergencyContacts(updatedContacts);
    try {
      await updateDoc(doc(db, 'users', user.uid), { emergency_contacts: updatedContacts });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleNavigate = () => {
    if (!destination) return;
    navigate(`/navigate?dest=${encodeURIComponent(destination)}&safe=${safestRoute}`);
  };

  return (
    <div className={`flex min-h-screen flex-col pb-24 transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-blue-50/30 text-slate-900'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 text-white shadow-md transition-colors ${isDarkMode ? 'bg-black border-b border-purple-900/50' : 'bg-blue-950'}`}>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-purple-500" />
          <h1 className="text-xl font-bold tracking-tight">Aegis</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleDarkMode} className={`${isDarkMode ? 'text-purple-200 hover:text-white' : 'text-blue-200 hover:text-white'} transition-colors`}>
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={logout} className={`${isDarkMode ? 'text-purple-200 hover:text-white' : 'text-blue-200 hover:text-white'} transition-colors`}>
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* Map Section */}
        <div className={`mb-8 h-64 w-full overflow-hidden rounded-2xl shadow-sm ring-1 relative z-0 ${isDarkMode ? 'ring-purple-900/50 bg-purple-950/20' : 'ring-blue-100 bg-white'}`}>
          {userLocation.lat && userLocation.lng ? (
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={15}
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url={isDarkMode 
                  ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                }
              />
              <MapUpdater center={[userLocation.lat, userLocation.lng]} />
              <Marker position={[userLocation.lat, userLocation.lng]} icon={currentUserIcon}>
                <Popup>
                  <div className="font-sans font-bold text-blue-600">You are here</div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <p className={`text-sm ${isDarkMode ? 'text-purple-400/60' : 'text-slate-500'}`}>Locating...</p>
            </div>
          )}
        </div>

        {/* Search Section */}
        <div className={`mb-8 rounded-2xl p-5 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isDarkMode ? 'bg-purple-950/20 ring-purple-900/50' : 'bg-white ring-blue-100'}`}>
          <div className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${isDarkMode ? 'bg-black/50 border border-purple-900/30' : 'bg-blue-50/50'}`}>
            <MapPin className="h-5 w-5 text-purple-400" />
            <input
              type="text"
              placeholder="Where to?"
              className={`flex-1 bg-transparent text-lg outline-none placeholder:text-purple-300/50 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="mb-6 flex items-center justify-between px-1">
            <span className={`text-sm font-medium ${isDarkMode ? 'text-purple-200' : 'text-blue-900'}`}>Prioritize Safest Route</span>
            <button
              onClick={() => setSafestRoute(!safestRoute)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                safestRoute ? 'bg-purple-600' : isDarkMode ? 'bg-purple-900/50' : 'bg-blue-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  safestRoute ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleNavigate}
            disabled={!destination}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-[0.98] disabled:opacity-50 ${isDarkMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-blue-950'}`}
          >
            <Navigation2 className="h-5 w-5" />
            Start Navigation
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={toggleGuardianMode}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-6 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${
              guardianMode
                ? isDarkMode ? 'bg-purple-900/40 text-purple-400 ring-purple-800' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : isDarkMode ? 'bg-purple-950/40 text-purple-100 ring-purple-900/50 hover:bg-purple-900/40' : 'bg-white text-blue-900 ring-blue-100 hover:bg-blue-50/50'
            }`}
          >
            <ShieldCheck className={`h-8 w-8 ${guardianMode ? 'text-purple-400' : 'text-purple-400'}`} />
            <span className="text-sm font-semibold">Guardian Mode</span>
          </button>

          <button
            onClick={() => navigate('/blind-mode')}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-6 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isDarkMode ? 'bg-purple-950/40 text-purple-100 ring-purple-900/50 hover:bg-purple-900/40' : 'bg-white text-blue-900 ring-blue-100 hover:bg-blue-50/50'}`}
          >
            <EyeOff className="h-8 w-8 text-purple-500" />
            <span className="text-sm font-semibold">Blind Mode</span>
          </button>

          <button
            onClick={() => navigate('/report')}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-6 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isDarkMode ? 'bg-purple-950/40 text-purple-100 ring-purple-900/50 hover:bg-purple-900/40' : 'bg-white text-blue-900 ring-blue-100 hover:bg-blue-50/50'}`}
          >
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <span className="text-sm font-semibold">Report Incident</span>
          </button>

          <button
            onClick={() => navigate('/navigate?checkpoints=true')}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl p-6 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isDarkMode ? 'bg-purple-950/40 text-purple-100 ring-purple-900/50 hover:bg-purple-900/40' : 'bg-white text-blue-900 ring-blue-100 hover:bg-blue-50/50'}`}
          >
            <MapPin className="h-8 w-8 text-purple-500" />
            <span className="text-sm font-semibold text-center leading-tight">Safety Checkpoints</span>
          </button>
        </div>

        {/* Emergency Contacts Section */}
        <div className={`rounded-2xl p-5 shadow-sm ring-1 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] ${isDarkMode ? 'bg-purple-950/20 ring-purple-900/50' : 'bg-white ring-blue-100'}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className={`flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-blue-950'}`}>
              <Phone className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold">Emergency Contacts</h2>
            </div>
            <button
              onClick={() => setShowContactForm(!showContactForm)}
              className={`rounded-full p-2 transition-colors ${isDarkMode ? 'bg-purple-900 text-purple-200 hover:bg-purple-800' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {showContactForm && (
            <div className={`mb-4 space-y-3 rounded-xl p-4 ring-1 transition-colors ${isDarkMode ? 'bg-black/50 ring-purple-900/50' : 'bg-blue-50/30 ring-blue-100'}`}>
              <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 transition-colors ${isDarkMode ? 'bg-purple-950 ring-purple-800' : 'bg-white ring-blue-100'}`}>
                <UserIcon className="h-4 w-4 text-purple-400" />
                <input
                  type="text"
                  placeholder="Contact Name"
                  className={`flex-1 bg-transparent text-sm outline-none ${isDarkMode ? 'text-white placeholder:text-purple-500/50' : 'text-slate-900'}`}
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 transition-colors ${isDarkMode ? 'bg-purple-950 ring-purple-800' : 'bg-white ring-blue-100'}`}>
                <Phone className="h-4 w-4 text-purple-400" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className={`flex-1 bg-transparent text-sm outline-none ${isDarkMode ? 'text-white placeholder:text-purple-500/50' : 'text-slate-900'}`}
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddContact}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors ${isDarkMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-blue-950 hover:bg-blue-900'}`}
                >
                  Add Contact
                </button>
                <button
                  onClick={() => setShowContactForm(false)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isDarkMode ? 'bg-purple-900 text-purple-200 hover:bg-purple-800' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {emergencyContacts.length === 0 ? (
              <p className={`py-4 text-center text-sm italic ${isDarkMode ? 'text-purple-400/60' : 'text-blue-400'}`}>No emergency contacts added yet.</p>
            ) : (
              emergencyContacts.map((contact, index) => (
                <div key={index} className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition-all hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] ${isDarkMode ? 'bg-purple-950/40 ring-purple-900/30' : 'bg-blue-50/20 ring-blue-50'}`}>
                  <div>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-blue-950'}`}>{contact.name}</p>
                    <p className={`text-sm ${isDarkMode ? 'text-purple-400' : 'text-blue-500'}`}>{contact.phone}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveContact(index)}
                    className={`rounded-full p-2 transition-colors ${isDarkMode ? 'text-purple-500 hover:bg-red-900/40 hover:text-red-400' : 'text-blue-300 hover:bg-red-50 hover:text-red-500'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
