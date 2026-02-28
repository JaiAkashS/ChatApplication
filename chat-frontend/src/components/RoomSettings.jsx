import { useState, useRef, useEffect } from 'react';

export default function RoomSettings({
  roomId,
  currentLogo,
  currentDescription = '',
  onUpdateRoomSettings,
  onClose,
  loading = false,
}) {
  const [logoUrl, setLogoUrl] = useState(currentLogo || '');
  const [previewLogo, setPreviewLogo] = useState(currentLogo || '');
  const [description, setDescription] = useState(currentDescription || '');
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleLogoChange = (value) => {
    setLogoUrl(value);
    if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
      setPreviewLogo(value);
    } else {
      setPreviewLogo('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 500 * 1024) {
      alert('Image must be smaller than 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl === 'string') {
        setLogoUrl(dataUrl);
        setPreviewLogo(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdateRoomSettings(roomId, {
      logo: logoUrl || null,
      description: description.trim(),
    });
  };

  const getInitials = (name) => {
    return name?.charAt(0).toUpperCase() || '#';
  };

  return (
    <div className="user-settings-overlay">
      <div className="user-settings-modal room-settings-modal" ref={modalRef}>
        <div className="user-settings-header">
          <h3>Room Settings: #{roomId}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="user-settings-content">
          {/* Room Logo Preview */}
          <div className="settings-preview">
            <div className="preview-room-logo">
              {previewLogo ? (
                <img src={previewLogo} alt="Room logo" onError={() => setPreviewLogo('')} />
              ) : (
                <span>{getInitials(roomId)}</span>
              )}
            </div>
            <span className="preview-room-name">#{roomId}</span>
          </div>

          {/* Room Logo */}
          <div className="settings-section">
            <label>Room Logo</label>
            <div className="pfp-options">
              <input
                type="text"
                placeholder="Enter image URL"
                value={logoUrl.startsWith('data:') ? '(Uploaded image)' : logoUrl}
                onChange={(e) => handleLogoChange(e.target.value)}
                disabled={logoUrl.startsWith('data:')}
              />
              <span className="or-divider">or</span>
              <label className="file-upload-btn">
                Upload
                <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
              </label>
              {logoUrl && (
                <button
                  className="secondary clear-btn"
                  onClick={() => {
                    setLogoUrl('');
                    setPreviewLogo('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="settings-hint">Max 500KB. Supports JPEG, PNG, GIF, WebP</div>
          </div>

          {/* Room Description */}
          <div className="settings-section">
            <label>Room Description</label>
            <textarea
              className="description-input"
              placeholder="Describe your room..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
            />
            <div className="settings-hint">{description.length}/500 characters</div>
          </div>
        </div>

        <div className="user-settings-footer">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
