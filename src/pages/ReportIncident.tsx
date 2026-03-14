import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle2, X } from 'lucide-react';

const INCIDENT_TYPES = [
  'harassment',
  'suspicious activity',
  'theft',
  'poor lighting',
  'isolated area',
  'other'
];

export default function ReportIncident() {
  const { user } = useAuth();
  const { location } = useLocation();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState<{title: string, message: string, success: boolean} | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !location || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'incident_reports'), {
        reporter_id: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        type,
        timestamp: new Date().toISOString(),
        description
      });
      
      setModalMessage({
        title: 'Report Submitted',
        message: 'Incident reported successfully. Thank you for keeping the community safe.',
        success: true
      });
    } catch (error) {
      console.error('Error reporting incident:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'incident_reports');
      } catch (e) {
        setModalMessage({
          title: 'Submission Failed',
          message: 'Failed to report incident. Please try again.',
          success: false
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    const wasSuccess = modalMessage?.success;
    setModalMessage(null);
    if (wasSuccess) {
      navigate('/');
    }
  };

  return (
    <div className={`flex min-h-screen flex-col transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-blue-50/10 text-slate-900'}`}>
      <header className={`flex items-center gap-4 px-4 py-4 shadow-sm transition-colors ${isDarkMode ? 'bg-black border-b border-purple-900/50' : 'bg-white'}`}>
        <button onClick={() => navigate('/')} className={`rounded-full p-2 transition-colors ${isDarkMode ? 'hover:bg-purple-900' : 'hover:bg-blue-50'}`}>
          <ArrowLeft className={`h-6 w-6 ${isDarkMode ? 'text-purple-100' : 'text-blue-900'}`} />
        </button>
        <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-blue-950'}`}>Report Incident</h1>
      </header>

      <main className="flex-1 p-4">
        <div className={`mb-6 rounded-xl p-4 ring-1 transition-colors ${isDarkMode ? 'bg-purple-900/40 text-purple-400 ring-purple-800' : 'bg-emerald-50 text-emerald-800 ring-emerald-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">
              Your report will be shared anonymously with nearby users to help them navigate safely.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`mb-2 block text-sm font-medium ${isDarkMode ? 'text-purple-200' : 'text-blue-900'}`}>Location</label>
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 transition-colors ${isDarkMode ? 'bg-purple-950 text-purple-200 border border-purple-900/30' : 'bg-blue-100 text-blue-700'}`}>
              <MapPin className="h-5 w-5" />
              <span>
                {location 
                  ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : 'Acquiring location...'}
              </span>
            </div>
          </div>

          <div>
            <label className={`mb-2 block text-sm font-medium ${isDarkMode ? 'text-purple-200' : 'text-blue-900'}`}>Incident Type</label>
            <div className="grid grid-cols-2 gap-3">
              {INCIDENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium capitalize transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] ${
                    type === t
                      ? isDarkMode ? 'bg-purple-700 text-white' : 'bg-blue-950 text-white'
                      : isDarkMode ? 'bg-purple-950 text-purple-200 ring-1 ring-purple-900 hover:bg-purple-900' : 'bg-white text-blue-700 ring-1 ring-blue-100 hover:bg-blue-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`mb-2 block text-sm font-medium ${isDarkMode ? 'text-purple-200' : 'text-blue-900'}`}>
              Description (Optional)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional details..."
              className={`w-full rounded-xl border-0 px-4 py-3 shadow-sm ring-1 ring-inset transition-colors outline-none focus:ring-2 focus:ring-inset ${isDarkMode ? 'bg-purple-950 text-white ring-purple-900 placeholder:text-purple-500 focus:ring-purple-500' : 'bg-white text-blue-950 ring-blue-100 placeholder:text-blue-300 focus:ring-blue-950'}`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !location}
            className={`w-full rounded-xl py-4 text-lg font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-[0.98] disabled:opacity-50 ${isDarkMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </main>

      {modalMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl transition-colors ${isDarkMode ? 'bg-purple-950 border border-purple-900/50' : 'bg-white'}`}>
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex items-center gap-2 ${modalMessage.success ? 'text-emerald-500' : 'text-red-500'}`}>
                {modalMessage.success ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-blue-950'}`}>{modalMessage.title}</h3>
              </div>
              <button 
                onClick={handleCloseModal} 
                className={`rounded-full p-2 transition-colors ${isDarkMode ? 'bg-purple-900 text-purple-200 hover:bg-purple-800' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className={`whitespace-pre-line ${isDarkMode ? 'text-purple-100' : 'text-blue-900'}`}>{modalMessage.message}</p>
            <button
              onClick={handleCloseModal}
              className={`mt-6 w-full rounded-xl py-3 font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${isDarkMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-blue-950 hover:bg-blue-900'}`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
