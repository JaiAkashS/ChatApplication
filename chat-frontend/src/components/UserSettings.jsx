import { useState, useRef, useEffect } from 'react';

export default function UserSettings({
  username,
  usernameColor,
  profilePicture,
  onUpdateProfile,
  onLogoutEverywhere,
  onClose,
  loading = false,
}) {
  const [color, setColor] = useState(usernameColor || '#dcddde');
  const [pfpUrl, setPfpUrl] = useState(profilePicture || '');
  const [previewPfp, setPreviewPfp] = useState(profilePicture || '');
  const [logoutEverywhereLoading, setLogoutEverywhereLoading] = useState(false);
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

  const handlePfpChange = (value) => {
    setPfpUrl(value);
    // Show preview if it's a valid URL
    if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
      setPreviewPfp(value);
    } else {
      setPreviewPfp('');
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
        setPfpUrl(dataUrl);
        setPreviewPfp(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdateProfile({
      usernameColor: color,
      profilePicture: pfpUrl || null,
    });
  };

  const getInitials = (name) => {
    return name?.charAt(0).toUpperCase() || '?';
  };

  const colorPresets = [
    '#dcddde', // default gray
    '#ed4245', // red
    '#f47b67', // coral
    '#faa81a', // yellow
    '#57f287', // green
    '#3ba55d', // dark green
    '#00aff4', // blue
    '#5865f2', // blurple
    '#eb459e', // pink
    '#9b59b6', // purple
  ];

  return (
    <div className="user-settings-overlay">
      <div className="user-settings-modal" ref={modalRef}>
        <div className="user-settings-header">
          <h3>User Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="user-settings-content">
          {/* Profile Preview */}
          <div className="settings-preview">
            <div className="preview-avatar" style={{ backgroundColor: previewPfp ? 'transparent' : color }}>
              {previewPfp ? (
                <img src={previewPfp} alt="Profile" onError={() => setPreviewPfp('')} />
              ) : (
                <span>{getInitials(username)}</span>
              )}
            </div>
            <span className="preview-username" style={{ color }}>
              {username}
            </span>
          </div>

          {/* Profile Picture */}
          <div className="settings-section">
            <label>Profile Picture</label>
            <div className="pfp-options">
              <input
                type="text"
                placeholder="Enter image URL"
                value={pfpUrl.startsWith('data:') ? '(Uploaded image)' : pfpUrl}
                onChange={(e) => handlePfpChange(e.target.value)}
                disabled={pfpUrl.startsWith('data:')}
              />
              <span className="or-divider">or</span>
              <label className="file-upload-btn">
                Upload
                <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
              </label>
              {pfpUrl && (
                <button
                  className="secondary clear-btn"
                  onClick={() => {
                    setPfpUrl('');
                    setPreviewPfp('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="settings-hint">Max 500KB. Supports JPEG, PNG, GIF, WebP</div>
          </div>

          {/* Username Color */}
          <div className="settings-section">
            <label>Username Color</label>
            <div className="color-picker-row">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-picker-input"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    setColor(e.target.value);
                  }
                }}
                placeholder="#ffffff"
                className="color-hex-input"
              />
            </div>
            <div className="color-presets">
              {colorPresets.map((preset) => (
                <button
                  key={preset}
                  className={`color-preset ${color === preset ? 'active' : ''}`}
                  style={{ backgroundColor: preset }}
                  onClick={() => setColor(preset)}
                  title={preset}
                />
              ))}
            </div>
          </div>

          {/* Security Section */}
          <div className="settings-section security-section">
            <label>Security</label>
            <button
              className="logout-everywhere-btn"
              onClick={async () => {
                setLogoutEverywhereLoading(true);
                try {
                  await onLogoutEverywhere?.();
                } finally {
                  setLogoutEverywhereLoading(false);
                }
              }}
              disabled={logoutEverywhereLoading}
            >
              {logoutEverywhereLoading ? 'Logging out...' : 'Logout Everywhere'}
            </button>
            <div className="settings-hint">Sign out from all devices and browsers</div>
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
