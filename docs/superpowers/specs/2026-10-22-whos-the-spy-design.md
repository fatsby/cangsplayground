# Who's the Spy — thiết kế

Ngày: 2026-10-22 · Trạng thái: chờ duyệt

Ghi chú: mục nào ghi **(Claude quyết)** là lựa chọn của người viết, chưa được người dùng xác nhận riêng. Những mục khác là người dùng đã chốt.

## 1. Mục đích

Thêm minigame thứ ba vào app, sau Free Talk Timer và Secret Word. Đây là trò "tìm gián điệp" dùng trong lớp ESL. Mỗi nhóm có một hoặc vài spy không biết topic. Những người còn lại (dân) biết topic, lần lượt nói về nó bằng tiếng Anh nhưng không được nói thẳng tên. Sau 2 vòng nói, cả nhóm vote để loại người bị nghi là spy.

Game tạo ra lý do để học viên nói, nghe kỹ và mô tả bằng từ vựng theo chủ đề. Giáo viên nắm nhịp chơi. Màn máy chiếu chỉ hiện thông tin công khai.

## 2. Mục tiêu, không làm, và những điều phải tránh

**Mục tiêu**
- Giáo viên chọn một topic có sẵn (hoặc để random), chọn số spy mỗi nhóm, rồi bấm bắt đầu. Mọi thứ còn lại app lo.
- Mỗi học viên nhận vai bí mật trên điện thoại của mình.
- Học viên nói xoay vòng, mỗi lượt 1 phút. Sau 2 vòng thì vote có giới hạn thời gian, loại một người, và công khai người đó có phải spy hay không.
- Game có điểm kết thúc rõ ràng:
  - **Team wins** khi bắt hết spy.
  - **Spy wins** khi số dân còn lại ≤ số spy còn lại, hoặc khi hết thời gian tổng mà vẫn còn spy.

**Không làm (non-goals)**
- Giáo viên tự thêm topic hoặc category. Bộ topic là cố định.
- Spy đoán topic để thắng.
- Tính điểm hay bảng xếp hạng qua nhiều ván.
- Chat hay nhắn tin trong app.

**Phải tránh (anti-goals): mắc một trong các lỗi này là hỏng, dù về kỹ thuật app vẫn chạy**
- Lộ topic cho spy. Lộ vai spy cho người khác. Lộ topic hay tên spy lên máy chiếu. Phải giữ đúng quy tắc phân tầng hiển thị của PRD §7 (`viewFor`): dữ liệu bí mật không được gửi xuống client không có quyền xem, chứ không chỉ là ẩn trên giao diện.
- Học viên đứng nhìn màn hình mà không biết đang chờ gì. Màn nào cũng phải nói rõ bước tiếp theo, ví dụ "Wait for your teacher…".
- Làm hỏng Free Talk hoặc Secret Word khi mở rộng phần lõi.

## 3. Luật chơi

### 3.1 Cài đặt (giáo viên, ở tab Game của Host Console)
| Mục | Giá trị |
|---|---|
| Category | `Location` hoặc `Food` |
| Topic | Một topic trong category đã chọn, hoặc **Random**: app tự chọn khi bấm Prepare **(Claude quyết)** |
| Spies per group | Mặc định 1, tối thiểu 1 |
| Game time (đồng hồ tổng) | Mặc định 12 phút, khoảng 5–30 phút, bước 1 phút **(Claude quyết)** |
| Each turn | Mặc định 60 giây, khoảng 15–300 giây, bước 15 giây. Chỉnh được giống hai game hiện có **(Claude quyết)** |

- Cả lớp dùng **chung một topic** **(Claude quyết)**.
- Số vòng nói trước mỗi lần vote cố định là **2**. Thời gian vote cố định là **30 giây**.

### 3.2 Điều kiện nhóm
- Mỗi nhóm phải có **ít nhất 3 người** (`minPlayersPerGroup: 3`).
- Số spy phải **ít hơn** số dân trong nhóm, tức `spies ≤ floor((n − 1) / 2)`. Nhóm 3–4 người chỉ có tối đa 1 spy, nhóm 5–6 người tối đa 2 spy.
- Nếu một nhóm quá nhỏ so với số spy đã chọn thì **chặn Prepare** và báo rõ, ví dụ "Team Red has 4 players. 2 spies need at least 5." **(Claude quyết)**. App không âm thầm giảm số spy.

### 3.3 Phát vai
- Khi giáo viên bấm Prepare, app random spy riêng cho từng nhóm.
- **Dân** thấy tên topic, category và 4 từ vựng gợi ý.
- **Spy** thấy "You are the SPY" và category (ví dụ "Category: Location"), không thấy topic.
- Spy **không biết** ai là spy còn lại **(Claude quyết)**.
- Vai giữ nguyên suốt ván. Không phát lại vai giữa các lần vote.

### 3.4 Nhịp chơi của một nhóm
1. Giáo viên bấm **Start**. Đồng hồ tổng bắt đầu chạy và nhóm vào lượt nói.
2. Học viên nói lần lượt, mỗi lượt 1 phút. Có thể bấm "I'm done" để kết thúc lượt sớm, giống hai game hiện có. Thứ tự nói được xáo ngẫu nhiên một lần khi Prepare, sau đó giữ nguyên cho cả ván **(Claude quyết)**. Người đã bị loại bị bỏ qua.
3. Sau **2 vòng** (mỗi người còn trong game nói 2 lần), màn **vote** tự mở cho nhóm đó.
4. Vote:
   - Kéo dài **30 giây**.
   - Chỉ người còn trong game được vote, và không vote được cho chính mình.
   - Chọn một người rồi bấm "Lock my vote". Đã khóa thì không đổi được **(Claude quyết)**.
   - Nếu mọi người còn trong game đã khóa vote trước khi hết giờ thì chốt sớm **(Claude quyết)**.
   - Hết 30 giây mà ai chưa vote thì coi như bỏ phiếu trắng.
5. Kết quả vote:
   - Người nhiều phiếu nhất bị loại. App công khai cho cả nhóm biết người đó **có phải spy hay không**, kèm số phiếu của từng người.
   - **Hòa phiếu hoặc không ai vote thì không loại ai** **(Claude quyết)**.
6. Sau kết quả:
   - Nếu không còn spy nào thì nhóm kết thúc với **Team wins**.
   - Nếu **số dân còn lại ≤ số spy còn lại** thì nhóm kết thúc ngay với **Spy wins**. Ví dụ: chỉ còn 1 dân và 1 spy, hoặc chỉ còn spy. Lúc Prepare luôn có spy < dân (§3.2), nên luật này chỉ có thể xảy ra sau khi có người bị loại.
   - Nếu không rơi vào hai trường hợp trên thì nhóm **đứng chờ** ở màn kết quả cho đến khi giáo viên bấm **Continue** cho nhóm đó (từng nhóm, hoặc tất cả nhóm đang chờ). Sau đó nhóm nói thêm 2 vòng và quay lại bước 3.
7. Hết đồng hồ tổng:
   - Mọi nhóm chưa xong kết thúc **ngay lập tức** với **Spy wins**, kể cả khi đang nói dở hay vote dở **(Claude quyết)**.
   - Nhóm nào đã xong thì giữ nguyên kết quả.

Mỗi nhóm chạy theo nhịp riêng. Nhóm này có thể đang vote trong khi nhóm khác đang nói.

### 3.5 Đồng hồ tổng
- Dùng **chung cho cả lớp**. Bắt đầu chạy khi bấm Start lần đầu.
- **Tạm dừng khi giáo viên bấm Pause cho cả lớp**, tức lệnh pause không kèm `groupId`. Bấm Resume thì chạy tiếp **(Claude quyết)**. Pause riêng một nhóm không làm dừng đồng hồ tổng.
- Hiện nhỏ ở góc màn hình điện thoại, trên Host Console, và hiện to trên máy chiếu.

### 3.6 Người bị loại
- Không nói và không vote nữa, bị bỏ qua khi tới lượt.
- Vẫn ở trong nhóm để theo dõi: màn "You're out" hiện ai đang nói, thời gian còn lại của lượt, và những ai còn trong game.
- **Thẻ bí mật bị ẩn** khi đã bị loại **(Claude quyết)**.

### 3.7 Kết thúc
- Màn kết thúc trên điện thoại của nhóm hiện: thắng hay thua, topic là gì, và tên tất cả spy.
- Màn kết thúc của nhóm giữ nguyên cho đến khi giáo viên bấm **Exit** game (lệnh có sẵn). "Next round" không áp dụng cho game này. Muốn chơi ván mới thì Exit rồi chọn lại game **(Claude quyết)**.

## 4. Ai thấy gì

| Thông tin | Máy chiếu | Dân | Spy | Người đã bị loại | Host |
|---|---|---|---|---|---|
| Category | ✓ | ✓ | ✓ | ✓ | ✓ |
| Topic + từ gợi ý | ✗ (kể cả khi đã xong) | ✓ | ✗ | ✗ khi đang chơi; ✓ khi nhóm xong | ✓ |
| Ai là spy | ✗ (kể cả khi đã xong) | ✗ khi đang chơi; ✓ khi nhóm xong | ✗ (không biết spy khác) | ✗ khi đang chơi; ✓ khi nhóm xong | ✓ (tab Secrets, giữ để xem) |
| Ai đã vote (không phải vote cho ai) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vote cho ai, trong lúc vote | ✗ | chỉ phiếu của mình | chỉ phiếu của mình | ✗ | ✓ **(Claude quyết)** |
| Số phiếu + người bị loại có phải spy không | người bị loại bị gạch tên; không ghi có phải spy **(Claude quyết)** | ✓ | ✓ | ✓ | ✓ |
| Kết quả nhóm (Team/Spy wins) | ✓ | ✓ | ✓ | ✓ | ✓ |

Theo PRD §7, phần lọc này phải nằm trong `viewFor` ở server.

## 5. Màn hình (style Arcade Night)

App web hiện đã dùng bộ UI Arcade Night. Mọi màn của game này dùng token và component có sẵn trong `packages/ui`: `SecretCard`, `TurnIndicator`, `Panel`, `Chip`, badge màu nhóm, timer tròn, v.v. Không thêm style riêng nếu component có sẵn đã làm được.

Tài liệu tham khảo đặt cạnh spec này:
- `2026-10-22-whos-the-spy/style-preview.html`: bản "ClubPlay Style Preview" do người dùng cung cấp. Xem ở `#arcade`. Những màn **đã có ở đây thì làm theo đúng**:
  - Projector View: thẻ nhóm có màu nhóm, timer lượt, người đang nói được tô sáng, chip "Category: Location"
  - Nhận nhóm
  - Thẻ bí mật giữ để lật. Nội dung chỉ được render khi đang giữ. Mặt của dân: topic và 4 từ gợi ý dạng chip. Mặt của spy: "You are the SPY" và chip category
  - YOUR TURN: nền accent, timer tròn đổi màu khi còn ≤10 giây và ≤5 giây, nút "I'm done"
  - Host Console, tab Secrets: giữ một dòng để bỏ làm mờ, xem "Spy: … / Topic: …" của từng nhóm
- `2026-10-22-whos-the-spy/new-screens.html`: mockup các màn **chưa có** trong preview, cùng style:
  - Vote: danh sách người còn trong game (trừ chính mình), thanh "4 of 6 voted", nút "Lock my vote", đồng hồ đếm ngược 30 giây (mockup thiếu đồng hồ này, nhớ thêm vào)
  - Kết quả vote: "Voted out · Bảo · was NOT the spy" hoặc "was a SPY!", bảng số phiếu, "N spy left. 2 more rounds, then vote again.", "Wait for your teacher…"
  - You're out
  - Team wins, Spy wins. Dòng phụ trên màn Spy wins phải nói đúng lý do thắng: "Time's up. A spy is still in the game." nếu hết giờ, hoặc kiểu "The spies outnumber the team." nếu dân ≤ spy
  - Host, phần cài game: category, topic dạng chip có thêm 🎲 Random, số spy (có gợi ý giới hạn), game time, each turn
  - Host, phần theo dõi: trạng thái từng nhóm (Speaking / Voting x/y / Waiting for Continue / Won). Nút chính theo ngữ cảnh: **Continue** cho nhóm đang chờ
  - Projector: đồng hồ tổng to ở góc phải tiêu đề, người bị loại bị gạch tên, nhóm đang vote có dấu ✓ cạnh người đã vote, nhóm đã xong hiện "Team wins!" hoặc "Spy wins!"

Toàn bộ chữ trong giao diện là **tiếng Anh**, giống phần còn lại của app.

## 6. Bộ topic

- File dữ liệu nằm trong package game, tương tự `packages/games/secret-word/data/words.json`.
- Có 2 category, mỗi category **15–20 topic** **(Claude quyết)**. Mỗi topic gồm tên tiếng Anh và **4 từ gợi ý** cho dân, ví dụ Airport → passport, gate, luggage, boarding pass.
- Độ khó từ vựng khoảng A2–B1 để hợp lớp ESL **(Claude quyết)**.
- Gợi ý cho Location: Airport, Police station, Hospital, School, Beach, Supermarket, Restaurant, Cinema, Library, Zoo, Hotel, Bank, Train station, Park, Gym, Museum… Gợi ý cho Food: Pizza, Burger, Sushi, Pho, Ice cream, Fried chicken, Salad, Spaghetti, Sandwich, Banh mi, Hot pot, Pancake, Noodle soup, Steak, Fried rice, Cake…

## 7. Phần lõi cần mở rộng

Lõi hiện tại (`GameModule` trong `packages/core/src/game.ts`, `Lobby` trong `apps/server/src/lobby/Lobby.ts`, `TimerService`) đã có:
- lượt nói xoay vòng, có timer
- `turnsPerPlayer`
- `turn:done`
- `onAction` cho thao tác người chơi
- `viewFor` để lọc dữ liệu theo người xem
- các lệnh điều khiển `start`, `pause`, `resume`, `skip`, `extend`, `endRound`, `reveal`, `nextRound`, `exit`

Game này cần thêm 4 thứ. **Cách cài đặt do người làm quyết**, miễn thỏa các yêu cầu dưới đây và giữ nguyên hành vi của Free Talk và Secret Word.

1. **Đồng hồ tổng của cả game**
   - Game khai báo độ dài, ví dụ thêm một hook tùy chọn trên `GameModule`. Game không khai báo thì không có đồng hồ này.
   - Server là nơi giữ giờ chuẩn: dùng `TimerService` hoặc cơ chế tương đương. Sau khi reconnect thì client hiển thị đúng thời gian còn lại.
   - Pause và Resume theo quy tắc ở §3.5.
   - Khi hết giờ, gọi game để kết thúc các nhóm chưa xong.
   - Thông tin này thuộc tầng công khai, ví dụ nằm trong `GameSessionView`.
2. **Loại người chơi khỏi lượt nói**
   - Game cần cách để báo cho lõi biết bỏ một người khỏi `turnOrder`, từ lượt kế tiếp trở đi.
   - Đã có sẵn `removeTurns` (private) cho trường hợp người chơi rời lobby, có thể tái dùng.
   - Mỗi chu kỳ 2 vòng mới chỉ gồm những người còn trong game.
3. **Giai đoạn vote có timer 30 giây**
   - Một giai đoạn sau khi hết lượt nói, có timer do server giữ.
   - Trong giai đoạn này nhận `onAction` (vote), và chốt khi hết giờ hoặc khi đã đủ phiếu.
   - Pause, Resume và Extend nên áp dụng được cho timer vote **(Claude quyết)**. Skip trong lúc vote có nghĩa là chốt vote ngay.
   - Có thể là một `GamePhase` mới hoặc một cơ chế "timed step" chung trong lõi. Người làm chọn. Nhớ cập nhật `canControl` / `mainControl` trong `apps/web/src/components/game-controls.ts` và `HostGame.tsx`.
   - **Các nút host có sẵn** trong game này **(Claude quyết)**:
     - **End round** đổi nhãn thành **Vote now**: bỏ các lượt nói còn lại và mở vote ngay. Đây là lối tắt khi giáo viên thiếu thời gian.
     - **Reveal** và **Next round** bị ẩn. Continue thay cho Next round.
     - Không nút nào được làm lộ topic hay spy lên máy chiếu.
4. **Continue không phát lại vai, và trạng thái nhóm đã xong**
   - `nextRound` hiện tại gọi lại `prepare`, tức phát lại vai. Game này cần một bước "chơi tiếp" giữ nguyên `data` (vai, người bị loại), chỉ dựng lại `turnOrder` từ những người còn trong game.
   - Cần trạng thái nhóm **đã xong**: không nhận Start, Continue hay vote nữa.
   - Nhãn nút phía host là **Continue**.

Còn lại các phần cố định của game: cấu hình (zod `configSchema` + `configFields`), `prepare` (random spy theo số đã chọn), `onAction` (vote), `viewFor` theo bảng ở §4, các view `ProjectorHeader`, `ProjectorGroupCard`, `HostGroupPanel`, `PlayerScreen`, và đăng ký game ở `apps/server/src/games/registry.ts` và `apps/web/src/games/registry.ts`.

**Ô chọn topic theo category.** `ConfigField` hiện chỉ có `number | text | textarea | boolean | select`. Ô topic cần đổi danh sách theo category đã chọn và có thêm lựa chọn Random. Người làm có thể thêm một kiểu field mới, hoặc dùng `select` với option có điều kiện. Kiểm tra số spy so với kích thước nhóm phải chạy ở server khi Prepare (§3.2).

## 8. Các trường hợp đặc biệt
- **Người chơi mất kết nối:** vẫn tính là còn trong game. Tới lượt mà không nói thì timer chạy hết như bình thường. Không vote thì coi như phiếu trắng.
- **Người chơi rời lobby hoặc bị kick:**
  - Bỏ người đó khỏi lượt nói và khỏi danh sách vote.
  - Sau đó kiểm tra lại điều kiện thắng ở §3.4 bước 6, áp dụng ngay cả khi đang không trong lúc vote:
    - Nếu người rời đi là spy cuối cùng thì nhóm kết thúc với **Team wins** **(Claude quyết)**.
    - Nếu sau khi người đó rời đi, số dân còn lại ≤ số spy còn lại thì nhóm kết thúc với **Spy wins**.
  - Ngoài hai trường hợp trên thì nhóm chơi tiếp, kể cả khi còn dưới 3 người **(Claude quyết)**.
- **Người chơi vào lobby giữa ván:** không được thêm vào nhóm đang chơi, giống hai game hiện có.
- **Hết đồng hồ tổng đúng lúc đang vote:** bỏ phiếu đang dở, nhóm kết thúc với Spy wins (§3.4 bước 7).

## 9. Kiểm thử
- Test logic của game, tương tự `packages/games/*/test/logic.test.ts`:
  - random đúng số spy
  - giới hạn số spy so với kích thước nhóm
  - đếm phiếu, xử lý hòa, phiếu trắng
  - điều kiện thắng: bắt hết spy, dân ≤ spy (cả sau vote lẫn sau khi có người rời lobby), hết đồng hồ tổng
  - `viewFor` không lộ topic hay spy cho người không được xem, đối chiếu với từng dòng của bảng §4
- Test lõi cho từng mở rộng ở §7: đồng hồ tổng (pause, hết giờ), loại người khỏi lượt nói, timer vote (chốt sớm, hết giờ), Continue giữ nguyên vai.
- Test hồi quy: các test hiện có của server, web, Free Talk và Secret Word vẫn pass.
- `apps/server/scripts/simulate.ts` nên chạy được một ván Who's the Spy từ đầu đến cuối.

## 10. Để người làm quyết
- Cách mở rộng lõi ở §7, miễn thỏa yêu cầu.
- Tên package và tên file, ví dụ `packages/games/whos-the-spy`, `GAME_ID = "whos-the-spy"`.
- Nội dung cụ thể của bộ topic trong khuôn khổ §6.
- Chi tiết bố cục nhỏ nằm trong khuôn khổ hai file tham khảo ở §5.
