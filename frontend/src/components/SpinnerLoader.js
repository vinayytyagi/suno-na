import React from 'react';

export default function SpinnerLoader({ size = 48, color = '#ec4899' }) {
  return (
    <div className="flex items-center justify-center min-h-[100px] w-full">
      <span
        className="spinner-loader"
        style={{
          width: size,
          height: size,
          borderWidth: size / 8,
          borderColor: `${color}33`,
          borderTopColor: color,
        }}
      />
    </div>
  );
} 