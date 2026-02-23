import { useState } from 'react'

export default function RoomControls({
  roomId,
  onRoomIdChange,
  onJoinRoom,
  onCreateRoom,
  onJoinByInvite,
  targetUser,
  onTargetUserChange,
  onStartDM,
  username,
}) {
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState('create'); // 'create' or 'join'
  const [roomType, setRoomType] = useState('public');
  const [memberList, setMemberList] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateRoom = () => {
    if (!roomId) return;
    onCreateRoom({
      roomId,
      type: roomType,
      members: memberList,
    });
    setShowRoomModal(false);
  };

  const handleStartDm = () => {
    if (!username || !targetUser) return;
    onStartDM();
    setShowDmModal(false);
  };

  const handleJoinByInvite = () => {
    if (!inviteCode.trim()) return;
    onJoinByInvite?.(inviteCode.trim());
    setInviteCode('');
    setShowRoomModal(false);
  };

  const closeRoomModal = () => {
    setShowRoomModal(false);
    setRoomModalTab('create');
  };

  return (
    <>
      <div className="room-actions">
        <button onClick={() => setShowRoomModal(true)}>Add Room</button>
        <button className="secondary" onClick={() => setShowDmModal(true)}>Direct Message</button>
      </div>

      {showRoomModal && (
        <div className="modal-overlay" onClick={closeRoomModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Add Room</div>
            
            <div className="modal-tabs">
              <button 
                className={`modal-tab ${roomModalTab === 'create' ? 'active' : ''}`}
                onClick={() => setRoomModalTab('create')}
              >
                Create New
              </button>
              <button 
                className={`modal-tab ${roomModalTab === 'join' ? 'active' : ''}`}
                onClick={() => setRoomModalTab('join')}
              >
                Join with Code
              </button>
            </div>

            <div className="modal-body">
              {roomModalTab === 'create' ? (
                <>
                  <input
                    placeholder="room id"
                    value={roomId}
                    onChange={(e) => onRoomIdChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateRoom();
                      }
                    }}
                  />
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private group</option>
                  </select>
                  {roomType === 'private' && (
                    <input
                      placeholder="members (comma separated usernames)"
                      value={memberList}
                      onChange={(e) => setMemberList(e.target.value)}
                    />
                  )}
                </>
              ) : (
                <input
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinByInvite();
                    }
                  }}
                />
              )}
            </div>
            
            <div className="modal-actions">
              <button className="secondary" onClick={closeRoomModal}>Cancel</button>
              {roomModalTab === 'create' ? (
                <button onClick={handleCreateRoom}>Create</button>
              ) : (
                <button onClick={handleJoinByInvite}>Join</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDmModal && (
        <div className="modal-overlay" onClick={() => setShowDmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Start Private Chat</div>
            <div className="modal-body">
              <input
                placeholder="private chat username"
                value={targetUser}
                onChange={(e) => onTargetUserChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleStartDm();
                  }
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowDmModal(false)}>Cancel</button>
              <button onClick={handleStartDm}>Start</button>
            </div>
          </div>
        </div>
      )}

      <hr />
    </>
  );
}
