# Shark Tank — thiết kế

Các mục ghi **(Claude quyết)** là lựa chọn của Claude, giáo viên chưa duyệt riêng. Những mục còn lại giáo viên đã đồng ý trong buổi thảo luận.

## 1. Mục đích

Đây là minigame mới cho lớp ESL của CangsPlayground. Mục tiêu duy nhất là **học viên nói tiếng Anh càng nhiều càng tốt**, và **mọi em** đều phải nói, không chỉ em giỏi nhất nhóm.

- Mỗi buổi có 9–17 sinh viên. App random nhóm, giáo viên xếp lại bằng tay nếu trình độ quá lệch. Vì vậy nhóm nào cũng có cả em A1–A2 lẫn em khá, thường 3–5 nhóm, mỗi nhóm 3–4 em.
- Mỗi nhóm nhận một sản phẩm kỳ lạ, chuẩn bị, thuyết trình và đặt giá. Các nhóm khác hỏi, mặc cả rồi quyết định mua bằng ví chung của nhóm. Nhóm có doanh thu cao nhất thắng.

Từ các game trước, giáo viên rút ra hai lý do làm game hỏng:
1. Em nào thiếu từ hoặc không biết diễn đạt là chuyển sang tiếng Việt. Hiện giáo viên phải đi đến từng nhóm để đưa từ hay đưa câu, nên chỉ giúp được một nhóm mỗi lúc.
2. Nếu tiêu tiền chỉ làm đối thủ có điểm thì các nhóm sẽ giữ tiền, và không còn lý do để nghe hay hỏi nhau.

Thiết kế này xử lý hai lý do đó bằng luật chơi (§3) và bằng phần trợ giúp ngay trên điện thoại (§6).

## 2. Mục tiêu, không làm, và những điều phải tránh

**Mục tiêu**
- Giáo viên chọn game, chỉnh thời gian nếu muốn, bấm Prepare. App lo phát ý tưởng, chia phần nói, giữ ví, tính doanh thu và công bố kết quả.
- Mỗi em có phần nói riêng khi thuyết trình, phải hỏi ít nhất một câu trong cả buổi, phải vote khi nhóm quyết định mua, và nói một câu ở phần kết.
- Em A1–A2 luôn có sẵn từ vựng và mẫu câu trên điện thoại cho mọi lúc phải nói: thuyết trình, hỏi, trả lời, họp nhóm, công bố.
- Không nhóm nào có lợi khi giữ tiền.

**Không làm (non-goals)**
- Giáo viên tự thêm ý tưởng sản phẩm. Bộ ý tưởng là cố định, như bộ topic của Who's the Spy.
- App tự phát hiện học viên nói tiếng Việt, hay tự chấm tiếng Anh, ghi âm, AI.
- Bảng xếp hạng qua nhiều ván.
- Chat hay nhắn tin trong app.

**Phải tránh (anti-goals): mắc một trong các lỗi này là hỏng, dù về kỹ thuật app vẫn chạy**
- Lộ số lượng mua hoặc doanh thu trước phần công bố, kể cả trên máy chiếu và điện thoại học viên. Dữ liệu ẩn không được gửi xuống client không có quyền xem, chứ không chỉ ẩn trên giao diện (PRD §7, `viewFor`).
- Một em nói thay cả nhóm. Luật chia phần (§3.4) và luật vote (§3.5) phải làm cho việc này không xảy ra được.
- Học viên đứng nhìn màn hình mà không biết đang chờ gì. Màn nào cũng phải nói rõ bước tiếp theo.
- Bêu tên trước lớp em không hỏi câu nào. Máy chiếu chỉ hiện số tiền bị trừ của nhóm, không hiện tên **(Claude quyết)**.
- Làm hỏng Free Talk, Secret Word hay Who's the Spy khi mở rộng phần lõi.

## 3. Luật chơi

### 3.1 Cài đặt (giáo viên, ở tab Game của Host Console)

| Ô | Mặc định | Ghi chú |
|---|---|---|
| Thời gian chuẩn bị | 15 phút | |
| Thời gian thuyết trình | 2 phút | mỗi nhóm |
| Thời gian hỏi đáp | 3 phút | mỗi nhóm |
| Thời gian họp nhóm & vote | 90 giây | |
| Tiền mỗi thành viên | $100 | ví nhóm = số này × số thành viên |
| Giá tối thiểu / tối đa | $10 / $60 | |
| Tỉ lệ tiêu tối thiểu | 60% | §3.6 |
| Phạt mỗi em không hỏi câu nào | $20 | **(Claude quyết)** |

Mọi mốc thời gian đều bấm **Extend** được khi đang chạy. Hết giờ thì app báo (âm thanh hoặc nháy màn hình) nhưng **không tự chuyển bước**. Giáo viên bấm chuyển. Riêng bước vote thì tự chốt khi mọi người đã vote (§3.5).

### 3.2 Điều kiện nhóm

- Tối thiểu 2 nhóm, khuyến nghị 3–5 nhóm **(Claude quyết)**.
- Mỗi nhóm 2–5 em, khuyến nghị 3–4.
- Kiểm tra ở server khi Prepare. Không đạt thì báo lỗi rõ ràng trên Host Console.

### 3.3 Phát ý tưởng

- Mỗi nhóm nhận ngẫu nhiên một ý tưởng, không trùng nhóm khác.
- Trong bước "Hiểu sản phẩm" (§3.4), mỗi nhóm được **đổi ý tưởng một lần**. Nhóm đã sang bước 2 thì không đổi được nữa, kể cả khi quay lại bước 1. Ý tưởng mới cũng không trùng nhóm khác. Bất kỳ thành viên nào cũng bấm đổi được, và cả nhóm thấy ngay.

### 3.4 Chuẩn bị

Có một đồng hồ chung cho cả lớp, giáo viên điều khiển. Trên điện thoại, mỗi nhóm đi qua 4 bước với thời gian gợi ý. Nhóm tự bấm "Next step" hoặc quay lại bước trước, không phải đợi giáo viên **(Claude quyết)**:

1. **Hiểu sản phẩm (3')**: đọc thẻ ý tưởng (§6.1), tra từ khóa, có thể đổi ý tưởng.
2. **Chốt giá (3')**: bàn và nhập giá trong khoảng cho phép. Thành viên nào cũng nhập được, giá mới nhất là giá của nhóm, và cả nhóm thấy ngay.
3. **Soạn phần của mình (6')**: mỗi em điền mẫu câu cho phần được giao. Chỉ điền vào chỗ trống, không phải viết cả đoạn. Phần đã điền được lưu lại để hiện trên điện thoại lúc thuyết trình. Thành viên trong nhóm thấy phần của nhau.
4. **Tập nói (3')**: nói thử trong nhóm theo thứ tự các phần.

**Chia phần nói.** App giao phần tự động, theo thứ tự ngẫu nhiên giữa các thành viên:

| Phần | Mẫu câu (ví dụ) |
|---|---|
| Vấn đề | "Do you ever ___? It's a big problem." |
| Sản phẩm | "Our product is ___. It can ___." |
| Câu chuyện (chỉ nhóm 5 em) | "Imagine you ___. With our product, ___." |
| Giá | "It costs $___. That's cheaper than ___." |
| Kêu gọi | "Please buy our product because ___." |

- Nhóm 4 em: mỗi em một phần, bỏ phần Câu chuyện.
- Nhóm 3 em: một em nói cả Giá và Kêu gọi.
- Nhóm 2 em: mỗi em hai phần.

**Hết giờ chuẩn bị.** Nếu còn nhóm chưa nhập giá, Host Console cảnh báo. Nếu giáo viên vẫn chuyển bước thì nhóm đó nhận giá ở giữa khoảng ($35 với mặc định) **(Claude quyết)**. Khi chuyển bước, giá bị khóa và thứ tự thuyết trình được random, hiện trên máy chiếu.

### 3.5 Lượt của một nhóm

Mỗi nhóm lần lượt đi qua 4 bước, giáo viên bấm chuyển giữa các bước.

**a. Thuyết trình (2').**
- Máy chiếu hiện tên sản phẩm, hình hoặc emoji, giá, và tên người đang nói phần nào.
- Điện thoại của nhóm thuyết trình hiện phần đã soạn của từng em.

**b. Hỏi đáp và mặc cả (3').**
- Các nhóm khác hỏi bằng tiếng Anh, có ngân hàng câu hỏi trên điện thoại (§6.2).
- Giáo viên chạm vào tên em vừa hỏi trên Host Console để **đánh dấu đã hỏi**. Một em có thể được đánh dấu ở nhiều lượt.
- Nhóm thuyết trình được **giảm giá một lần**, chỉ trong bước này. Bất kỳ thành viên nào nhập giá mới, giá mới phải thấp hơn giá cũ và không dưới giá tối thiểu. Không được tăng giá lại. Máy chiếu hiện giá mới ngay.

**c. Họp nhóm và vote (90").**
- Tất cả nhóm không thuyết trình họp cùng lúc, nói bằng tiếng Anh, có mẫu câu trên điện thoại như "I think we should buy ___ because ___" hay "I don't agree, it's too expensive".
- **Điều kiện được mua:** ít nhất một thành viên của nhóm đã được đánh dấu "đã hỏi" ở lượt hỏi đáp này. Nhóm không đủ điều kiện thì vẫn thấy màn họp nhóm, nhưng phần vote khóa ở 0, kèm lời nhắc "Nobody in your group asked a question".
- Mỗi em vote **số lượng muốn mua**, từ 0 đến *số thành viên của nhóm mình*. Số lượng tối đa bị giới hạn thêm bởi số tiền còn lại trong ví.
- **Kết quả của nhóm = trung vị các phiếu, làm tròn xuống** **(Claude quyết)**. Số phiếu chẵn thì lấy trung bình hai phiếu ở giữa rồi làm tròn xuống, ví dụ phiếu 1 và 4 cho ra 2.
- Vote tự chốt khi mọi thành viên đang kết nối đã vote. Hết giờ mà chưa đủ phiếu thì giáo viên bấm chốt, chỉ tính các phiếu đã có. Không ai vote thì nhóm mua 0.
- Máy chiếu chỉ hiện nhóm nào **đã vote xong**, không hiện mua bao nhiêu.

**d. Công bố.**
- Với mỗi nhóm không thuyết trình (kể cả nhóm không đủ điều kiện mua), app chọn ngẫu nhiên một thành viên đang kết nối và hiện tên em đó lên máy chiếu.
- Em đó nói quyết định của nhóm: "We are buying because ___" hoặc "We are not buying because ___". Em **chỉ nói có mua hay không, không nói số lượng**, để giữ bí mật doanh thu **(Claude quyết)**.
- Điện thoại của em được chọn hiện mẫu câu, kèm quyết định thật của nhóm (có mua hay không).
- Giáo viên bấm sang nhóm tiếp theo khi xong.

### 3.6 Tiền và tính điểm

- Mỗi lần mua, nhóm mua mất *số lượng × giá hiện tại*, và nhóm bán được cộng đúng số đó vào doanh thu.
- Không được mua sản phẩm của nhóm mình.
- **Tiền không tiêu thì mất**: tiền còn lại trong ví không được tính vào điểm.
- **Tiêu tối thiểu.** Mức phải tiêu = min(*tỉ lệ tiêu tối thiểu × ví*, *tổng số tiền tối đa nhóm có thể mua được*). Phần sau là tổng, trên mọi sản phẩm của nhóm khác, của *giới hạn số lượng × giá cuối cùng*, và không vượt quá ví. Nhóm tiêu thiếu bao nhiêu so với mức này thì doanh thu bị trừ bấy nhiêu **(Claude quyết cách tính)**. Lượt nào nhóm không đủ điều kiện mua vì không ai hỏi thì vẫn tính như thể đã có thể mua.
- **Phạt không hỏi:** sau lượt cuối, mỗi thành viên chưa từng được đánh dấu "đã hỏi" làm nhóm bị trừ một khoản phạt vào doanh thu.
- **Điểm cuối = doanh thu − phạt tiêu thiếu − phạt không hỏi.** Điểm có thể âm.
- Điện thoại mỗi nhóm luôn hiện ví còn bao nhiêu và mức tối thiểu còn phải tiêu, để nhóm tự tính.

### 3.7 Kết thúc

1. **Công bố doanh thu**: máy chiếu hiện lần lượt từ thấp lên cao. Mỗi nhóm có doanh thu, các khoản bị trừ không kèm tên, và điểm cuối.
2. **Best Startup**: nhóm có điểm cuối cao nhất. Hòa thì đồng hạng.
3. **Best Shark**: nhóm tiêu nhiều tiền nhất vào sản phẩm của **hai nhóm đứng đầu** theo doanh thu, không tính sản phẩm của chính mình. Nếu nhiều nhóm hòa ở hạng 2 thì tính tất cả các nhóm đó. Hòa giải thì đồng hạng. Có ít hơn 3 nhóm thì bỏ giải này **(Claude quyết)**.
4. **Vòng "I bought ___ because ___"**: mỗi em nói một câu về sản phẩm mình thích nhất. Máy chiếu hiện danh sách lượt nói, điện thoại hiện mẫu câu, giáo viên bấm qua từng người. Có thể tái dùng lượt nói xoay vòng của lõi hoặc làm danh sách riêng, người làm chọn.

### 3.8 Thời gian ước tính với mặc định

Chuẩn bị 15' + mỗi nhóm khoảng 7' + kết thúc khoảng 5'. Tổng: 3 nhóm khoảng 40 phút, 4 nhóm khoảng 47 phút, 5 nhóm khoảng 55 phút.

## 4. Ai thấy gì

| Dữ liệu | Máy chiếu | Học viên (nhóm mình) | Học viên (nhóm khác) | Giáo viên |
|---|---|---|---|---|
| Ý tưởng, thẻ ý tưởng của nhóm | Sau khi hết chuẩn bị: tên, emoji, mô tả 1 câu | Đầy đủ | Như máy chiếu | Đầy đủ |
| Giá | Sau khi hết chuẩn bị | Luôn | Sau khi hết chuẩn bị | Luôn |
| Phần nói đã soạn | Không | Có | Không | Có |
| Ví còn lại, mức phải tiêu | Không | Có | Không | Có |
| Phiếu vote của từng em | Không | Có (cả nhóm thấy, để bàn) **(Claude quyết)** | Không | Có |
| Nhóm đã vote xong | Có | Có | Có | Có |
| Số lượng mua, doanh thu | Chỉ ở phần kết | Chỉ số mình đã mua; doanh thu chỉ ở phần kết | Chỉ ở phần kết | Luôn |
| Ai đã được đánh dấu "đã hỏi" | Không | Chỉ thành viên nhóm mình | Không | Có |
| Nút "Cần giúp" đang bật | Không | Có | Không | Có |

## 5. Màn hình (style Arcade Night, như Who's the Spy)

Bố cục chi tiết do người làm quyết, theo style và các component sẵn có của Who's the Spy. Mỗi màn phải có:

**Máy chiếu**
- Thanh trên cùng: bước hiện tại (Preparing / Pitch / Q&A / Shark huddle / Decision / Results) và đồng hồ.
- Lúc chuẩn bị: lưới các nhóm và bước mỗi nhóm đang làm. Không lộ ý tưởng.
- Lúc thuyết trình và hỏi đáp: thẻ sản phẩm lớn có giá. Giá giảm thì có hiệu ứng.
- Lúc họp nhóm: dấu tick cho nhóm đã vote xong.
- Lúc công bố: tên em được gọi, rất to.
- Phần kết: công bố từng nhóm, rồi hai giải.

**Điện thoại học viên**
- Lúc chuẩn bị: 4 bước, có thẻ ý tưởng, ô giá, mẫu câu của phần mình.
- Lúc nhóm mình thuyết trình: phần đã soạn, to, dễ đọc.
- Lúc nhóm khác thuyết trình: thẻ sản phẩm, ngân hàng câu hỏi, trạng thái "Your group can / can't buy yet".
- Lúc họp nhóm: mẫu câu tranh luận, ô vote số lượng, phiếu của các bạn cùng nhóm, ví.
- Lúc công bố: nếu được gọi thì hiện mẫu câu và quyết định của nhóm, nếu không thì hiện "Listen to ___".
- Nút **Cần giúp** luôn có. Nút **Ẩn mẫu câu** để em khá chỉ giữ từ khóa. Đây là cài đặt riêng của từng em, mặc định hiện mẫu câu.

**Host Console**
- Nút chuyển bước chính, kèm Extend, Pause, Resume.
- Lúc hỏi đáp: lưới tên học viên các nhóm không thuyết trình để chạm đánh dấu "đã hỏi", chạm lần nữa để bỏ.
- Bảng tình trạng các nhóm: bước chuẩn bị, đã có giá chưa, đã vote chưa, đang bật "Cần giúp". Giáo viên chạm để tắt "Cần giúp".
- Xem được toàn bộ dữ liệu: ví, số lượng mua, doanh thu tạm tính.

## 6. Nội dung

Claude soạn toàn bộ, giáo viên duyệt trước khi dùng. Lưu thành file data trong package game, như `packages/games/whos-the-spy/data/topics.json`.

### 6.1 Bộ thẻ ý tưởng

Khoảng 25–30 ý tưởng kỳ lạ nhưng dễ hình dung, ví dụ ô dù cho mèo hay giày tự buộc dây biết hát. Mỗi thẻ gồm:
- tên sản phẩm
- emoji hoặc hình
- một câu mô tả bằng tiếng Anh đơn giản, mức A2
- 6–8 từ khóa, kèm nghĩa tiếng Việt
- 2–3 gợi ý điểm mạnh để bán

### 6.2 Mẫu câu chung

- Mẫu câu cho từng phần nói (§3.4).
- Ngân hàng khoảng 10 câu hỏi cho người mua: "How much is it?", "Who will buy it?", "Is it safe?", "Can you give me a discount?"…
- Mẫu câu trả lời cho nhóm thuyết trình: "Good question. ___", "Sorry, we can't. But ___"…
- Mẫu câu họp nhóm, mẫu câu công bố, và mẫu câu phần kết.

## 7. Phần lõi cần mở rộng

Lõi hiện tại chạy game **riêng trong từng nhóm**. Mỗi nhóm có một `GroupRuntime` riêng, các hook `onAction` và `viewFor` của `GameModule` chỉ chạm tới một nhóm, và học viên chỉ nhận dữ liệu của nhóm mình (`GameSessionView.groups`). `publicInfo` chỉ lấy từ config. Shark Tank cần thêm các thứ dưới đây. **Cách cài đặt do người làm quyết**, miễn thỏa các yêu cầu và giữ nguyên hành vi của ba game hiện có.

1. **Trạng thái chung của cả phiên**: bước hiện tại của cả lớp, nhóm đang thuyết trình, thứ tự thuyết trình, giá, ví, các lần mua, dấu "đã hỏi". Có thể là một runtime cấp phiên bên cạnh các `GroupRuntime`, hoặc cách tương đương.
2. **Thao tác cắt ngang nhóm**:
   - Học viên nhóm A vote mua sản phẩm của nhóm B.
   - Giáo viên đánh dấu "đã hỏi" cho học viên bất kỳ.
   - Nhóm thuyết trình giảm giá, và việc giảm giá phải hiện ngay cho mọi nhóm.
3. **Lọc dữ liệu cấp phiên theo người xem**, theo bảng §4. Ví dụ học viên nhóm khác thấy giá nhưng không thấy doanh thu. Đây là bản mở rộng của `viewFor` lên cấp phiên, và vẫn phải lọc ở server.
4. **Các bước có timer cấp phiên**: chuẩn bị, thuyết trình, hỏi đáp, họp nhóm. Timer do server giữ, có Pause, Resume, Extend, hiển thị đúng sau khi reconnect. Hết giờ thì báo, không tự chuyển bước, trừ vote tự chốt khi đủ phiếu. Nhớ cập nhật `canControl` và `mainControl` trong `apps/web/src/components/game-controls.ts` và `HostGame.tsx` cho nút chuyển bước của game này.
5. **Nút "Cần giúp"**: cờ theo nhóm, học viên bật, giáo viên tắt. Có thể nằm riêng trong game hoặc thành tính năng chung của lõi, người làm chọn.

Còn lại là các phần cố định của game: `configSchema` và `configFields` theo §3.1, chia nhóm và phát ý tưởng ở `prepare`, các view, và đăng ký game ở `apps/server/src/games/registry.ts` và `apps/web/src/games/registry.ts`.

## 8. Các trường hợp đặc biệt

- **Học viên rời game hoặc mất kết nối:**
  - Phần nói của em được giao cho thành viên còn lại có ít phần nhất. Điện thoại của thành viên đó hiện thêm phần mới.
  - Vote chỉ cần đủ phiếu của thành viên đang kết nối.
  - Ví nhóm giữ nguyên như lúc Prepare.
  - Phạt không hỏi không tính em đã rời game **(Claude quyết)**.
- **Kết nối lại:** em quay về đúng nhóm, đúng bước, thấy lại phần đã soạn.
- **Học viên mới vào giữa game:** theo cách lõi đang xử lý cho các game khác. Không tính lại ví nhóm.
- **Nhóm không còn ai:** nhóm bị bỏ qua trong thứ tự thuyết trình. Doanh thu đã có vẫn giữ, nhóm không mua nữa và không tính phạt.
- **Giảm giá xuống đúng giá tối thiểu:** được phép. Đã giảm một lần thì ô giảm giá khóa lại.
- **Ví không đủ:** ô vote tự giới hạn số lượng theo số tiền còn lại.
- **Giáo viên Exit giữa chừng:** như các game khác, không công bố kết quả.

## 9. Kiểm thử

- **Unit test cho phần tính toán**: doanh thu, giới hạn số lượng theo thành viên và theo ví, trung vị làm tròn xuống, mức tiêu tối thiểu và phạt tiêu thiếu (gồm trường hợp không thể đạt 60%), phạt không hỏi, Best Shark (gồm hòa và ít hơn 3 nhóm), điều kiện được mua, giảm giá một lần.
- **Test lọc dữ liệu**: với từng loại người xem trong bảng §4, dữ liệu ẩn không có trong payload gửi xuống.
- **Test qua server**: một ván đầy đủ 3 nhóm và một ván 2 nhóm, có rời game và kết nối lại. Dùng cách giả lập đang có ở `apps/server/scripts/simulate.ts`.
- **Hồi quy**: toàn bộ test hiện có của Free Talk, Secret Word và Who's the Spy vẫn qua.
- **Thử với người thật** trước khi dùng trong lớp, như đã làm với Who's the Spy.

## 10. Để người làm quyết

- Cách mở rộng lõi ở §7.
- Bố cục và hiệu ứng màn hình, trong khuôn khổ style Arcade Night.
- Vòng nói phần kết dùng lượt nói của lõi hay danh sách riêng.
- Tên gọi trong code, cấu trúc data file.
