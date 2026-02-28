import { useState, useEffect, useCallback } from 'react';

function MemberList({ roomId, sessionToken, onViewProfile, currentUsername }) {
    const [members, setMembers] = useState([]);
    const [description, setDescription] = useState('');
    const [roomType, setRoomType] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMembers = useCallback(async () => {
        if (!roomId || !sessionToken) {
            setMembers([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const response = await fetch(
                `http://localhost:6969/rooms/${encodeURIComponent(roomId)}/members`,
                {
                    headers: { Authorization: `Bearer ${sessionToken}` },
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load members');
            }
            setMembers(data.members || []);
            setDescription(data.description || '');
            setRoomType(data.roomType || '');
            setError('');
        } catch (err) {
            setError(err.message);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    }, [roomId, sessionToken]);

    useEffect(() => {
        fetchMembers();
        // Refresh every 30 seconds for online status updates
        const interval = setInterval(fetchMembers, 30000);
        return () => clearInterval(interval);
    }, [fetchMembers]);

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

    const onlineMembers = members.filter((m) => m.status !== 'offline');
    const offlineMembers = members.filter((m) => m.status === 'offline');

    if (!roomId) {
        return (
            <div className="p-6 text-center text-content-muted text-sm">
                Select a room to see members
            </div>
        );
    }

    return (
        <div className="p-3 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center py-3 mb-2 border-b border-surface-300">
                <h4 className="m-0 text-xs font-semibold text-content-secondary uppercase tracking-wider truncate">
                    {roomType === 'dm' ? 'Conversation' : roomId}
                </h4>
                {members.length > 0 && (
                    <span className="text-xs text-content-muted flex-shrink-0 ml-2">{members.length}</span>
                )}
            </div>

            {description && (
                <div className="bg-surface-800 px-3 py-2 rounded-lg mb-3">
                    <p className="m-0 text-xs text-content-muted leading-snug">{description}</p>
                </div>
            )}

            {loading && <p className="py-4 text-center text-content-muted text-sm m-0">Loading...</p>}
            {error && <p className="py-4 text-center text-status-red text-sm m-0">{error}</p>}
            {!loading && members.length === 0 && !error && (
                <p className="py-4 text-center text-content-muted text-sm m-0">No members</p>
            )}

            {/* Online */}
            {onlineMembers.length > 0 && (
                <div className="mb-3">
                    <h5 className="m-0 mb-1.5 text-[11px] font-semibold text-content-muted uppercase tracking-wide px-1">
                        Online — {onlineMembers.length}
                    </h5>
                    {onlineMembers.map((member) => (
                        <div
                            key={member.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors duration-100 hover:bg-surface-500 ${
                                member.username === currentUsername ? 'bg-surface-400/60' : ''
                            }`}
                            onClick={() => onViewProfile(member.username)}
                        >
                            <div className="relative w-8 h-8 rounded-full bg-blurple flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 overflow-hidden">
                                {member.profilePicture ? (
                                    <img src={member.profilePicture} alt={member.username} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{member.username.charAt(0).toUpperCase()}</span>
                                )}
                                <span
                                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-700"
                                    style={{ backgroundColor: getStatusColor(member.status) }}
                                />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-sm font-medium truncate" style={{ color: member.usernameColor }}>
                                    {member.username}
                                    {member.isOwner && <span className="ml-1 text-xs">👑</span>}
                                </span>
                                {member.customStatus && (
                                    <span className="text-xs text-content-muted truncate">{member.customStatus}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Offline */}
            {offlineMembers.length > 0 && (
                <div className="mb-3 opacity-60">
                    <h5 className="m-0 mb-1.5 text-[11px] font-semibold text-content-muted uppercase tracking-wide px-1">
                        Offline — {offlineMembers.length}
                    </h5>
                    {offlineMembers.map((member) => (
                        <div
                            key={member.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors duration-100 hover:bg-surface-500 ${
                                member.username === currentUsername ? 'bg-surface-400/60' : ''
                            }`}
                            onClick={() => onViewProfile(member.username)}
                        >
                            <div className="relative w-8 h-8 rounded-full bg-blurple flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 overflow-hidden">
                                {member.profilePicture ? (
                                    <img src={member.profilePicture} alt={member.username} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{member.username.charAt(0).toUpperCase()}</span>
                                )}
                                <span
                                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-700"
                                    style={{ backgroundColor: getStatusColor(member.status) }}
                                />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className="text-sm font-medium truncate" style={{ color: member.usernameColor }}>
                                    {member.username}
                                    {member.isOwner && <span className="ml-1 text-xs">👑</span>}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MemberList;
