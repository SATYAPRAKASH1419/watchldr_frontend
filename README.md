src/
├── main.tsx
├── App.tsx
├── index.css
│
├── pages/
│   ├── RoomCreatePage.tsx
│   ├── RoomJoinPage.tsx
│   └── SyncRoom.tsx
│
├── components/          # chhote reusable pieces (buttons, controller, etc.)
│   └── (abhi khali, baad mein Controller.tsx, SeekBar.tsx yaha aayenge)
│
├── hooks/                # custom hooks (jaise useYouTubePlayer, useSocket)
│   └── (abhi khali)
│
├── lib/                  # socket connection setup, API calls
│   └── socket.ts         # yaha socket.io-client ka connection banega
│
├── types/                # TypeScript interfaces
│   └── room.types.ts
│
└── utils/
    └── util.ts           # jo already hai