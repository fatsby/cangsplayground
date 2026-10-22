# PRD — CangsPlayground: Nền tảng minigame real-time cho ESL Speaking Club

| Mục | Nội dung |
|---|---|
| Phiên bản | v1.0 (draft) |
| Ngày | 21/10/2026 |
| Tác giả | Fatsby (PO) |
| Trạng thái | Sẵn sàng review → bắt đầu Phase 1 |
| Tên sản phẩm | CangsPlayground *(tên tạm, đổi tùy ý)* |

---

## 1. Bối cảnh & vấn đề

ESL Speaking Club tổ chức các buổi 60 phút/tuần, khoảng 24 sinh viên trình độ hỗn hợp A2–B2. Minigame (Werewolf/Mafia, Who's the Spy, Survival Challenge…) là công cụ chính để ép học viên nói, nhưng hiện tại vận hành thủ công:

| Pain point | Hậu quả |
|---|---|
| Chia nhóm bằng tay / picker wheel rời rạc | Mất 5–10 phút mỗi buổi, nhóm lệch số người |
| Phát vai bí mật (spy, werewolf) bằng giấy hoặc nhắn riêng | Chậm, dễ lộ, khó chơi lại nhiều vòng |
| Bấm giờ lượt nói bằng điện thoại giáo viên | Không đồng bộ giữa các nhóm, học viên không thấy thời gian |
| Mỗi game dùng 1 công cụ khác nhau | Phải chuyển tab, chia nhóm lại, mất mạch buổi học |
| Giáo viên không có cái nhìn tổng quan | Không biết nhóm nào xong, nhóm nào kẹt |

**Insight cốt lõi:** gần như mọi minigame đều có chung khung *Lobby → Chia nhóm → Phát thông tin (công khai / theo nhóm / bí mật cá nhân) → Lượt chơi có giờ → Kết thúc*. Nếu làm tốt khung này một lần, mỗi game mới chỉ cần viết phần luật riêng.

## 2. Mục tiêu

### 2.1 Goals
1. **G1** — Giáo viên dựng lobby + chia nhóm xong trong **< 2 phút** cho 24 học viên.
2. **G2** — Học viên vào lobby trong **< 30 giây**, không cần tài khoản, không cài app.
3. **G3** — Trạng thái đồng bộ real-time giữa 3 loại màn hình (độ trễ cảm nhận < 500ms trên Wi-Fi trường).
4. **G4** — Thêm một minigame mới **không phải sửa code core** (chỉ thêm 1 module game).

### 2.2 Non-goals (không làm trong v1)
- Tài khoản học viên, lịch sử điểm dài hạn, bảng xếp hạng qua nhiều buổi.
- Voice/video call trong app (học viên nói trực tiếp ngoài đời).
- App native iOS/Android (chỉ mobile web).
- Chấm điểm phát âm/AI đánh giá speaking.
- Nhiều giáo viên cùng điều khiển 1 lobby (chỉ 1 host).

### 2.3 Success metrics (đo sau 4 buổi dùng thật)
| Metric | Target |
|---|---|
| Thời gian từ tạo lobby → bắt đầu game đầu tiên | ≤ 3 phút |
| Tỉ lệ học viên join thành công lần đầu | ≥ 95% |
| Số lần mất kết nối không tự khôi phục / buổi | ≤ 1 |
| Thời gian nói thực tế của học viên / buổi | tăng so với buổi chạy thủ công (đo bằng tổng timer lượt nói) |

## 3. Personas & các view

| Persona | Thiết bị | View | Quyền |
|---|---|---|---|
| **Host (giáo viên)** | Laptop nối máy chiếu | **Projector View** | Chỉ hiển thị thông tin *công khai*. Dùng để tạo lobby. |
| **Host (giáo viên)** | Điện thoại | **Host Console** | Điều khiển toàn bộ + thấy thông tin *bí mật* (spy từng nhóm, vai từng người). |
| **Player (học viên)** | Điện thoại | **Player View** | Chỉ thấy thông tin của mình và nhóm mình. |

> Nguyên tắc vàng: **Projector View không bao giờ chứa thông tin bí mật**, vì cả lớp đều nhìn thấy. Mọi thông tin bí mật chỉ đi tới Host Console hoặc đúng 1 Player.

## 4. User flow tổng

```
[Laptop] Host tạo lobby ──► Projector hiện mã lobby + QR join
                         └─► Projector hiện QR "Host Console" (ghép điện thoại GV)
[ĐT GV] Quét QR host ──► Host Console (đã xác thực host)
[ĐT HV] Quét QR / nhập mã ──► Nhập tên ──► Phòng chờ
Host: cấu hình chia nhóm ──► [Chia nhóm] ──► HV thấy nhóm mình, Projector thấy tất cả nhóm
Host: chọn minigame ──► cấu hình game ──► [Chuẩn bị] (phát vai/thông tin)
Host: [Bắt đầu] ──► các lượt chơi có timer ──► [Kết thúc vòng] ──► Reveal kết quả
Host: chơi vòng mới / chia lại nhóm / đổi minigame (lobby giữ nguyên)
Host: [Đóng lobby]
```

## 5. Phạm vi theo phase

| Phase | Nội dung | Ghi chú |
|---|---|---|
| **Phase 1 — Core Platform (MVP)** | Lobby, join (mã/QR), 3 view, chia nhóm, khung minigame (plugin), timer server-side, reconnect, 1 game "Free Talk Timer" đơn giản để test khung | Mục tiêu: dùng được ngay buổi tới cho việc chia nhóm + bấm giờ |
| **Phase 2 — Who's the Spy** | Logic game đầy đủ + ngân hàng topic | Game đầu tiên chứng minh kiến trúc plugin |
| **Phase 3 — Mở rộng** | Werewolf/Mafia, Survival Challenge, vote trong app, chấm điểm nhóm trong buổi | Mỗi game là 1 module |
| **Backlog** | Host tự thêm topic, export kết quả, đa ngôn ngữ UI, theme | |

---

## 6. Yêu cầu chức năng — Phase 1 (Core)

Ưu tiên: **M** = Must, **S** = Should, **C** = Could.

### 6.1 Lobby

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| LOB-01 | Host tạo lobby không cần đăng nhập; hệ thống sinh **mã 6 ký tự** (chữ in hoa + số, loại bỏ ký tự dễ nhầm: `0/O`, `1/I/L`) | M |
| LOB-02 | Projector View hiển thị mã lobby cỡ lớn + **QR join** (URL dạng `/join/ABC123`) | M |
| LOB-03 | Projector View hiển thị QR "ghép Host Console"; quét bằng điện thoại GV sẽ vào Host Console với **host token** (không đoán được, không dùng chung với link join) | M |
| LOB-04 | Lobby giữ nguyên khi đổi minigame, chia lại nhóm, chơi vòng mới | M |
| LOB-05 | Host khóa/mở lobby (khóa = không cho người mới vào) | S |
| LOB-06 | Host kick người chơi (vd tên trùng, người lạ) | M |
| LOB-07 | Lobby tự hủy sau **3 giờ** không hoạt động; host có nút [Đóng lobby] | M |
| LOB-08 | Giới hạn **60 người chơi/lobby** | M |

### 6.2 Join & danh tính học viên

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| JOIN-01 | Join bằng quét QR (tự điền mã) hoặc nhập mã thủ công | M |
| JOIN-02 | Nhập tên hiển thị 1–20 ký tự; trùng tên trong lobby → báo lỗi, gợi ý thêm số | M |
| JOIN-03 | Sau khi join, server cấp **player session token** lưu ở `localStorage`; reload trang / mất mạng → tự vào lại đúng người, đúng nhóm, đúng vai | M |
| JOIN-04 | Phòng chờ hiển thị tên mình, số người đã vào, trạng thái "Chờ giáo viên chia nhóm" | M |
| JOIN-05 | Người vào muộn (khi đã chia nhóm) ở trạng thái **Chưa có nhóm**; host có thể thêm thủ công vào nhóm hoặc để lần chia sau | M |
| JOIN-06 | Projector hiển thị danh sách người đã join real-time | M |

### 6.3 Chia nhóm

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| GRP-01 | Host chọn 1 trong 2 chế độ: **(a) Số nhóm = N** hoặc **(b) Tối đa K người/nhóm** | M |
| GRP-02 | Preview trước khi chia: "24 người → 4 nhóm × 6" hoặc "25 người, tối đa 6 → 5 nhóm (5,5,5,5,5)" | M |
| GRP-03 | Nút [Chia nhóm]; nếu đã có nhóm, nút đổi thành [Chia lại] kèm xác nhận nếu đang có game chạy | M |
| GRP-04 | Thuật toán: xáo ngẫu nhiên, chia **cân bằng** (chênh lệch tối đa 1 người giữa các nhóm) | M |
| GRP-05 | Chế độ (b): số nhóm = `ceil(n / K)`, rồi chia đều — tránh trường hợp nhóm cuối chỉ 1–2 người | M |
| GRP-06 | Nhóm có tên + màu riêng (vd Team Red, Team Blue…) để học viên dễ tìm nhau trong phòng | M |
| GRP-07 | Hiệu ứng "quay" ngắn (~2 giây) trên Projector khi chia, giống picker wheel | S |
| GRP-08 | Host kéo-thả / chuyển 1 người sang nhóm khác trên Host Console | S |
| GRP-09 | Tùy chọn "hạn chế trùng nhóm với lần chia trước" | C |
| GRP-10 | Validate: số nhóm ≥ 1, mỗi nhóm ≥ `minPlayersPerGroup` của game đã chọn (nếu có); không đạt → cảnh báo | M |

**Player View sau khi chia:** toàn màn hình màu nhóm, tên nhóm cỡ lớn, danh sách thành viên.
**Projector View:** lưới các nhóm, mỗi ô gồm màu, tên nhóm, thành viên.

### 6.4 Khung minigame

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| GAME-01 | Host chọn minigame từ danh sách (card: tên, mô tả ngắn, số người/nhóm khuyến nghị) | M |
| GAME-02 | Mỗi game có màn **cấu hình** riêng do module game định nghĩa (vd topic, thời gian lượt nói) | M |
| GAME-03 | Vòng đời chuẩn mọi game: `CONFIGURING → PREPARED → RUNNING ⇄ PAUSED → ROUND_END → (vòng mới \| thoát game)` | M |
| GAME-04 | Host điều khiển: [Chuẩn bị], [Bắt đầu], [Tạm dừng/Tiếp tục], [Bỏ qua lượt], [Kết thúc vòng], [Reveal], [Vòng mới], [Thoát game] | M |
| GAME-05 | Game chạy **song song cho mọi nhóm**; host có thể điều khiển tất cả cùng lúc hoặc từng nhóm | M (tất cả) / S (từng nhóm) |
| GAME-06 | Thoát game → quay về màn chọn game, giữ nguyên nhóm | M |
| GAME-07 | Game "Free Talk Timer" (Phase 1): mỗi nhóm xoay vòng lượt nói theo thứ tự, mỗi lượt X giây, host nhập câu hỏi/chủ đề chung hiển thị trên Projector | M |

### 6.5 Timer & lượt nói (dùng chung cho mọi game)

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| TMR-01 | Timer là **server-authoritative**: server gửi `endsAt` (timestamp), client tự đếm ngược theo đồng hồ đã hiệu chỉnh lệch giờ | M |
| TMR-02 | Turn rotation: thứ tự nói trong nhóm được random khi bắt đầu, hiển thị "Đang nói: A — Tiếp theo: B" | M |
| TMR-03 | Hết giờ → tự chuyển lượt; Player đang tới lượt thấy màn hình nổi bật "YOUR TURN" + rung (nếu trình duyệt hỗ trợ) | M |
| TMR-04 | Host có thể +30s, bỏ qua lượt, tạm dừng toàn bộ | M |
| TMR-05 | Người đang tới lượt có nút [Xong] để kết thúc lượt sớm | S |
| TMR-06 | Người mất kết nối vẫn giữ lượt (giáo viên quyết định skip) | M |

### 6.6 Ba view chi tiết

**Projector View (laptop, 16:9, đọc được từ cuối lớp)**
- Header: mã lobby + QR nhỏ (luôn hiện để người muộn join), tên game hiện tại, trạng thái.
- Body: lưới nhóm — với mỗi nhóm: màu, tên, người đang nói, timer đếm ngược, số vòng.
- Thông tin công khai của game (vd category "Location" của Who's the Spy — **không** hiện topic).
- Font tối thiểu 24px cho nội dung, 48px+ cho timer.

**Host Console (điện thoại GV)**
- Tab **Players**: danh sách, trạng thái online/offline, kick, chuyển nhóm.
- Tab **Groups**: cấu hình + chia nhóm.
- Tab **Game**: chọn game, cấu hình, nút điều khiển vòng đời, timer controls.
- Tab **Secrets**: thông tin bí mật theo nhóm (vd spy của từng nhóm, topic). Mặc định **ẩn**, phải chạm-giữ để xem (tránh lộ khi GV cầm đt đi quanh lớp).

**Player View (điện thoại HV)**
- Luôn thấy: tên mình, nhóm mình (màu nền), trạng thái game.
- Thẻ thông tin bí mật cá nhân (vd "You are the SPY" / "Location: Airport") dạng **chạm để lật, thả để úp** — chống bị nhìn trộm.
- Khi tới lượt: màn hình nổi bật + timer.
- Trạng thái mất kết nối: banner "Reconnecting…".

---

## 7. Kiến trúc mở rộng minigame (Game Module Contract)

Mục tiêu G4: core không biết luật game cụ thể. Mỗi game là một module implement interface chung.

```ts
interface GameModule<Config, GroupState> {
  id: string;                    // "whos-the-spy"
  name: string;
  description: string;
  minPlayersPerGroup: number;    // core dùng để validate chia nhóm
  maxPlayersPerGroup?: number;
  configSchema: JSONSchema;      // core tự render form cấu hình trên Host Console

  // Server-side logic
  prepare(config: Config, group: Group, rng: RNG): GroupState;          // phát vai
  onAction(state: GroupState, action: GameAction, actor: Actor): GroupState; // vote, done-turn…
  onTimerEnd?(state: GroupState): GroupState;

  // Lọc dữ liệu theo người xem — BẮT BUỘC
  viewFor(state: GroupState, viewer: Viewer): object;
  // viewer.kind ∈ "projector" | "host" | "player"(+playerId)

  // Client-side
  components: {
    HostConfig?, ProjectorGroupCard, HostGroupPanel, PlayerScreen
  };
}
```

**Quy tắc bảo mật dữ liệu (quan trọng nhất của kiến trúc):**
- Server giữ **toàn bộ state**; client không bao giờ nhận state đầy đủ.
- Mọi bản cập nhật gửi ra đều đi qua `viewFor()` → mỗi socket chỉ nhận đúng phần mình được thấy.
- Lý do: học viên ESL hoàn toàn có thể mở DevTools trên laptop/điện thoại; nếu broadcast cả state thì spy bị lộ.

**Phân tầng hiển thị:**

| Mức | Ai thấy | Ví dụ |
|---|---|---|
| `public` | Mọi người, kể cả Projector | Tên game, category, timer, ai đang nói |
| `group` | Thành viên nhóm + host | Thứ tự lượt nói của nhóm |
| `private` | 1 player + host | Vai của bạn, topic của bạn |
| `host` | Chỉ host | Spy của tất cả các nhóm |

---

## 8. Đặc tả game: Who's the Spy (Phase 2)

> Phần này định nghĩa trước để kiểm chứng kiến trúc ở mục 7. Code ở Phase 2.

### 8.1 Cấu hình (Host Console)
| Trường | Kiểu | Mặc định |
|---|---|---|
| Category | chọn 1: Location, Food, Job, Animal, Object… | Location |
| Topic | chọn cụ thể (vd Airport) **hoặc** "Random trong category" | Random |
| Dùng chung topic cho mọi nhóm? | bool | Có |
| Số spy mỗi nhóm | 1 (nhóm ≥ 8 người cho phép 2) | 1 |
| Thời gian mỗi lượt nói | 30–120s | 60s |
| Số vòng nói | 1–3 | 2 |
| Spy có được biết category không? | bool | Có (dễ hơn cho A2) |

### 8.2 Luồng
1. Host [Chuẩn bị] → server random spy trong **từng nhóm**, gán topic.
2. Player non-spy: thẻ lật hiện "Location: **Airport**" (+ ảnh minh họa, gợi ý từ vựng — S).
   Player spy: thẻ lật hiện "You are the **SPY**" (+ category nếu bật).
3. Host Console tab Secrets: "Team Red — Spy: Minh; Team Blue — Spy: Lan…".
4. Projector: "Who's the Spy — Category: Location" + lưới nhóm, **không** hiện topic.
5. Host [Bắt đầu] → turn rotation 60s/người theo vòng (dùng TMR-xx).
6. Hết số vòng → `ROUND_END`. Thảo luận & vote (Phase 2: vote ngoài đời, host bấm [Reveal]; Phase 3: vote trong app).
7. [Reveal] → Projector hiện spy + topic của từng nhóm.
8. [Vòng mới] → random spy mới (ưu tiên người chưa làm spy), topic mới.

### 8.3 Ngân hàng topic
- Lưu dạng file JSON trong repo, có trường `level` (A2/B1/B2) và `vocabHints` (3–5 từ gợi ý).
- Tối thiểu khi ra Phase 2: 5 category × 15 topic.

---

## 9. Ghi chú các game Phase 3 (để kiểm tra contract đủ linh hoạt)

| Game | Yêu cầu đặc thù với core |
|---|---|
| Werewolf / Mafia | Pha ngày/đêm; hành động bí mật theo vai (sói chọn nạn nhân, tiên tri soi) → cần `onAction` với quyền theo vai; người chơi bị "loại" vẫn ở lobby |
| Survival Challenge | Kịch bản + danh sách vật phẩm chung cho nhóm, nhóm thảo luận rồi chọn → cần state cấp nhóm + vote cấp nhóm |
| Vote trong app | Thành phần dùng chung: `VotePanel` (single/multi choice, ẩn/hiện kết quả) |

---

## 10. Real-time & giao thức

### 10.1 Rooms (Socket.IO)
| Room | Thành viên |
|---|---|
| `lobby:{code}:public` | Projector + tất cả player + host |
| `lobby:{code}:host` | Host Console |
| `lobby:{code}:group:{groupId}` | Thành viên nhóm |
| `player:{playerId}` | 1 player (mọi tab/thiết bị của người đó) |

### 10.2 Sự kiện chính
| Hướng | Event | Payload |
|---|---|---|
| C→S | `lobby:create` | — → `{ code, hostToken }` |
| C→S | `lobby:join` | `{ code, name }` → `{ playerToken }` |
| C→S | `session:resume` | `{ token }` |
| C→S (host) | `groups:assign` | `{ mode: "count" \| "maxSize", value }` |
| C→S (host) | `groups:move` | `{ playerId, toGroupId }` |
| C→S (host) | `game:select` / `game:configure` | `{ gameId }` / `{ config }` |
| C→S (host) | `game:control` | `{ cmd: "prepare"\|"start"\|"pause"\|"resume"\|"skip"\|"extend"\|"endRound"\|"reveal"\|"nextRound"\|"exit", groupId? }` |
| C→S (player) | `game:action` | `{ type, payload }` (vd `turn:done`, `vote`) |
| S→C | `state:sync` | Snapshot đã lọc theo viewer (gửi khi connect/reconnect) |
| S→C | `state:patch` | Thay đổi đã lọc theo viewer |
| S→C | `time:sync` | `{ serverNow }` để hiệu chỉnh lệch đồng hồ |

### 10.3 Nguyên tắc
- Server là **single source of truth**; client chỉ gửi *ý định*, server validate quyền (host token / player token) rồi mới đổi state.
- Mỗi lệnh host có `commandId` để idempotent (bấm 2 lần không chia nhóm 2 lần).
- Reconnect: client gửi `session:resume` → nhận `state:sync` đầy đủ.

---

## 11. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-01 | Hỗ trợ ≥ 60 player + 2 host view / lobby; ≥ 10 lobby đồng thời trên 1 instance nhỏ |
| NFR-02 | Độ trễ sự kiện server → client p95 < 300ms trên mạng LAN/Wi-Fi |
| NFR-03 | Chạy tốt trên Chrome/Safari mobile 2 phiên bản gần nhất; màn hình từ 360px |
| NFR-04 | Tải trang Player < 200KB JS gzip lần đầu (Wi-Fi trường yếu) |
| NFR-05 | Tự reconnect trong 30s mà không mất vai/nhóm; offline > 5 phút → đánh dấu "away" |
| NFR-06 | Host token & player token là chuỗi ngẫu nhiên ≥ 128-bit; mã lobby có rate-limit thử join (chống dò mã) |
| NFR-07 | Không thu thập dữ liệu cá nhân ngoài tên hiển thị; xóa toàn bộ dữ liệu lobby khi đóng/hết hạn |
| NFR-08 | UI tiếng Anh (môi trường ESL), câu chữ đơn giản cấp A2 |
| NFR-09 | Projector View đọc rõ từ khoảng cách 8m; tương phản màu đạt WCAG AA; màu nhóm phân biệt được cả với người mù màu (kèm tên/ký hiệu) |

## 12. Mô hình dữ liệu (in-memory, Phase 1)

```
Lobby      { code, hostToken, status, locked, createdAt, lastActiveAt,
             players: Map<playerId, Player>, groups: Group[], currentGame?: GameSession }
Player     { id, token, name, groupId?, connected, lastSeenAt }
Group      { id, name, color, playerIds[] }
GameSession{ gameId, config, phase, round, groupStates: Map<groupId, GroupState> }
GroupState { phase, turnOrder[], currentTurnIndex, timer: { endsAt?, pausedRemaining? }, gameData }
```

Phase 1 lưu RAM (1 instance). Khi cần scale/khởi động lại không mất lobby → chuyển state sang Redis + Socket.IO Redis adapter.

## 13. Đề xuất kỹ thuật

| Lớp | Đề xuất | Lý do |
|---|---|---|
| Backend | Node.js + TypeScript + Socket.IO | Rooms, auto-reconnect, fallback có sẵn; chia sẻ type với frontend |
| Frontend | React + Vite (hoặc Next.js) + TypeScript | 1 codebase cho 3 view theo route: `/display/:code`, `/host/:code`, `/play/:code` |
| Monorepo | `packages/core`, `packages/games/*`, `apps/server`, `apps/web` | Mỗi game là 1 package → đúng mục tiêu mở rộng |
| QR | `qrcode` (render phía client) | |
| Deploy | 1 VPS/Render/Fly.io có hỗ trợ WebSocket, HTTPS | Mobile browser cần HTTPS cho một số API (rung, wake lock) |
| Test | Unit test thuật toán chia nhóm & `viewFor`; e2e mô phỏng 30 client socket | |

*(Nếu team quen Java hơn: Spring Boot + WebSocket/STOMP vẫn đáp ứng được, nhưng sẽ mất lợi thế chia sẻ type giữa game logic và UI.)*

## 14. Edge cases cần xử lý

| Tình huống | Hành vi mong muốn |
|---|---|
| Host đóng tab laptop | Lobby vẫn sống; mở lại `/display/:code` để hiện lại |
| Host mất điện thoại / hết pin | Quét lại QR host trên Projector (cần xác nhận từ laptop) |
| HV mở 2 tab | Cùng token → cùng 1 người, không tạo trùng |
| HV đổi điện thoại giữa chừng | Host kick người cũ, HV join lại với tên mới |
| Spy rời lobby giữa vòng | Host Console cảnh báo; host chọn kết thúc vòng hoặc tiếp tục |
| Chia lại nhóm khi game đang chạy | Xác nhận → game của mọi nhóm bị hủy, về màn chọn game |
| Số người < `minPlayersPerGroup` × số nhóm | Chặn [Chuẩn bị], gợi ý giảm số nhóm |
| Mất mạng toàn lớp vài giây | Timer tiếp tục theo `endsAt` của server; client đồng bộ lại khi có mạng |

## 15. Câu hỏi mở (cần chốt trước khi code)

1. Projector có cần hiện **cả topic** sau khi Reveal không, hay chỉ hiện spy?
2. Có cần chế độ **Projector mirror 1 nhóm** (phóng to 1 nhóm cho cả lớp xem) không?
3. Thứ tự lượt nói: random mỗi vòng hay giữ cố định cả game?
4. Có muốn chấm **điểm nhóm** trong buổi (vd đoán đúng spy +1) ngay từ Phase 2 không?
5. Host lưu "preset" cấu hình (vd 4 nhóm + Spy 60s) giữa các buổi — cần localStorage hay không cần?
6. Deploy ở đâu, ai trả chi phí server, có domain riêng không?

## 16. Milestones đề xuất

| Tuần | Deliverable | Demo được |
|---|---|---|
| 1 | Skeleton monorepo, Socket.IO server, tạo/join lobby, 3 route view | Cả lớp join bằng QR |
| 2 | Chia nhóm (2 chế độ), reconnect, kick, Projector grid | Dùng thật để chia nhóm trong buổi |
| 3 | Game module contract + timer/turn rotation + Free Talk Timer | Chạy speaking round có giờ cho mọi nhóm |
| 4 | Hardening: test 30 client giả lập, xử lý edge case, polish UI | **Release Phase 1** |
| 5–6 | Who's the Spy + ngân hàng topic | **Release Phase 2** |

## 17. Acceptance criteria — Phase 1 (Definition of Done)

- [ ] 24 điện thoại thật join qua QR trong 1 phút, không ai phải nhập mã tay.
- [ ] Chia 24 người thành 4 nhóm → mỗi điện thoại hiện đúng nhóm trong < 1 giây; Projector khớp.
- [ ] "Tối đa 7 người/nhóm" với 24 người → 4 nhóm (6,6,6,6), không có nhóm lẻ.
- [ ] Reload trang Player giữa game → về đúng nhóm, đúng lượt, timer đúng ±1s.
- [ ] Mở DevTools trên Player/Projector không thấy dữ liệu `host`/`private` của người khác.
- [ ] Đổi game và chia lại nhóm nhiều lần mà không cần tạo lobby mới.
- [ ] Thêm một game mẫu thứ 2 chỉ bằng cách tạo package mới trong `packages/games/` và đăng ký vào registry.
