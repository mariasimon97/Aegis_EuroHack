import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { 
  ArrowLeft, 
  Shield, 
  AlertTriangle, 
  Navigation as NavIcon, 
  ShieldCheck, 
  Info, 
  X, 
  Plus, 
  Cross, 
  Bus, 
  Train, 
  Pill, 
  Fuel, 
  GraduationCap, 
  Navigation2, 
  Zap,
  Volume2,
  MapPin
} from 'lucide-react';
import HeatmapLayer from '../components/HeatmapLayer';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons using Lucide
const createLucideIcon = (IconComponent: any, color: string) => {
  const iconMarkup = renderToStaticMarkup(
    <div style={{ color, backgroundColor: 'white', borderRadius: '50%', padding: '4px', border: `2px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
      <IconComponent size={20} />
    </div>
  );
  return L.divIcon({
    html: iconMarkup,
    className: 'custom-lucide-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const userIcon = createLucideIcon(MapPin, '#a855f7');
const incidentIcon = createLucideIcon(AlertTriangle, '#ef4444');
const destinationIcon = createLucideIcon(MapPin, '#ea580c');

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

const categoryIcons: Record<string, any> = {
  'police': createLucideIcon(Shield, '#1e40af'),
  'hospital': createLucideIcon(Plus, '#dc2626'),
  'transport': createLucideIcon(Bus, '#15803d'),
  'pharmacy': createLucideIcon(Pill, '#7c3aed'),
  'fuel': createLucideIcon(Fuel, '#ea580c'),
  'university': createLucideIcon(GraduationCap, '#0369a1'),
};


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
interface Checkpoint {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance: number;
  address: string;
}

export default function Navigation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [searchParams] = useSearchParams();
  const destination = searchParams.get('dest');
  const prioritizeSafe = searchParams.get('safe') === 'true';
  const showCheckpointsParam = searchParams.get('checkpoints') === 'true';
  const isBlindMode = searchParams.get('blind') === 'true';
  
  const { location } = useLocation();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [riskZones, setRiskZones] = useState<any[]>([]);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [guardianMode, setGuardianMode] = useState(false);
  const [locationHistory, setLocationHistory] = useState<[number, number][]>([]);
  const [showLegend, setShowLegend] = useState(false);
  
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [navigationInfo, setNavigationInfo] = useState<{ distance: string, time: string } | null>(null);
  const [isNavigatingToCheckpoint, setIsNavigatingToCheckpoint] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [routeSteps, setRouteSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lastFetchedLocation, setLastFetchedLocation] = useState<{lat: number, lng: number} | null>(null);
  const announcedNoLocationRef = useRef(false);
  const announcedLocationRef = useRef(false);

  // Speak function for Blind Mode
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Vibrate function
  const vibrate = useCallback((pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Fetch checkpoints using Overpass API
  const fetchCheckpoints = useCallback(async (lat: number, lng: number) => {
    try {
      const query = `[out:json][timeout:10];(node["amenity"="police"](around:3000,${lat},${lng});node["amenity"="hospital"](around:3000,${lat},${lng});node["amenity"="pharmacy"](around:3000,${lat},${lng}););out body;`;
      
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
      ];

      let response;
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`
          });
          if (response.ok) break;
        } catch (err) {
          console.warn(`Failed to fetch from ${endpoint}:`, err);
        }
      }

      if (!response || !response.ok) {
        throw new Error(`HTTP error! status: ${response ? response.status : 'Unknown'}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON. Response starts with:", text.substring(0, 100));
        throw new Error("Invalid JSON response from Overpass API");
      }
      
      if (data && data.elements && data.elements.length > 0) {
        const realCheckpoints: Checkpoint[] = data.elements.map((el: any) => {
          const category = el.tags.amenity === 'police' ? 'police' : 
                           el.tags.amenity === 'hospital' ? 'hospital' : 'pharmacy';
          return {
            id: el.id.toString(),
            name: el.tags.name || `Unknown ${category}`,
            category: category,
            lat: el.lat,
            lng: el.lon,
            distance: Math.round(calculateDistance(lat, lng, el.lat, el.lon)),
            address: el.tags['addr:street'] ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}` : 'Address unavailable'
          };
        }).filter((c: Checkpoint) => c.name !== `Unknown ${c.category}`);
        
        if (realCheckpoints.length > 0) {
          setCheckpoints(realCheckpoints.sort((a: Checkpoint, b: Checkpoint) => a.distance - b.distance));
          return;
        }
      }
      
      throw new Error("No checkpoints found");
    } catch (error) {
      console.error("Overpass API error:", error);
      // Fallback to mock data if API fails or returns no results
      const mockCheckpoints: Checkpoint[] = [
        { id: 'mock-1', name: 'Central Police Station', category: 'police', lat: lat + 0.01, lng: lng + 0.01, distance: 1200, address: '123 Main St' },
        { id: 'mock-2', name: 'City Hospital', category: 'hospital', lat: lat - 0.015, lng: lng + 0.005, distance: 1800, address: '456 Health Ave' },
        { id: 'mock-3', name: '24/7 Pharmacy', category: 'pharmacy', lat: lat + 0.005, lng: lng - 0.01, distance: 800, address: '789 Med Blvd' },
      ];
      setCheckpoints(mockCheckpoints.sort((a, b) => a.distance - b.distance));
    }
  }, []);

  useEffect(() => {
    if (location && (showCheckpointsParam || isBlindMode)) {
      const shouldFetch = !lastFetchedLocation || 
        calculateDistance(location.latitude, location.longitude, lastFetchedLocation.lat, lastFetchedLocation.lng) > 500;
        
      if (shouldFetch) {
        fetchCheckpoints(location.latitude, location.longitude);
        setLastFetchedLocation({ lat: location.latitude, lng: location.longitude });
      }
    }
  }, [location, showCheckpointsParam, isBlindMode, fetchCheckpoints, lastFetchedLocation]);

  useEffect(() => {
    if (isBlindMode && checkpoints.length > 0) {
      if (searchParams.get('quickEscape') === 'true' && !isNavigatingToCheckpoint) {
        // Inline Quick Escape logic
        const priority = ['police', 'hospital', 'transport', 'pharmacy', 'fuel', 'university'];
        let bestMatch = null;
        for (const cat of priority) {
          const match = checkpoints.find(c => c.category === cat);
          if (match) {
            bestMatch = match;
            break;
          }
        }
        if (!bestMatch) bestMatch = checkpoints[0];
        
        if (location) {
          vibrate([100, 50, 100]);
          setIsNavigatingToCheckpoint(true);
          setSelectedCheckpoint(bestMatch);
          fetchRoute(location.latitude, location.longitude, bestMatch.lat, bestMatch.lng);
          speak(`Starting navigation to ${bestMatch.name}. Follow the vibration cues.`);
        }
      } else if (!isNavigatingToCheckpoint) {
        const nearest = checkpoints[0];
        speak(`Safety Checkpoints active. The nearest safe place is ${nearest.name}, a ${nearest.category}, located ${nearest.distance} meters away.`);
      }
    }
  }, [isBlindMode, checkpoints, speak, searchParams, isNavigatingToCheckpoint, location, vibrate]);

  useEffect(() => {
    if (isBlindMode) {
      if (!location && !announcedNoLocationRef.current) {
        speak("Acquiring GPS signal. Please wait.");
        announcedNoLocationRef.current = true;
      } else if (location && !announcedLocationRef.current) {
        if (announcedNoLocationRef.current) {
          speak("GPS signal acquired.");
        }
        announcedLocationRef.current = true;
      }
    }
  }, [location, isBlindMode, speak]);

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}`;
      getDoc(doc(db, 'users', user.uid))
        .then((docSnap) => {
          if (docSnap.exists()) {
            setGuardianMode(docSnap.data().guardian_mode || false);
          }
        })
        .catch((error) => {
          handleFirestoreError(error, OperationType.GET, path);
        });
    }
  }, [user]);

  useEffect(() => {
    if (location) {
      setLocationHistory(prev => {
        // Only add if location changed significantly to avoid clutter
        const last = prev[prev.length - 1];
        if (!last || Math.abs(last[0] - location.latitude) > 0.0001 || Math.abs(last[1] - location.longitude) > 0.0001) {
          return [...prev, [location.latitude, location.longitude]];
        }
        return prev;
      });
    }
  }, [location]);

  useEffect(() => {
    // Listen to incidents
    const incidentsPath = 'incident_reports';
    const qIncidents = query(collection(db, incidentsPath));
    const unsubIncidents = onSnapshot(qIncidents, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIncidents(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, incidentsPath);
      }
    );

    // Listen to risk zones
    const zonesPath = 'risk_zones';
    const qZones = query(collection(db, zonesPath));
    const unsubZones = onSnapshot(qZones, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRiskZones(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, zonesPath);
      }
    );

    return () => {
      unsubIncidents();
      unsubZones();
    };
  }, []);

  useEffect(() => {
    // Generate mock risk zones if database is empty to demonstrate heatmap
    if (riskZones.length === 0 && location) {
      const mockZones = Array.from({ length: 20 }).map((_, i) => ({
        id: `mock-${i}`,
        latitude: location.latitude + (Math.random() - 0.5) * 0.03,
        longitude: location.longitude + (Math.random() - 0.5) * 0.03,
        risk_score: Math.random() * 100
      }));
      setRiskZones(mockZones);
    }
  }, [location, riskZones.length]);

  const fetchRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        setRoute(coords);
        const distKm = (data.routes[0].distance / 1000).toFixed(1);
        const timeMin = Math.round(data.routes[0].duration / 60);
        setNavigationInfo({
          distance: distKm + ' km',
          time: timeMin + ' min'
        });
        
        if (data.routes[0].legs && data.routes[0].legs[0].steps) {
          setRouteSteps(data.routes[0].legs[0].steps);
          setCurrentStepIndex(0);
        } else {
          setRouteSteps([]);
        }

        if (isBlindMode) {
          speak(`Route found. Distance is ${distKm} kilometers. Estimated time is ${timeMin} minutes. Follow the voice instructions.`);
        }
      }
    } catch (error) {
      console.error("Routing error:", error);
      if (isBlindMode) speak("Error calculating route.");
    }
  };

  const getInstruction = useCallback((step: any) => {
    const { maneuver, name, distance } = step;
    const modifier = maneuver.modifier ? maneuver.modifier.replace('-', ' ') : '';
    let instruction = "";
    if (maneuver.type === 'depart') {
      instruction = `Head ${modifier || 'straight'} on ${name || 'this road'}.`;
    } else if (maneuver.type === 'arrive') {
      instruction = `You have arrived at your destination.`;
    } else {
      instruction = `Turn ${modifier || ''} onto ${name || 'the next road'}.`;
    }
    
    if (distance && distance > 10) {
      instruction += ` Continue for ${Math.round(distance)} meters.`;
    }
    return instruction;
  }, []);

  useEffect(() => {
    if (isBlindMode && location && routeSteps.length > 0 && currentStepIndex < routeSteps.length) {
      const step = routeSteps[currentStepIndex];
      const maneuverLocation = step.maneuver.location; // [lon, lat]
      const distToManeuver = calculateDistance(location.latitude, location.longitude, maneuverLocation[1], maneuverLocation[0]);
      
      if (currentStepIndex === 0) {
        // Speak the first step immediately
        const instruction = getInstruction(step);
        speak(instruction);
        setCurrentStepIndex(1);
      } else if (distToManeuver < 25) {
        const instruction = getInstruction(step);
        speak(instruction);
        
        // Vibrate for major turns
        if (step.maneuver.type === 'turn') {
          vibrate([500, 200, 500]);
        } else if (step.maneuver.type === 'arrive') {
          vibrate([1000, 500, 1000]);
        } else {
          vibrate([200, 100, 200]);
        }
        
        setCurrentStepIndex(currentStepIndex + 1);
      }
    }
  }, [location, routeSteps, currentStepIndex, isBlindMode, speak, vibrate, getInstruction]);

  useEffect(() => {
    if (destination && !isNavigatingToCheckpoint) {
      setIsGeocoding(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setDestinationCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
          } else {
            if (isBlindMode) speak(`Could not find location for ${destination}.`);
          }
          setIsGeocoding(false);
        })
        .catch(err => {
          console.error("Geocoding error:", err);
          if (isBlindMode) speak(`Error searching for ${destination}.`);
          setIsGeocoding(false);
        });
    } else {
      setDestinationCoords(null);
    }
  }, [destination, isNavigatingToCheckpoint, isBlindMode, speak]);

  useEffect(() => {
    if (location && destinationCoords && !isNavigatingToCheckpoint) {
      fetchRoute(location.latitude, location.longitude, destinationCoords[0], destinationCoords[1]);
      const score = prioritizeSafe ? Math.floor(Math.random() * 30) : Math.floor(Math.random() * 100);
      setRiskScore(score);
      if (isBlindMode) {
        speak(`Starting navigation to your destination. Follow the vibration cues.`);
      }
    }
  }, [location, destinationCoords, prioritizeSafe, isNavigatingToCheckpoint, isBlindMode, speak]);

  const startNavigation = (checkpoint: Checkpoint) => {
    if (!location) return;
    vibrate([100, 50, 100]);
    setIsNavigatingToCheckpoint(true);
    setSelectedCheckpoint(checkpoint);
    
    fetchRoute(location.latitude, location.longitude, checkpoint.lat, checkpoint.lng);

    if (isBlindMode) {
      speak(`Starting navigation to ${checkpoint.name}. Follow the vibration cues.`);
    }
  };

  const handleQuickEscape = () => {
    if (checkpoints.length === 0) {
      if (isBlindMode) speak("No safety checkpoints found nearby.");
      return;
    }
    
    // Priority: Police -> Hospital -> Transport -> Pharmacy/Fuel
    const priority = ['police', 'hospital', 'transport', 'pharmacy', 'fuel', 'university'];
    
    let bestMatch = null;
    for (const cat of priority) {
      const match = checkpoints.find(c => c.category === cat);
      if (match) {
        bestMatch = match;
        break;
      }
    }

    if (!bestMatch) bestMatch = checkpoints[0];
    
    startNavigation(bestMatch);
    // startNavigation already speaks for blind mode, so we only speak here for sighted users if needed,
    // but we can just let startNavigation handle the voice feedback.
    if (!isBlindMode) {
      // Sighted users can see the UI, but we can keep this or remove it.
    }
  };

  const promptForDestination = useCallback(() => {
    if (isListening) return;
    
    speak("Where do you want to go?");
    setIsListening(true);
    
    setTimeout(() => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const spokenText = event.results[0][0].transcript;
          speak(`Searching for ${spokenText}`);
          navigate(`/navigate?blind=true&dest=${encodeURIComponent(spokenText)}`);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          speak("Sorry, I didn't catch that. Please swipe right to try again.");
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } else {
        speak("Voice recognition is not supported on this device.");
        setIsListening(false);
      }
    }, 2000);
  }, [speak, navigate, isListening]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      navigate('/navigate?checkpoints=true&blind=true');
      handleQuickEscape();
    } else if (isRightSwipe) {
      promptForDestination();
    }
  };

  if (!location) {
    return (
      <div className={`flex h-screen items-center justify-center transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-black text-white'}`}>
        <div className="flex flex-col items-center gap-4">
          <NavIcon className="h-8 w-8 animate-spin text-purple-500" />
          <p>Acquiring GPS signal...</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return isDarkMode ? 'text-emerald-400 bg-emerald-900/40 ring-emerald-800' : 'text-emerald-500 bg-emerald-50 ring-emerald-200';
    if (score <= 60) return isDarkMode ? 'text-amber-400 bg-amber-900/40 ring-amber-800' : 'text-amber-500 bg-amber-50 ring-amber-200';
    return isDarkMode ? 'text-red-400 bg-red-900/40 ring-red-800' : 'text-red-500 bg-red-50 ring-red-200';
  };

  // Prepare heatmap points: [lat, lng, intensity (0-1)]
  const heatmapPoints: [number, number, number][] = riskZones.map(zone => [
    zone.latitude,
    zone.longitude,
    (zone.risk_score || 50) / 100
  ]);

  return (
    <div className={`relative flex h-screen flex-col transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-blue-50/10 text-slate-900'}`}>
      {/* Top Overlay */}
      <div className="absolute left-0 right-0 top-0 z-[1000] flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ring-1 transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95 ${isDarkMode ? 'bg-black ring-purple-900/50' : 'bg-white ring-blue-100'}`}
          >
            <ArrowLeft className={`h-6 w-6 ${isDarkMode ? 'text-purple-100' : 'text-blue-900'}`} />
          </button>
          
          {(destination || isNavigatingToCheckpoint) && (
            <div className={`flex flex-1 items-center justify-between rounded-2xl px-4 py-3 shadow-md ring-1 transition-colors ${getRiskColor(riskScore)}`}>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {isNavigatingToCheckpoint ? 'Safety Navigation' : 'Route Risk'}
                </span>
                <span className="font-semibold truncate max-w-[150px]">
                  To: {isNavigatingToCheckpoint ? selectedCheckpoint?.name : (isGeocoding ? 'Searching...' : destination)}
                </span>
              </div>
              {navigationInfo && (
                <div className="flex flex-col items-end">
                  <span className="text-lg font-black leading-none">{navigationInfo.time}</span>
                  <span className="text-[10px] font-bold uppercase opacity-80">{navigationInfo.distance}</span>
                </div>
              )}
            </div>
          )}

          {!destination && !isNavigatingToCheckpoint && (
            <div className={`flex flex-1 items-center justify-between rounded-2xl px-4 py-3 shadow-md ring-1 transition-colors ${isDarkMode ? 'bg-purple-900/40 text-purple-400 ring-purple-800' : 'bg-white text-blue-950 ring-blue-100'}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold">Safety Checkpoints</span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Blind Mode UI Overlay */}
      {isBlindMode && (
        <div 
          className="absolute inset-0 z-[5000] flex flex-col items-center justify-center bg-black/95 p-8 text-center touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Volume2 className={`mb-8 h-24 w-24 text-purple-500 ${isListening ? 'animate-bounce' : 'animate-pulse'}`} />
          <h1 className="mb-8 text-3xl font-black text-white tracking-tighter">BLIND MODE ACTIVE</h1>

          {isListening && (
            <p className="mt-8 text-2xl font-bold text-purple-400 animate-pulse">Listening...</p>
          )}

          <button
            onClick={() => navigate('/')}
            className="mt-16 text-purple-400 font-bold underline text-lg"
          >
            Exit Blind Mode
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1">
        <MapContainer
          center={[location.latitude, location.longitude]}
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
          <MapUpdater center={[location.latitude, location.longitude]} />

          {/* Heatmap Layer */}
          {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

          {/* User Location */}
          <Marker position={[location.latitude, location.longitude]} icon={currentUserIcon}>
            <Popup>
              <div className="font-sans font-bold text-blue-600">You are here</div>
            </Popup>
          </Marker>

          {/* Destination Marker */}
          {destinationCoords && !isNavigatingToCheckpoint && (
            <Marker position={destinationCoords} icon={destinationIcon}>
              <Popup>
                <div className="font-sans font-bold text-orange-600">{destination}</div>
              </Popup>
            </Marker>
          )}

          {/* Route */}
          {route.length > 0 && (
            <Polyline
              positions={route}
              color={isNavigatingToCheckpoint ? '#a855f7' : riskScore <= 30 ? '#a855f7' : riskScore <= 60 ? '#f59e0b' : '#ef4444'}
              weight={6}
              opacity={0.8}
            />
          )}

          {/* Incidents */}
          {incidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[incident.latitude, incident.longitude]}
              icon={incidentIcon}
            >
              <Popup>
                <div className="font-sans">
                  <p className="font-bold capitalize text-red-600">{incident.type}</p>
                  <p className="text-sm text-slate-600">{incident.description || 'No description provided.'}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Safety Checkpoints */}
          {checkpoints.map((checkpoint) => (
            <Marker
              key={checkpoint.id}
              position={[checkpoint.lat, checkpoint.lng]}
              icon={categoryIcons[checkpoint.category] || categoryIcons['police']}
              eventHandlers={{
                click: () => setSelectedCheckpoint(checkpoint),
              }}
            >
              <Popup>
                <div className="font-sans">
                  <p className="font-bold text-purple-600">{checkpoint.name}</p>
                  <p className="text-xs uppercase font-bold text-slate-400">{checkpoint.category}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Selected Checkpoint Card */}
      {selectedCheckpoint && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000] animate-in fade-in slide-in-from-bottom-4">
          <div className={`rounded-2xl p-5 shadow-2xl ring-1 transition-colors ${isDarkMode ? 'bg-purple-950 ring-purple-800' : 'bg-white ring-blue-100'}`}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-purple-900 text-purple-300' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedCheckpoint.category}
                  </span>
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-purple-400' : 'text-blue-500'}`}>
                    {selectedCheckpoint.distance}m away
                  </span>
                </div>
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-blue-950'}`}>
                  {selectedCheckpoint.name}
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-purple-300/70' : 'text-slate-500'}`}>
                  {selectedCheckpoint.address}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCheckpoint(null)}
                className={`rounded-full p-1 transition-colors ${isDarkMode ? 'hover:bg-purple-900' : 'hover:bg-blue-50'}`}
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            
            <button
              onClick={() => startNavigation(selectedCheckpoint)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-lg transition-all active:scale-95 ${isDarkMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-950 hover:bg-blue-900'}`}
            >
              <Navigation2 className="h-5 w-5" />
              Navigate
            </button>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="absolute bottom-6 left-4 right-4 z-[1000] flex flex-col gap-3">
        {showCheckpointsParam && !isNavigatingToCheckpoint && (
          <button
            onClick={handleQuickEscape}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 font-bold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-red-600 hover:bg-red-500 shadow-red-600/20`}
          >
            <Zap className="h-5 w-5" />
            Quick Escape
          </button>
        )}

        {(destination || isNavigatingToCheckpoint) && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsNavigatingToCheckpoint(false);
                setRoute([]);
                setRouteSteps([]);
                setNavigationInfo(null);
                setSelectedCheckpoint(null);
                navigate('/navigate?checkpoints=true');
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 font-bold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
            >
              <ShieldCheck className="h-5 w-5" />
              Nearest Safe Place
            </button>
            <button
              onClick={() => {
                setIsNavigatingToCheckpoint(false);
                setRoute([]);
                setRouteSteps([]);
                setNavigationInfo(null);
                setSelectedCheckpoint(null);
                navigate('/');
              }}
              className="flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-bold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-slate-600 hover:bg-slate-500 shadow-slate-600/20"
            >
              <X className="h-5 w-5" />
              End
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
