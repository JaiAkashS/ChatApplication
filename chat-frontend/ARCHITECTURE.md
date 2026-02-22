# Chat Application Structure Documentation

## Overview
The Chat Application is built with a modular React architecture using a two-column layout (left: main chat, right: room list and controls).

---

## Main Container Hierarchy

### `.app-container`
**Purpose:** The root container for the entire application
- **Display:** Flexbox (column direction)
- **Layout:** Full viewport height (100vh) with vertical stacking
- **Max Width:** 1100px (centered on larger screens)
- **Features:**
  - Contains the connection status bar at the top
  - Holds the main chat area below

---

## Connection Status Component

### `.connection-status`
**Purpose:** Displays real-time connection status at the top of the app
- **Display:** Flex with center alignment
- **Styles:**
  - Green pill-shaped badge (rounded with border-radius: 50px)
  - Shows: Connected, Disconnected, Reconnecting, Connecting, or Error
- **States (CSS Classes):**
  - `.connection-status.connected` → Green (#22c55e)
  - `.connection-status.disconnected` → Red (#dc3545)
  - `.connection-status.reconnecting` → Yellow (#ffc107)
  - `.connection-status.connecting` → Gray (#6c757d)
  - `.connection-status.error` → Gray (#6c757d)

---

## Main Chat Area

### `.chat-area`
**Purpose:** Main horizontal layout container splitting left and right sections
- **Display:** Flexbox (row direction)
- **Gap:** 20px between columns
- **Children:** 
  1. Left Column (3x wider) - Main chat
  2. Right Sidebar (1x) - Room list and controls

---

## Left Column (Main Chat Area)

### `.left-column`
**Purpose:** Primary chat interface with messages and input
- **Flex Ratio:** 3 (takes 75% of chat-area width)
- **Display:** Flex (column) for stacking sections vertically
- **Structure:**
  ```
  Header (h2)
  ├── User Identity Section
  ├── Messages Container
  └── Message Input Section
  ```
- **Styling:** White card with border and shadow

---

### `.left-column h2`
**Purpose:** "Minimal Chat" header
- **Padding:** 20px top/sides, 10px bottom
- **Font Size:** 1.25rem
- **Margin:** None (reset)

---

### `.user-input-section` & `.user-display`
**Purpose:** Username setup area
- **Content:** 
  - `.user-input-section`: Input field + "Set User" button (before username is set)
  - `.user-display`: Shows "Current User: [username]" (after username is set)
- **Padding:** Bottom border to separate from messages
- **Border:** 1px bottom separator

---

### `.messages-container`
**Purpose:** Wrapper for the messages list
- **Display:** Flex (column)
- **Flex:** Takes remaining space (flex: 1)
- **Overflow:** Hidden (controlled by child)
- **Purpose:** Manages scrollable messages area

---

### `.messages-list`
**Purpose:** Scrollable container for all chat messages
- **Flex:** 1 (fills available space)
- **Overflow:** vertical scrolling enabled
- **Padding:** 20px
- **Background:** Light gray (#fafafa)
- **List Type:** Unstyled (`list-style: none`)

---

### Message Items (`.message-item`)
**Purpose:** Individual message display
- **Classes:**
  - `.message-item.system` → Gray text for system messages (joins/leaves)
  - `.message-item.user-message` → Black text for user messages
  - `.message-item.dm` → Italic styling for direct messages
- **Margin:** 8px bottom spacing between messages

---

### `.message-input-section`
**Purpose:** Message input field and send button at bottom of chat
- **Display:** Flex (row) with 12px gap
- **Padding:** 20px
- **Border:** Top border (separator)
- **Background:** White
- **Children:**
  - Input field (flex: 1 to expand)
  - Send button

---

### `.message-input-section input`
- **Flex:** 1 (takes available horizontal space)
- **Padding:** 12px
- **Border:** 1px with primary color focus state
- **Border Radius:** 8px

---

### `.message-input-section button`
- **Color:** Primary color (#6366f1)
- **Padding:** 0 24px (horizontal)
- **Border Radius:** 8px
- **Hover Effect:** Brightness filter (95%)

---

## Right Sidebar (Room Controls & List)

### `.right-sidebar`
**Purpose:** Room/DM management and selection
- **Flex Ratio:** 1 (takes 25% of chat-area width)
- **Display:** Flex (column)
- **Structure:**
  ```
  Header (h3)
  ├── Room ID Input Section
  ├── DM Input Section
  ├── Divider (hr)
  └── Conversations Container
  ```
- **Styling:** White card with border and shadow

---

### `.right-sidebar h3`
**Purpose:** "Rooms" header
- **Font Size:** 1.1rem
- **Margin:** None at top

---

### `.room-input-section`
**Purpose:** Two sections for room/DM input
1. **First:** Room ID input + "Join Room" button
2. **Second:** Username input + "Start Private Chat" button
- **Styling:** Groups each input with its button
- **Margin:** 10px bottom spacing

---

### Input Elements in Sidebar
- **Width:** 100% (box-sizing: border-box)
- **Padding:** 8px
- **Margin Bottom:** 5px between input and button
- **Border:** 1px with primary focus color
- **Border Radius:** 4px

---

### Buttons in Sidebar
- **Width:** 100%
- **Padding:** 8px
- **Background:** Primary color (#6366f1)
- **Color:** White
- **Cursor:** Pointer
- **Border:** None
- **Hover:** 0.95 brightness filter

---

### `.hr` (Divider)
- **Margin:** 10px 0 (vertical spacing)
- **Border:** None, with top 1px divider (#ddd)

---

### `.conversations-container`
**Purpose:** Scrollable list of all active conversations
- **Flex:** 1 (takes remaining vertical space)
- **Overflow:** vertical scrolling

---

### `.conversations-list`
**Purpose:** Unordered list of rooms and DMs
- **List Style:** None (removed bullets)
- **Padding:** 0 (reset)
- **Margin:** 0 (reset)

---

### `.conversation-item`
**Purpose:** Individual room or DM list item
- **Padding:** 10px
- **Margin Bottom:** 5px
- **Cursor:** Pointer (clickable)
- **Background:** Light gray (#f0f0f0)
- **Border Radius:** 4px
- **User Select:** None (prevents text selection)
- **Transition:** Smooth background color change

---

### `.conversation-item.active`
**Purpose:** Highlight the currently selected room
- **Background:** Primary color (#007bff)
- **Color:** White
- **Visual Feedback:** Shows which room is being viewed

---

### `.conversation-item:hover`
- **Background:** Slightly darker gray (#e0e0e0)
- **Purpose:** Visual feedback that item is clickable

---

## Color Scheme (CSS Variables)

```css
--primary: #6366f1           /* Main button/active color - Indigo */
--primary-hover: #4f46e5     /* Darker indigo for hover */
--bg-main: #f8fafc           /* Light background - Slate-50 */
--bg-card: #ffffff           /* Card background - White */
--border: #e2e8f0            /* Border color - Slate-200 */
--text: #1e293b              /* Text color - Slate-900 */
--status-green: #22c55e      /* Connected status - Green */
```

---

## Layout Summary

```
┌─────────────────────────────────────────────┐
│          Connection Status Badge            │ (connection-status)
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────┐  ┌────────────┐  │
│  │   LEFT COLUMN        │  │ RIGHT      │  │ (chat-area)
│  │ (flex: 3, 75%)       │  │ SIDEBAR    │  │
│  │                      │  │ (flex: 1,  │  │
│  │ ┌────────────────┐   │  │  25%)      │  │
│  │ │ User Identity  │   │  │            │  │
│  │ ├────────────────┤   │  │ ┌────────┐ │  │
│  │ │                │   │  │ │ Room   │ │  │
│  │ │  Messages      │   │  │ │ Ctrl   │ │  │
│  │ │  (scrollable)  │   │  │ ├────────┤ │  │
│  │ │                │   │  │ │        │ │  │
│  │ ├────────────────┤   │  │ │ Conv.  │ │  │
│  │ │ Message Input  │   │  │ │ List   │ │  │
│  │ └────────────────┘   │  │ │        │ │  │
│  │                      │  │ └────────┘ │  │
│  └──────────────────────┘  └────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Component Integration

The structure uses these modular components:
- **ConnectionStatus** → `.connection-status`
- **UserSetup** → `.user-input-section` or `.user-display`
- **Messages** → `.messages-container` and `.messages-list`
- **MessageInput** → `.message-input-section`
- **RoomControls** → `.room-input-section` (both)
- **RoomList** → `.conversations-container` and items

Each component receives props and manages its own state communication with the parent App component.
