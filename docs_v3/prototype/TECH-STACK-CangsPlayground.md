# Tech Stack — CangsPlayground

| Mục | Nội dung |
|---|---|
| Liên quan | PRD-ESL-Minigame-Platform.md (mục 7, 10, 12, 13) |
| Ngày | 21/10/2026 |
| Trạng thái | Đã chốt hướng, sẵn sàng dựng khung tuần 1 |

---

## 1. Nguyên tắc chọn stack

1. **Một ngôn ngữ cho cả FE và BE (TypeScript).** Type của game, payload socket và hàm `viewFor()` được viết một lần, dùng chung ở hai phía.
2. **Server là nguồn sự thật duy nhất.** Client chỉ gửi ý định; server validate rồi gửi lại state đã lọc theo người xem.
3. **Đơn giản trước, scale sau.** Phase 1 chạy 1 instance, state trong RAM, chưa có database.
4. **Mỗi game là một package độc lập**, gồm cả logic server lẫn UI client.

## 2. Stack đề xuất

| Lớp | Chọn | Vì sao |
|---|---|---|
| Ngôn ngữ | **TypeScript** (cả FE + BE) | Payload socket và type của game dùng chung, sửa một chỗ thì cả hai phía báo lỗi |
| Real-time | **Socket.IO** | Có sẵn rooms (lobby / nhóm / cá nhân), tự reconnect, fallback khi Wi-Fi trường chặn WebSocket |
| Backend | **Node.js + Fastify** (hoặc Express) | Nhẹ, gắn Socket.IO dễ; HTTP chỉ dùng cho health check và load topic |
| Validate | **Zod** | Kiểm tra mọi event client gửi lên; dùng luôn làm schema cấu hình game để tự render form trên Host Console |
| Frontend | **React + Vite** | Một app cho cả 3 view theo route; không cần Next.js vì không có SEO hay SSR |
| Routing FE | **React Router** | `/display/:code`, `/host/:code`, `/play/:code`, `/join/:code` |
| State FE | **Zustand** | Nhận `state:sync` / `state:patch` từ socket rồi đổ vào store, đơn giản hơn Redux |
| UI | **Tailwind CSS** | Dễ làm màn hình màu theo nhóm, chữ to cho Projector, responsive cho điện thoại |
| QR | `qrcode` (render phía client) | Không cần gọi API ngoài |
| ID / token | `nanoid` (mã lobby dùng bảng ký tự riêng) + `crypto.randomBytes` cho token | Mã lobby dễ đọc; token ≥ 128-bit |
| Monorepo | **pnpm workspaces** | Mỗi game là một package |
| Test | **Vitest** + script giả lập 30 client socket | Test thuật toán chia nhóm, `viewFor()`, chịu tải |
| Lint / format | ESLint + Prettier | |
| Lưu trữ | **In-memory** (Phase 1) → **Redis** khi cần | Lobby chỉ sống vài giờ, chưa cần database; topic để trong file JSON |

## 3. Kiến trúc tổng quan

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ Projector    │   │ Host Console │   │ Player (×N)  │
 │ /display/:c  │   │ /host/:c     │   │ /play/:c     │
 └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
        │   Socket.IO (WSS)│                  │
        └──────────────────┼──────────────────┘
                           ▼
              ┌───────────────────────────┐
              │ Node.js (Fastify + IO)    │
              │  ├─ Auth (host/player tok)│
              │  ├─ LobbyManager (RAM)    │
              │  ├─ GroupService          │
              │  ├─ TimerService (endsAt) │
              │  ├─ GameRegistry ─► games │
              │  └─ Broadcaster(viewFor)  │
              └───────────────────────────┘
```

**Luồng một lệnh:** client emit → Zod validate → kiểm tra quyền (host/player token) → cập nhật state → với mỗi người xem, chạy `viewFor()` → emit `state:patch` vào đúng room/socket.

## 4. Cấu trúc thư mục

```
cangsplayground/
├─ apps/
│  ├─ server/
│  │  ├─ src/
│  │  │  ├─ index.ts          # khởi động Fastify + Socket.IO, serve build của web
│  │  │  ├─ lobby/            # LobbyManager, hết hạn lobby
│  │  │  ├─ auth/             # host token, player token, resume session
│  │  │  ├─ handlers/         # lobby.*, groups.*, game.*
│  │  │  ├─ timer/            # TimerService, time:sync
│  │  │  └─ broadcast.ts      # lọc state theo viewer rồi emit
│  │  └─ test/
│  └─ web/
│     ├─ src/
│     │  ├─ routes/           # display/, host/, play/, join/
│     │  ├─ socket/           # client Socket.IO, hiệu chỉnh lệch giờ
│     │  ├─ store/            # Zustand
│     │  └─ games/registry.ts # map gameId → component
│     └─ index.html
├─ packages/
│  ├─ core/       # types, thuật toán chia nhóm, interface GameModule, schema event (Zod)
│  ├─ ui/         # Timer, GroupCard, FlipCard, TurnIndicator, VotePanel
│  └─ games/
│     ├─ free-talk/
│     └─ whos-the-spy/
│        ├─ src/logic.ts      # prepare, onAction, onTimerEnd, viewFor (chạy trên server)
│        ├─ src/config.ts     # Zod schema cấu hình
│        ├─ src/views/        # HostConfig, ProjectorGroupCard, HostGroupPanel, PlayerScreen
│        └─ data/topics.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ package.json
```

Thêm game mới = copy một thư mục trong `packages/games/`, sửa logic + views, đăng ký vào registry của server và web.

## 5. Quy ước kỹ thuật

| Chủ đề | Quy ước |
|---|---|
| Tên event | `domain:action` (vd `lobby:join`, `groups:assign`, `game:control`) |
| Phản hồi lệnh | Dùng acknowledgement của Socket.IO: `{ ok: true, data }` hoặc `{ ok: false, error: { code, message } }` |
| Idempotent | Lệnh host gửi kèm `commandId`; server bỏ qua lệnh trùng |
| Gửi state | Lần đầu / reconnect: `state:sync` (snapshot đã lọc); sau đó: `state:patch` |
| Timer | Server gửi `endsAt` (epoch ms); client tính `offset` từ `time:sync` rồi tự đếm ngược |
| Random | Server dùng RNG có seed theo phiên để test và tái hiện lỗi được |
| Bảo mật dữ liệu | Không bao giờ emit state thô; mọi emit phải đi qua `broadcast.ts` |

## 6. Deploy

- **Một service duy nhất**: Node vừa phục vụ file build của React vừa chạy Socket.IO. Cùng domain nên không phải xử lý CORS.
- Host trên **Render / Railway / Fly.io** (HTTPS sẵn, hỗ trợ WebSocket) hoặc một VPS nhỏ.
- Gói free của Render sẽ "ngủ" khi không có truy cập, lần đầu mở có thể mất khoảng 30 giây để khởi động. Nên dùng gói trả phí rẻ nhất, hoặc mở link trước giờ học.
- Phase 1 chỉ chạy **1 instance** vì state nằm trong RAM. Khi cần nhiều instance: thêm Redis + `@socket.io/redis-adapter` và chuyển LobbyManager sang Redis.
- Biến môi trường tối thiểu: `PORT`, `PUBLIC_URL` (để sinh link QR), `LOBBY_TTL_MINUTES`.

## 7. Phương án thay thế đã cân nhắc

| Phương án | Khi nào nên chọn | Lý do chưa chọn |
|---|---|---|
| **Spring Boot + WebSocket (STOMP)** | Team rành Java hơn TS | Phải định nghĩa type hai lần (Java + TS); reconnect và rooms phải tự làm nhiều hơn |
| **Colyseus** | Muốn có sẵn khung room/state sync | Phải học thêm; cơ chế sync tự động khó lọc dữ liệu bí mật theo từng người xem |
| **Firebase Realtime DB / Supabase Realtime** | Muốn không có backend | Logic chia nhóm và giấu spy phải dựa vào security rules phức tạp, dễ lộ thông tin |
| **Next.js** | Cần SSR/SEO | App này toàn trang real-time sau khi join, không hưởng lợi từ SSR |

## 8. Checklist dựng khung tuần 1

- [ ] Khởi tạo pnpm workspace, `tsconfig.base.json`, ESLint + Prettier
- [ ] `packages/core`: types `Lobby`, `Player`, `Group`, `GameModule`; schema Zod cho các event
- [ ] `apps/server`: Fastify + Socket.IO, `lobby:create`, `lobby:join`, `session:resume`, `time:sync`
- [ ] `apps/web`: 4 route, kết nối socket, store Zustand, màn tạo lobby + QR
- [ ] Script dev chạy song song server + web (`pnpm -r --parallel dev`)
- [ ] Test: tạo lobby, 30 client giả lập join, reload một client và vào lại đúng người
- [ ] Deploy bản đầu lên Render/Fly.io, thử join bằng điện thoại thật qua QR
