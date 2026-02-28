import { useState, useEffect } from 'react';

function UserProfile({ username, onClose, onSendFriendRequest, onRemoveFriend, sessionToken }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await fetch(`http://localhost:6969/users/${encodeURIComponent(username)}`, {
                    headers: { Authorization: `Bearer ${sessionToken}` },
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load profile');
                }
                setProfile(data.user);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (username && sessionToken) {
            fetchProfile();
        }
    }, [username, sessionToken]);

    const handleAddFriend = async () => {
        if (!profile) return;
        try {
            setActionLoading(true);
            await onSendFriendRequest(profile.username);
            setProfile((prev) => ({ ...prev, isFriend: true }));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        if (!profile) return;
        try {
            setActionLoading(true);
            await onRemoveFriend(profile.username);
            setProfile((prev) => ({ ...prev, isFriend: false }));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'online':
                return '#43b581';
            case 'away':
                return '#faa61a';
            case 'dnd':
                return '#f04747';
            default:
                return '#747f8d';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'online':
                return 'Online';
            case 'away':
                return 'Away';
            case 'dnd':
                return 'Do Not Disturb';
            default:
                return 'Offline';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal user-profile-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>User Profile</h2>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>

                {loading && <div className="profile-loading">Loading profile...</div>}

                {error && <div className="profile-error">{error}</div>}

                {profile && !loading && (
                    <div className="profile-content">
                        <div className="profile-header">
                            <div className="profile-avatar-large">
                                {profile.profilePicture ? (
                                    <img src={profile.profilePicture} alt={profile.username} />
                                ) : (
                                    <span>{profile.username.charAt(0).toUpperCase()}</span>
                                )}
                                <div
                                    className="profile-status-indicator"
                                    style={{ backgroundColor: getStatusColor(profile.status) }}
                                    title={getStatusLabel(profile.status)}
                                />
                            </div>
                            <div className="profile-info">
                                <h3 style={{ color: profile.usernameColor }}>{profile.username}</h3>
                                <div className="profile-status-text">
                                    <span
                                        className="status-dot"
                                        style={{ backgroundColor: getStatusColor(profile.status) }}
                                    />
                                    {getStatusLabel(profile.status)}
                                    {profile.customStatus && (
                                        <span className="custom-status"> - {profile.customStatus}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {profile.bio && (
                            <div className="profile-section">
                                <h4>About Me</h4>
                                <p className="profile-bio">{profile.bio}</p>
                            </div>
                        )}

                        <div className="profile-section">
                            <h4>Member Since</h4>
                            <p>{formatDate(profile.createdAt)}</p>
                        </div>

                        {!profile.isSelf && (
                            <div className="profile-actions">
                                {profile.isFriend ? (
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleRemoveFriend}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Removing...' : 'Remove Friend'}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleAddFriend}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Sending...' : 'Add Friend'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UserProfile;
