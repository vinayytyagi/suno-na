import React, { useEffect, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import chimeSound from '../assets/notification-chime.mp3';
import kissSound from '../assets/kiss.mp3';

export default function NotificationBar() {
  const { notification, options } = useNotification();
  const audioRef = useRef();

  // Choose sound: use options.sound if set, else default chime
  const soundSrc = options && options.sound === 'kiss' ? kissSound : chimeSound;

  useEffect(() => {
    if (notification && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay was blocked, ignore
      });
    }
  }, [notification, soundSrc]);

  return (
    <>
      <audio ref={audioRef} src={soundSrc} preload="auto" />
      <div
        className={`fixed left-1/2 top-6 z-[9999] w-full max-w-xs sm:max-w-sm -translate-x-1/2 transition-all duration-500 ${notification ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-8 pointer-events-none'}`}
        style={{ transitionProperty: 'opacity, transform' }}
      >
        <div
          className="bg-gradient-to-r from-pink-200 via-white to-pink-100 border border-pink-300 shadow-xl rounded-2xl px-6 py-3 flex items-center justify-center text-lg text-pink-700 tracking-wide select-none"
          style={{ fontFamily: 'Pacifico, cursive, sans-serif', letterSpacing: '1px', fontWeight: 500 }}
        >
          <span className="mr-2">💕</span>
          {notification}
        </div>
      </div>
    </>
  );
} 