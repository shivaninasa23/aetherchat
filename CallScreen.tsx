import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, 
  Volume2, VolumeX, Maximize2, Minimize2, Sparkles, AlertCircle 
} from 'lucide-react';
import { CallState } from '../types';

interface CallScreenProps {
  callState: CallState;
  onEndCall: () => void;
  onAcceptCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
}

export default function CallScreen({
  callState,
  onEndCall,
  onAcceptCall,
  onToggleMute,
  onToggleSpeaker,
  onToggleCamera,
}: CallScreenProps) {
  const { type, status, partnerName, partnerAvatar, durationSeconds, isMuted, isSpeaker, isCameraOff } = callState;
  const [isPIPExpanded, setIsPIPExpanded] = useState(false);

  // Sound effects logic (simulated ringing using web audio api so that the user actually hears a soft ringing/beeping!)
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;
    let intervalId: any = null;

    if (status === 'outgoing' || status === 'incoming') {
      try {
        // Initialize Web Audio API
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playRingTone = () => {
          if (!audioContext) return;
          oscillator = audioContext.createOscillator();
          gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Ringtone frequencies
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(status === 'outgoing' ? 440 : 350, audioContext.currentTime);
          
          gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
          oscillator.start();
          
          // Stop after 1 second
          setTimeout(() => {
            if (oscillator) {
              oscillator.stop();
              oscillator.disconnect();
            }
          }, 1000);
        };

        playRingTone();
        intervalId = setInterval(playRingTone, 2500);
      } catch (err) {
        console.warn('Web Audio calling ringtone failed to boot:', err);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (oscillator) {
        try { oscillator.stop(); } catch(e){}
        oscillator.disconnect();
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [status]);

  // Convert duration to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {status !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-slate-950 text-white font-sans"
        >
          {/* Incoming popup style inside the view */}
          {status === 'incoming' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 z-50 p-6">
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm rounded-3xl bg-slate-900/80 border border-slate-800 p-8 text-center backdrop-blur-xl shadow-2xl"
              >
                <div className="relative mx-auto mb-6 h-24 w-24">
                  <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/30 opacity-75" />
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="relative h-24 w-24 rounded-full border-2 border-indigo-500 object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white border-2 border-slate-900">
                    {type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </div>
                </div>

                <h3 className="text-xl font-bold tracking-tight text-white mb-1">{partnerName}</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-8">
                  Incoming {type} Call...
                </p>

                <div className="flex justify-center gap-6">
                  {/* Decline Button */}
                  <button
                    onClick={onEndCall}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all hover:scale-105 shadow-lg shadow-red-500/30 cursor-pointer"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>

                  {/* Accept Button */}
                  <button
                    onClick={onAcceptCall}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-all hover:scale-105 shadow-lg shadow-emerald-500/30 cursor-pointer"
                  >
                    <Phone className="h-6 w-6" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Connected or Outgoing active calling panel */}
          {status !== 'incoming' && (
            <>
              {/* Top Banner Status */}
              <div className="p-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-mono font-medium text-slate-400 tracking-wider">
                    {status === 'outgoing' ? 'ENCRYPTING OUTGOING CONNECTION...' : 'CALL CONNECTED • end-to-end encrypted'}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                </div>
              </div>

              {/* Center Screen: Voice Call Graphic or Video Call Webcams */}
              <div className="flex-1 flex flex-col items-center justify-center relative p-6">
                
                {/* Background Video (Only if Video Call and camera is active on participant side) */}
                {type === 'video' && status === 'active' ? (
                  <div className="absolute inset-0 w-full h-full">
                    <img
                      src={partnerAvatar}
                      alt={partnerName}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
                  </div>
                ) : (
                  /* Ambient pulsating background gradient for voice call */
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[25%] left-[25%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] animate-pulse" />
                  </div>
                )}

                {/* Main Identity card (Centered in Voice, or Floating in Video) */}
                {type === 'voice' || status === 'outgoing' ? (
                  <div className="text-center z-10">
                    <div className="relative mb-6">
                      {/* Pulsating Ringing Waves */}
                      <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/25 opacity-40" />
                      <div className="absolute -inset-4 animate-pulse rounded-full bg-indigo-500/10 opacity-30" />
                      <img
                        src={partnerAvatar}
                        alt={partnerName}
                        className="relative h-32 w-32 rounded-3xl mx-auto border-2 border-indigo-500 object-cover shadow-2xl"
                      />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">{partnerName}</h2>
                    <p className="mt-2 text-sm text-slate-400 font-semibold">
                      {status === 'outgoing' ? 'Ringing...' : formatDuration(durationSeconds)}
                    </p>
                  </div>
                ) : (
                  /* Video Info Badge */
                  <div className="absolute top-4 left-4 z-10 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/50 backdrop-blur-md">
                    <p className="text-sm font-bold">{partnerName}</p>
                    <p className="text-xs text-indigo-400">{formatDuration(durationSeconds)}</p>
                  </div>
                )}

                {/* Self Webcam Video Picture-in-Picture (Only in Video Call) */}
                {type === 'video' && status === 'active' && (
                  <motion.div
                    drag
                    dragConstraints={{ left: -100, right: 100, top: -200, bottom: 200 }}
                    className={`absolute bottom-6 right-6 z-20 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl transition-all ${isPIPExpanded ? 'w-48 h-64' : 'w-32 h-44'}`}
                  >
                    {!isCameraOff ? (
                      <div className="relative w-full h-full">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"
                          alt="Self WebCam"
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <button 
                          onClick={() => setIsPIPExpanded(!isPIPExpanded)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/75 transition-colors"
                        >
                          {isPIPExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                        </button>
                        <span className="absolute bottom-2 left-2 text-[10px] bg-slate-950/60 px-1.5 py-0.5 rounded-md font-mono">
                          YOU
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                        <VideoOff className="h-5 w-5 text-slate-500 mb-1" />
                        <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">Camera Off</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Bottom Calling Action Bar */}
              <div className="p-8 bg-gradient-to-t from-slate-950 to-transparent flex flex-col items-center gap-6 z-10">
                <div className="flex items-center gap-6">
                  {/* Mute Mic Button */}
                  <button
                    onClick={onToggleMute}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors cursor-pointer ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'}`}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>

                  {/* End Call Button */}
                  <button
                    onClick={onEndCall}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105 shadow-xl shadow-red-500/35 cursor-pointer"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>

                  {/* Toggle Camera (Video Only) or Toggle Speaker (Voice Only) */}
                  {type === 'video' ? (
                    <button
                      onClick={onToggleCamera}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors cursor-pointer ${isCameraOff ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'}`}
                    >
                      {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </button>
                  ) : (
                    <button
                      onClick={onToggleSpeaker}
                      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors cursor-pointer ${isSpeaker ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-white'}`}
                    >
                      {isSpeaker ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
