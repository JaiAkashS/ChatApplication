import { useState, useEffect, useCallback } from 'react';

function FriendList({ sessionToken, onViewProfile, onStartDM, currentUsername }) {
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState({});
    const [addUsername, setAddUsername] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchFriends = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoading(true);
            const response = await fetch('http://localhost:6969/friends', {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load friends');
            }
            setFriends(data.friends || []);
            setFriendRequests(data.friendRequests || []);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [sessionToken]);

    useEffect(() => {
        fetchFriends();
        // Refresh every 30 seconds for online status updates
        const interval = setInterval(fetchFriends, 30000);
        return () => clearInterval(interval);
    }, [fetchFriends]);

    const handleAcceptRequest = async (username) => {
        try {
            setActionLoading((prev) => ({ ...prev, [username]: true }));
            const response = await fetch('http://localhost:6969/friends/accept', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ username }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to accept request');
            }
            await fetchFriends();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading((prev) => ({ ...prev, [username]: false }));
        }
    };

    const handleRejectRequest = async (username) => {
        try {
            setActionLoading((prev) => ({ ...prev, [username]: true }));
            const response = await fetch('http://localhost:6969/friends/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ username }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to reject request');
            }
            await fetchFriends();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading((prev) => ({ ...prev, [username]: false }));
        }
    };

    const handleAddFriend = async (e) => {
        e.preventDefault();
        if (!addUsername.trim()) return;
        
        try {
            setAddLoading(true);
            setAddError('');
            const response = await fetch('http://localhost:6969/friends/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ username: addUsername.trim() }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send request');
            }
            setAddUsername('');
            setShowAddForm(false);
            if (data.status === 'accepted') {
                await fetchFriends();
            }
        } catch (err) {
            setAddError(err.message);
        } finally {
            setAddLoading(false);
        }
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

    const onlineFriends = friends.filter((f) => f.status !== 'offline');
    const offlineFriends = friends.filter((f) => f.status === 'offline');

    return (
        <div className="friend-list">
            <div className="friend-list-header">
                <h4>Friends {friends.length > 0 && `(${friends.length})`}</h4>
                <button
                    className="add-friend-btn"
                    onClick={() => setShowAddForm(!showAddForm)}
                    title="Add Friend"
                >
                    +
                </button>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddFriend} className="add-friend-form">
                    <input
                        type="text"
                        placeholder="Username"
                        value={addUsername}
                        onChange={(e) => setAddUsername(e.target.value)}
                        disabled={addLoading}
                    />
                    <button type="submit" disabled={addLoading || !addUsername.trim()}>
                        {addLoading ? '...' : 'Add'}
                    </button>
                    {addError && <div className="add-friend-error">{addError}</div>}
                </form>
            )}

            {loading && <div className="friend-list-loading">Loading...</div>}
            {error && <div className="friend-list-error">{error}</div>}

            {friendRequests.length > 0 && (
                <div className="friend-requests-section">
                    <h5>Friend Requests ({friendRequests.length})</h5>
                    {friendRequests.map((request) => (
                        <div key={request.id} className="friend-request-item">
                            <div className="friend-avatar-small">
                                {request.profilePicture ? (
                                    <img src={request.profilePicture} alt={request.username} />
                                ) : (
                                    <span>{request.username.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span
                                className="friend-name"
                                style={{ color: request.usernameColor }}
                                onClick={() => onViewProfile(request.username)}
                            >
                                {request.username}
                            </span>
                            <div className="friend-request-actions">
                                <button
                                    className="accept-btn"
                                    onClick={() => handleAcceptRequest(request.username)}
                                    disabled={actionLoading[request.username]}
                                    title="Accept"
                                >
                                    ✓
                                </button>
                                <button
                                    className="reject-btn"
                                    onClick={() => handleRejectRequest(request.username)}
                                    disabled={actionLoading[request.username]}
                                    title="Reject"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && friends.length === 0 && friendRequests.length === 0 && (
                <div className="no-friends">No friends yet. Add someone!</div>
            )}

            {onlineFriends.length > 0 && (
                <div className="friends-section">
                    <h5>Online — {onlineFriends.length}</h5>
                    {onlineFriends.map((friend) => (
                        <div key={friend.id} className="friend-item">
                            <div className="friend-avatar-small">
                                {friend.profilePicture ? (
                                    <img src={friend.profilePicture} alt={friend.username} />
                                ) : (
                                    <span>{friend.username.charAt(0).toUpperCase()}</span>
                                )}
                                <div
                                    className="status-indicator-small"
                                    style={{ backgroundColor: getStatusColor(friend.status) }}
                                />
                            </div>
                            <div className="friend-info">
                                <span
                                    className="friend-name"
                                    style={{ color: friend.usernameColor }}
                                    onClick={() => onViewProfile(friend.username)}
                                >
                                    {friend.username}
                                </span>
                                {friend.customStatus && (
                                    <span className="friend-custom-status">{friend.customStatus}</span>
                                )}
                            </div>
                            <button
                                className="dm-btn"
                                onClick={() => onStartDM(friend.username)}
                                title="Message"
                            >
                                💬
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {offlineFriends.length > 0 && (
                <div className="friends-section offline-section">
                    <h5>Offline — {offlineFriends.length}</h5>
                    {offlineFriends.map((friend) => (
                        <div key={friend.id} className="friend-item offline">
                            <div className="friend-avatar-small">
                                {friend.profilePicture ? (
                                    <img src={friend.profilePicture} alt={friend.username} />
                                ) : (
                                    <span>{friend.username.charAt(0).toUpperCase()}</span>
                                )}
                                <div
                                    className="status-indicator-small"
                                    style={{ backgroundColor: getStatusColor(friend.status) }}
                                />
                            </div>
                            <div className="friend-info">
                                <span
                                    className="friend-name"
                                    style={{ color: friend.usernameColor }}
                                    onClick={() => onViewProfile(friend.username)}
                                >
                                    {friend.username}
                                </span>
                            </div>
                            <button
                                className="dm-btn"
                                onClick={() => onStartDM(friend.username)}
                                title="Message"
                            >
                                💬
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FriendList;
