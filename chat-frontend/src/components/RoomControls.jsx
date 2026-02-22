import { useState } from 'react'

export default function RoomControls({
  roomId,
  onRoomIdChange,
  onJoinRoom,
  onCreateRoom,
  targetUser,
  onTargetUserChange,
  onStartDM,
  username,
}) {
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [roomType, setRoomType] = useState('public');
  const [memberList, setMemberList] = useState('');

  const handleJoinRoom = () => {
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

  return (
    <>
      <div className="room-actions">
        <button onClick={() => setShowRoomModal(true)}>Add Room</button>
        <button onClick={() => setShowDmModal(true)}>Private Chat</button>
      </div>

      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Create Room</div>
            <div className="modal-body">
              <input
                placeholder="room id"
                value={roomId}
                onChange={(e) => onRoomIdChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
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
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button onClick={handleJoinRoom}>Create</button>
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
