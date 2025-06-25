import React, { useState, useRef } from 'react';
import { 
  CloudArrowUpIcon, 
  MusicalNoteIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

const UploadSong = ({ onUpload }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    if (selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select an audio file (MP3, WAV, etc.)');
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }
    
    if (!file) {
      setError('Please select an audio file');
      return;
    }

    setUploading(true);
    setError('');

    const result = await onUpload({
      title: title.trim(),
      file: file
    });

    if (result.success) {
      setTitle('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setError(result.error);
    }

    setUploading(false);
  };

  const removeFile = () => {
    setFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="text-center mb-4 sm:mb-6">
        <MusicalNoteIcon className="h-10 w-10 sm:h-12 sm:w-12 text-primary-500 mx-auto mb-2 sm:mb-3" />
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 sm:mb-2">
          Upload New Song
        </h3>
        <p className="text-gray-600 text-sm sm:text-base">
          Share your beautiful music with Vinay
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Song Title */}
        <div>
          <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Song Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field w-full"
            placeholder="Enter song title..."
            required
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Audio File
          </label>
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors duration-200 ${
                dragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-primary-400 hover:bg-primary-25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CloudArrowUpIcon className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-2 sm:mb-4" />
              <p className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">
                Drop your audio file here
              </p>
              <p className="text-gray-500 text-xs sm:text-base mb-2 sm:mb-4">
                or click to browse
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary w-full sm:w-auto"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg p-3 sm:p-4 bg-gray-50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <MusicalNoteIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary-500" />
                  <div>
                    <p className="font-medium text-gray-900 text-xs sm:text-base">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <button
          type="submit"
          disabled={!title.trim() || !file || uploading}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Uploading...
            </div>
          ) : (
            'Upload Song'
          )}
        </button>
      </form>
    </div>
  );
};

export default UploadSong; 