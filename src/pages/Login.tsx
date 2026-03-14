import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

export default function Login() {
  const { user, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        setErrorModal('Failed to sign in. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
      <div className="mb-8 flex flex-col items-center">
        <ShieldAlert className="mb-4 h-20 w-20 text-purple-500" />
        <h1 className="text-4xl font-bold tracking-tight">Aegis</h1>
        <p className="mt-2 text-center text-purple-200">
          Personal Safety Navigation System
        </p>
      </div>
      
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="flex w-full max-w-sm items-center justify-center rounded-xl bg-white px-4 py-3 text-lg font-semibold text-black shadow-md transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google"
          className="mr-3 h-6 w-6"
        />
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </button>

      {errorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-purple-950 p-6 shadow-2xl text-white border border-purple-900/50">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-xl font-bold">Sign In Error</h3>
              </div>
              <button 
                onClick={() => setErrorModal(null)} 
                className="rounded-full bg-purple-900 p-2 text-purple-200 transition-colors hover:bg-purple-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="whitespace-pre-line text-purple-100">{errorModal}</p>
            <button
              onClick={() => setErrorModal(null)}
              className="mt-6 w-full rounded-xl bg-purple-700 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
