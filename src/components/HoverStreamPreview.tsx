import React, { useState, useEffect, useRef } from 'react';
import { Tv, Wifi, WifiOff, Loader2, Play, VolumeX, AlertTriangle } from 'lucide-react';

interface HoverStreamPreviewProps {
  streamUrl: string;
  logoUrl?: string;
  fallbackName: string;
  isPlayingMain: boolean;
  accentColor?: string; // 'blue' or 'red' based on the card flavor
}

export function HoverStreamPreview({
  streamUrl,
  logoUrl,
  fallbackName,
  isPlayingMain,
  accentColor = 'blue'
}: HoverStreamPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [streamStats, setStreamStats] = useState({
    resolution: '1080p',
    fps: '60fps',
    bitrate: '4.8 Mbps',
    ping: 0
  });

  const hoverTimer = useRef<any>(null);
  const durationTimer = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (durationTimer.current) clearTimeout(durationTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setPreviewEnded(false);
    setPlayError(false);
    
    // Simulate dynamic networking stats for the specific node on hover
    setStreamStats({
      resolution: Math.random() > 0.4 ? '1920x1080' : '1280x720',
      fps: Math.random() > 0.3 ? '60 fps' : '30 fps',
      bitrate: `${(3.5 + Math.random() * 2.8).toFixed(1)} Mbps`,
      ping: Math.floor(45 + Math.random() * 80)
    });

    // 600ms debounce buffer to prevent accidental trigger during scroll
    hoverTimer.current = setTimeout(() => {
      setIsLoading(true);
      setIsPlayingPreview(true);
      
      // Auto-stop preview after 6 seconds to optimize network bandwidth
      durationTimer.current = setTimeout(() => {
        setIsPlayingPreview(false);
        setPreviewEnded(true);
        setIsLoading(false);
      }, 7000);
    }, 600);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPlayingPreview(false);
    setIsLoading(false);
    setPlayError(false);
    setPreviewEnded(false);

    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (durationTimer.current) {
      clearTimeout(durationTimer.current);
      durationTimer.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      } catch (err) {}
    }
  };

  // Attempt to trigger video load
  useEffect(() => {
    if (isPlayingPreview && videoRef.current && streamUrl && !previewEnded) {
      setIsLoading(true);
      setPlayError(false);
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsLoading(false);
          })
          .catch((err) => {
            // Video launch failed (probably CORS, .ts format restriction, or audio sandbox)
            console.warn("Muted background preview failed loading, routing to neural spectrum visualizer.", err);
            setPlayError(true);
            setIsLoading(false);
          });
      }
    }
  }, [isPlayingPreview, streamUrl, previewEnded]);

  const ringColor = accentColor === 'red' ? 'border-red-500' : 'border-blue-500';
  const badgeColor = accentColor === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  const pulseColor = accentColor === 'red' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div
      className="absolute inset-0 w-full h-full z-20 outline-none select-none overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* NORMAL LOGO/THUMBNAIL POSTER VIEW */}
      {!isPlayingPreview && !previewEnded && (
        <div className="absolute inset-0 flex items-center justify-center p-2 z-10 transition-all duration-300">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain max-h-[70px] transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 ${accentColor === 'red' ? 'to-red-950/20' : 'to-blue-950/20'} flex flex-col items-center justify-center text-center p-2`}>
              <Tv className={`w-6 h-6 text-gray-600 transition-all mb-1 ${isPlayingMain ? (accentColor === 'red' ? 'text-red-500' : 'text-blue-500') : 'group-hover:text-amber-500'}`} />
              <span className="text-[10px] font-bold text-gray-500 truncate max-w-full uppercase tracking-wider block">
                {fallbackName?.slice(0, 10)}
              </span>
            </div>
          )}

          {/* Prompt banner to hover */}
          {isHovered && !isLoading && (
            <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm border border-gray-800 text-[8px] font-black uppercase text-gray-300 px-1.5 py-0.5 rounded tracking-widest transition-opacity duration-200">
              Decoding Preview...
            </div>
          )}
        </div>
      )}

      {/* BUFFERING STATE */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-30 transition-all duration-200">
          <Loader2 className={`w-5 h-5 ${accentColor === 'red' ? 'text-red-400' : 'text-blue-400'} animate-spin`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mt-2 animate-pulse">
            Connecting Feed
          </span>
        </div>
      )}

      {/* RAW VIDEO ELEMENT (PLAYS IF COMPATIBLE AND DIRECT) */}
      {isPlayingPreview && !playError && !previewEnded && (
        <div className="absolute inset-0 bg-black z-20">
          <video
            ref={videoRef}
            src={streamUrl}
            muted
            playsInline
            autoPlay
            controls={false}
            className="w-full h-full object-cover"
            onError={() => {
              setPlayError(true);
              setIsLoading(false);
            }}
          />
          {/* Live Indicator overlay on live feed */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 z-30 bg-black/70 px-1.5 py-0.5 rounded border border-gray-800">
            <span className={`w-1.5 h-1.5 rounded-full ${pulseColor} animate-pulse`} />
            <span className="text-[8px] font-bold text-white tracking-wider uppercase">Live Preview</span>
          </div>

          <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-gray-400 z-30 flex items-center gap-1.5">
            <VolumeX className="w-2.5 h-2.5 text-gray-400" />
            <span>MUTED</span>
          </div>
        </div>
      )}

      {/* PREMIUM SPECTRUM NEURAL VISUALIZER FALLBACK (Activated if CORS or Codec issues occur) */}
      {isPlayingPreview && playError && !previewEnded && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#080B13] via-[#0E1528] to-[#142345] z-20 flex flex-col justify-between p-2.5 border border-blue-500/20 shadow-inner">
          <div className="flex items-center justify-between">
            <div className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest flex items-center gap-1 border ${badgeColor}`}>
              <span className={`w-1 h-1 rounded-full ${pulseColor} animate-pulse`} />
              <span>Decoder Active</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-900/20 shadow-sm">
              PING {streamStats.ping}ms
            </span>
          </div>

          {/* Interactive Equalizer bars overlay */}
          <div className="flex items-end justify-center gap-1.5 h-12 my-1">
            {[...Array(12)].map((_, i) => {
              const heightStyle = {
                animation: `neuralEqualizer ${0.6 + (i % 4) * 0.25}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.08}s`
              };
              return (
                <div
                  key={i}
                  style={heightStyle}
                  className={`w-1 rounded-full ${
                    accentColor === 'red' 
                      ? 'bg-gradient-to-t from-red-600 via-orange-400 to-yellow-300' 
                      : 'bg-gradient-to-t from-blue-600 via-cyan-400 to-emerald-400'
                  }`}
                />
              );
            })}
          </div>

          {/* Telemetry statistics labels */}
          <div className="pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[8px] text-gray-400 font-mono">
            <span className="truncate max-w-[50px] font-bold text-gray-300">{fallbackName}</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">{streamStats.resolution}</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400">{streamStats.bitrate}</span>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW COMPLETED TEMPORARY WALL (Prevents excessive background downloads) */}
      {previewEnded && (
        <div className="absolute inset-0 bg-[#060810]/95 flex flex-col items-center justify-center p-2 z-35 animate-fade-in border border-gray-800/40 text-center">
          <Play className={`w-5 h-5 ${accentColor === 'red' ? 'text-red-500/85' : 'text-blue-500/85'} mb-1 opacity-80`} />
          <p className="text-[9px] font-extrabold text-white tracking-widest uppercase mb-0.5">Stream Preview Ended</p>
          <p className="text-[8px] text-gray-500 max-w-[124px] mx-auto leading-normal">
            Move mouse cursor away to refresh preview node.
          </p>
        </div>
      )}
    </div>
  );
}
