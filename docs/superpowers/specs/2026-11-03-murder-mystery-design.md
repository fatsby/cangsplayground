# Murder Mystery — thiết kế minigame

Trạng thái: bản thiết kế chờ người dùng duyệt. Chưa lập kế hoạch hay triển khai game.

Tên làm việc: **Murder Mystery**. Bối cảnh gợi tinh thần cộng sự Holmes & Watson; tên thương mại và tên trong code để người làm quyết.

## 1. Mục đích và các điểm đã thống nhất

Minigame phá án cho CangsPlayground, dành cho học viên tiếng Anh khoảng B1. Mỗi đội có 3–4 người, cùng suy luận để giải một vụ án với nghi phạm và nhân chứng NPC. Vụ án được procedurally generated.

Trải nghiệm người dùng muốn nhất từ Clue/Cluedo là **ngồi xuống bàn luận và suy luận cùng mọi người**. Tiếng Anh phục vụ việc chia sẻ phát hiện, phản biện, hỏi lại và giải thích giả thuyết.

Đã được người dùng chọn hoặc đồng ý trong hội thoại:

- Hướng Holmes & Watson chia thông tin; NPC thuộc game, học viên cùng là người điều tra.
- Đội 3–4 người; trình độ khoảng B1; thời lượng khoảng 20–25 phút mỗi vụ.
- Các đội cùng phá một vụ, chơi đồng thời, công bố lời giải chung.
- Flow: nhận vụ 2 phút, chia sẻ thông tin đầu 3 phút, bốn lượt điều tra tổng 12 phút, chốt lời giải 4 phút, công bố khoảng 3 phút; tổng khoảng 24 phút.
- Mỗi người nhận một phần thông tin đầu; đội tiếp tục chọn hành động điều tra để nhận thêm lời khai/chứng cứ trong suốt vụ án.
- Bốn lượt điều tra là bốn quyết định chung. Người dẫn điều tra đổi lượt; mỗi người trong đội bốn người dẫn một lần.
- Đích cuối là hung thủ, hung khí và địa điểm gây án, cùng chứng cứ hỗ trợ. Một lần nộp kết luận cuối; ưu tiên đáp án và bằng chứng.

**Những chi tiết mang nhãn “Đề xuất của Codex” bên dưới là quyết định bổ sung để bản thiết kế có thể lập kế hoạch được; cần được duyệt cùng tài liệu.** Chúng chưa được người dùng xác nhận riêng.

## 2. Các hướng đã cân nhắc

| Hướng | Điểm mạnh | Đánh đổi | Quyết định |
|---|---|---|---|
| Nói tự do vào mic với NPC | Cảm giác trực tiếp thẩm vấn, tự do hỏi tiếp | Nhận diện tiếng nói trong lớp đông, xử lý hội thoại và giữ NPC nhất quán làm phạm vi lớn hơn | Không chọn cho bản đầu |
| Holmes & Watson chia thông tin | Cần trao đổi giữa học viên để suy luận; dễ có hỗ trợ B1; khớp thông tin riêng và nhóm hiện có | NPC trả lời theo hành động/chủ đề định sẵn; cần thiết kế phân phối thông tin tốt | **Người dùng chọn** |
| Chọn mục tiêu rồi hỏi NPC bằng giọng nói | Hỗ trợ cách đặt câu hỏi mà vẫn có tự do diễn đạt | Vẫn cần nhận diện giọng nói và xử lý nghe sai | Không chọn cho bản đầu |

Nguồn tham khảo: [luật Cluedo của Hasbro](https://www.hasbro.com/common/instruct/Cluedo.pdf). Học cách nêu giả thuyết nhiều thành phần, kiểm chứng và loại trừ. Game này dùng cộng tác trong đội và chứng cứ có ngữ cảnh để phục vụ thảo luận.

## 3. Mục tiêu, ngoài phạm vi, điều phải tránh

Mục tiêu:

- Có nhiều giả thuyết hợp lý lúc đầu, đủ chứng cứ để tìm đúng một lời giải sau điều tra.
- Mỗi thành viên có thông tin để đóng góp và cơ hội dẫn điều tra.
- Quyết định hỏi gì tiếp theo xuất phát từ cuộc thảo luận của đội.
- Ván mới thay đổi bài toán suy luận bên cạnh tên và cách kể.
- Giáo viên điều phối cả lớp qua projector, host console và điện thoại học viên hiện có.

Ngoài phạm vi bản đầu **(Đề xuất của Codex)**: AI hội thoại lúc chạy, ghi âm, speech recognition, chấm phát âm/ngữ pháp tự động, bản đồ di chuyển bằng xúc xắc, chiến đấu, học viên đóng hung thủ, chat trong app, host tự viết vụ án, campaign, lưu tiến độ dài hạn.

Điều phải tránh:

- Một người tự đọc hết dữ kiện và giải thay đội; một vai chỉ làm thư ký.
- Bấm mở hết nội dung thay cho quyết định điều tra và suy luận.
- Lời khai hoặc bằng chứng mâu thuẫn ngoài chủ ý của câu chuyện.
- Dùng kiến thức pháp y, y học hoặc văn hóa bên ngoài nội dung game làm điều kiện giải án.
- Dùng timer ép hội thoại ngắn hoặc thưởng riêng cho tốc độ đoán.
- Công bố đáp án cho đội xong sớm khi đội khác đang chơi.
- Tuyên bố app đã kiểm tra việc nói tiếng Anh khi app chỉ nhận thao tác chọn.

## 4. Nội dung một vụ án

**Đề xuất của Codex:** bối cảnh bản đầu là một dinh thự hư cấu, phong vị trinh thám cổ điển. Nội dung không có hình ảnh bạo lực chi tiết.

- Một nạn nhân; bốn nghi phạm; ba hung khí; bốn địa điểm gây án có thể chọn.
- Hồ sơ công khai giới thiệu tên, nghề, quan hệ và nơi phát hiện nạn nhân. Nơi gây án là nơi hành vi gây án xảy ra; nơi phát hiện nạn nhân có thể khác. Hai khái niệm này được ghi rõ trong hồ sơ và dữ liệu.
- Bốn thẻ manh mối ban đầu, giống nhau về nội dung giữa các đội.
- Mỗi hành động điều tra trả về một hoặc hai thẻ ngắn; tổng khoảng 8–12 thẻ được nhận trong một vụ, kể cả bốn thẻ đầu.
- Mỗi thẻ gồm nguồn, nội dung tiếng Anh B1 khoảng 2–4 câu và từ vựng hỗ trợ. Không đòi hỏi học viên đoán nghĩa các thuật ngữ chuyên môn.
- Nhãn nguồn phân biệt **lời khai chưa kiểm chứng** với **phát hiện được xác nhận**. Nhãn không tự chỉ ra ai nói dối.
- Ít nhất hai người có lý do đáng nghi lúc đầu. Có thể có người vô tội giấu bí mật; lời giải cuối giải thích bí mật đó và vì sao nó liên quan hoặc không liên quan tới vụ án.

Tên/nội dung Blackwood Manor, bác sĩ, quản gia, chìa khóa và cửa sổ trong hội thoại chỉ là ví dụ minh họa, chưa phải một vụ án đã được chứng minh giải được.

## 5. Luật và vòng đời vụ án

### 5.1 Chuẩn bị

Host dùng lobby và chia nhóm hiện có. Khi Prepare, server kiểm tra mỗi nhóm có 3–4 người. **Đề xuất của Codex:** cho phép một đội để giáo viên thử hoặc dùng với lớp nhỏ; không cần số đội chẵn.

Server tạo một vụ án chung, khởi tạo tiến độ riêng từng đội, phân phối thẻ và thứ tự dẫn điều tra. Prepare chưa chạy đồng hồ. Host bấm Start để bắt đầu.

Các thời lượng mặc định theo §1. **Đề xuất của Codex:** host chỉnh thời lượng các pha trước Prepare; bốn lượt điều tra cố định cho bản đầu. Thời lượng tính bằng server clock, giữ cấu hình trong vụ đang chơi.

### 5.2 Giới thiệu — 2 phút

Các đội xem cùng hồ sơ công khai, mục tiêu, danh sách nghi phạm, hung khí và địa điểm. Host có thể đọc phần mở đầu và nhắc cách chơi. Chưa mở hành động điều tra hay kết luận.

### 5.3 Chia sẻ thông tin đầu — 3 phút

**Đề xuất của Codex:** shuffle bốn thẻ đầu rồi chia cho thành viên theo thứ tự đã shuffle. Đội bốn người: mỗi người một thẻ. Đội ba người: phân phối 2–1–1; người có hai thẻ được đọc lại và giải thích từng thẻ, cả đội vẫn có cùng lượng thông tin.

Mọi người kể lại/diễn giải bằng tiếng Anh, hỏi lại và nêu giả thuyết. Được đọc nguyên văn, yêu cầu nhắc lại và dùng hỗ trợ từ vựng. Không có thứ tự phát biểu bắt buộc trong thảo luận.

Quy tắc lớp học là giữ thẻ trên thiết bị mình và chia sẻ bằng lời. App không xác minh được việc học viên đưa điện thoại cho nhau hoặc dùng tiếng Việt; giáo viên hướng dẫn và hỗ trợ như các hoạt động speaking khác.

### 5.4 Bốn lượt điều tra — mỗi lượt 3 phút

**Đề xuất của Codex:** bốn lượt theo đồng hồ chung cho cả lớp; mỗi lượt, mỗi đội được thực hiện tối đa một hành động điều tra. Đội hoàn thành sớm dùng thời gian còn lại để bàn luận. Không tự chuyển cả lớp vì một đội đã xong.

Trong một lượt:

1. Đội thảo luận điều gì đang thiếu, muốn kiểm chứng giả thuyết nào.
2. Người dẫn lượt chọn hành động sau khi nghe ý kiến của đội. Chỉ người này có quyền gửi hành động.
3. Server kiểm tra hành động hợp lệ rồi ghi nhận ngay; mỗi lượt chỉ ghi nhận một lần. Retry không tạo thêm hành động.
4. Kết quả một hoặc hai thẻ riêng được giao cho người dẫn. Người đó kể lại, cả đội so sánh với thông tin trước và sửa giả thuyết.

Các nhóm hành động:

- Hỏi một NPC về ngoại phạm.
- Hỏi một NPC về quan hệ hoặc sự việc liên quan.
- Kiểm tra một vật chứng/địa điểm.
- Chất vấn một NPC bằng thẻ chứng cứ đội đã có.

Hành động là các lựa chọn có cấu trúc; câu hỏi tiếng Anh mẫu giúp đội diễn đạt điều muốn tìm hiểu. Game không cần nghe hay phân tích câu hỏi nói. Chất vấn phải có đúng NPC và bằng chứng phù hợp với chủ đề, chưa dùng trước đó. Trước khi xác nhận, người chơi biết NPC/chủ đề/thẻ nào sẽ được dùng. Không trừ lượt vì thao tác không hợp lệ.

**Đề xuất của Codex:** hành động đã thực hiện được loại khỏi lựa chọn lặp; các câu hỏi tiếp có ID riêng và điều kiện mở rõ ràng. Game không đánh dấu lựa chọn nào là “đáp án đúng”.

Thứ tự dẫn: shuffle một lần mỗi vụ. Đội bốn người: A → B → C → D. Đội ba người: A → B → C → A. Trong mọi lượt, cả đội được nói và góp ý tự do; vai dẫn chịu trách nhiệm thao tác và truyền đạt kết quả.

**Đề xuất của Codex về hết giờ:** hết giờ khóa gửi hành động, không tự chọn thay đội. Lượt chưa dùng không được dồn sang lượt sau. Host có thể gia hạn hoặc pause trước deadline nếu đội cần thêm thời gian; bỏ lỡ lượt có thể khiến đội thiếu chứng cứ. Cam kết giải được tại §7 áp dụng khi đội dùng đủ bốn lượt hợp lệ.

### 5.5 Chốt lời giải — 4 phút

Mỗi đội chọn hung thủ, hung khí, địa điểm và chứng cứ hỗ trợ. Các thành viên cùng thống nhất và mỗi người chuẩn bị giải thích một phần bằng lời. Phần trình bày mặc định diễn ra trong đội; giáo viên có thể mời một vài đội trình bày trước lớp.

**Đề xuất của Codex:** một thành viên được chỉ định làm người nộp, mặc định người dẫn lượt cuối; có thể chỉnh bản nháp tới khi bấm xác nhận nộp. Mọi người trong đội thấy bản nháp. Sau xác nhận, kết luận khóa. Không trả kết quả đúng/sai trước công bố chung. Không có hành động điều tra thêm trong pha này.

Hết thời gian, đội chưa xác nhận được tính là chưa nộp. Không tự coi bản nháp là đáp án đã nộp. Host thấy trạng thái nộp và có thể gia hạn trước deadline.

### 5.6 Công bố — khoảng 3 phút

Đóng mọi kết luận, sau đó host bấm Reveal chung. Game kể lại trình tự sự việc, hung thủ, hung khí, nơi gây án, chứng cứ cốt lõi và các lời khai gây nhiễu. Mọi đội được xem toàn bộ lời giải, kể cả các nhánh họ chưa điều tra.

Host có thể mời các đội so sánh lập luận. Bấm New case khi sẵn sàng sẽ tạo vụ mới và thứ tự dẫn mới với cùng nhóm; Start bắt đầu vụ tiếp. Muốn chia nhóm lại, host thoát game để dùng công cụ hiện có.

## 6. Kết quả và hỗ trợ nói B1

**Đề xuất của Codex về điểm, tối đa 10:**

- Hung thủ đúng: 3 điểm; hung khí đúng: 2; địa điểm đúng: 2.
- Ba mục bằng chứng tương ứng hung thủ/hung khí/địa điểm, mỗi mục 1 điểm nếu đáp án mục đó đúng và tập thẻ đã chọn là một tập hỗ trợ hợp lệ mà đội đã khám phá.
- Mỗi mục chọn tối đa hai thẻ; nội dung vụ án định nghĩa các tập được chấp nhận, bao gồm các nhánh điều tra khác nhau. Có thể dùng lại một thẻ cho nhiều mục nếu nó thực sự hỗ trợ các mục đó.
- Không nộp: 0. Hòa: đồng hạng. Không có điểm tốc độ hay phạt ngữ pháp.

Điểm bằng chứng đánh giá lựa chọn thẻ hỗ trợ, không tự đánh giá chất lượng lập luận nói. Giáo viên có thể nhận xét sự phối hợp và phản biện bằng lời, không cần cơ chế chấm điểm phụ trong app bản đầu.

Hỗ trợ tiếng Anh chung, không tiết lộ đáp án:

- Chia sẻ: “According to my witness, …”, “The report says …”
- Hỏi lại: “Do you mean …?”, “When exactly did that happen?”
- Đề xuất: “We should check … because …”
- Phản biện: “That explains …, but what about …?”
- Phân biệt biết/nghi: “We know …, but we only suspect …”
- Kết luận: “We ruled out … because …”

**Đề xuất của Codex:** hỗ trợ có thể ẩn riêng theo từng người; có giải nghĩa tiếng Việt cho từ vựng khó. Hướng dẫn khuyến khích kể lại bằng lời của mình, luôn cho phép đọc nguyên văn khi cần. Không có kiểm tra ngôn ngữ để mở khóa lượt.

## 7. Sinh vụ án và bảo đảm suy luận

**Đề xuất của Codex cho bản đầu:** dùng bộ khung logic được biên soạn trước, sinh theo seed trên server; lời khai và văn bản render từ dữ liệu có cấu trúc. Không phụ thuộc dịch vụ AI khi chơi.

Phạm vi nội dung đầu: ba họ vụ án có quan hệ suy luận khác nhau — ngoại phạm/thời gian, quyền tiếp cận/chìa khóa, trao đổi đồ vật/nhầm danh tính vật chứng. Mỗi họ có thể thay người đảm nhận vai trò trong logic, vị trí, hung khí tương thích, quan hệ và các nhánh khám phá. Không chỉ đổi tên trong cùng một lời giải cố định.

Trình tự tạo:

1. Chọn họ vụ án và các biến thể tương thích; tạo sự thật đầy đủ: thủ phạm, hành vi, thời gian, nơi gây án, nơi tìm thấy nạn nhân, động cơ, ai biết gì, ai giấu gì.
2. Tạo bằng chứng xác nhận, lời khai và bí mật phụ từ sự thật đó. Mỗi lời khai sai có lý do và cách kiểm chứng; game vẫn có những nguồn đáng tin được chỉ rõ để bắt đầu suy luận.
3. Tạo bốn thẻ đầu, đồ thị hành động/điều kiện mở, kết quả từng hành động, tập chứng cứ được chấp nhận khi chấm và phần giải thích cuối.
4. Kiểm tra tính nhất quán và khả năng suy ra duy nhất trước khi dùng trong lớp.

Các điều kiện bắt buộc:

- Ban đầu còn ít nhất hai giả thuyết về hung thủ; không có thẻ đơn lẻ công bố toàn bộ đáp án.
- Mỗi thẻ đầu đóng góp một quan hệ hữu ích; không phân một thành viên chỉ nhận tiểu sử trang trí.
- Đáp án là đúng một bộ hung thủ/hung khí/địa điểm theo các quy tắc được cung cấp trong game. Không giả định mọi lời khai đều đúng.
- Có ít nhất hai tuyến điều tra khác nhau giải được trong bốn hành động.
- Với mọi chuỗi hành động được game cho phép, còn ít nhất một tuyến hoàn thành trong số lượt còn lại; sau đủ bốn hành động, chứng cứ đã nhận phải phân biệt được đúng một đáp án. Bộ khung và đồ thị hành động phải được thiết kế để thỏa điều này; không bịa thêm sự thật theo lựa chọn của đội.
- Hành động được mở có đóng góp thông tin hoặc kiểm chứng một quan hệ liên quan. Chuyện phụ được lồng trong thông tin hữu ích, không chiếm một lượt vô ích độc lập.
- Mọi tuyến hoàn thành có tập thẻ hỗ trợ hợp lệ cho cả ba mục bằng chứng trong §6.
- Hai đội chọn cùng hành động, trong cùng điều kiện chứng cứ, nhận cùng thông tin. Sự thật không thay đổi giữa các đội hay theo thứ tự hỏi.
- Cùng seed và phiên bản bộ nội dung tái hiện cùng vụ, thuận tiện báo lỗi. Seed/dữ liệu nội bộ không được gửi tới client trước công bố nếu có thể dùng để dựng lại đáp án.

Trong phát triển, phải duyệt hết đồ thị trạng thái hữu hạn của từng cấu hình logic/họ vụ án và kiểm tra các tuyến tới độ sâu bốn. Random sampling bổ sung cho biến thể văn bản, không thay việc chứng minh các cấu hình logic được phép. Nếu một họ chưa đáp ứng điều kiện này thì sửa bộ khung trước khi phát hành, không giảm cam kết trong UI.

Tạo vụ án lúc Prepare bằng các cấu hình đã kiểm tra. Nếu phát hiện cấu hình không hợp lệ, không bắt đầu vụ; host nhận thông báo có thể thử Prepare lại. Không âm thầm phát một vụ thiếu lời giải. Số lần thử sinh và cách cache cấu hình hợp lệ để người làm quyết.

## 8. Dữ liệu, điều phối và tình huống đặc biệt

**Đề xuất của Codex:** làm module game riêng theo GameModule/shared state hiện có. Server giữ sự thật và dữ liệu nội dung; mỗi đội giữ lịch sử điều tra, quyền sở hữu thẻ, thứ tự dẫn, bản nháp và kết luận đã nộp. Các pha có clock chung; hành động và thẻ riêng theo đội/người.

Quyền xem:

| Người xem | Trước công bố | Sau công bố |
|---|---|---|
| Projector | Hồ sơ công khai, pha, đồng hồ, đội đã hành động/nộp hay chưa | Lời giải đầy đủ và bảng điểm |
| Học viên | Hồ sơ chung; thẻ riêng được giao; hành động đã làm của đội; lựa chọn điều tra hợp lệ; bản nháp chung trong pha kết luận | Lời giải đầy đủ, kết luận/điểm đội mình, bảng điểm công khai |
| Host | Toàn bộ vụ án, thẻ của mọi người, tiến độ và kết luận từng đội | Toàn bộ |

Lịch sử hành động chung chỉ gồm đã hỏi/kiểm tra gì; nội dung kết quả vẫn ở người được giao để hỗ trợ việc kể lại. Phần chọn bằng chứng cuối cho cả đội xem các thẻ đội đã nhận, phục vụ tổng hợp sau các lượt nói.

Server lọc payload theo người xem, kiểm tra thành viên/quyền dẫn/pha/lượt và xử lý chống gửi trùng. Không gửi đáp án hoặc nội dung chưa khám phá qua danh sách hành động, gợi ý, ID có ý nghĩa hay trường ẩn. ID của dữ liệu gameplay dùng định danh trung tính.

Host có Pause/Resume, Extend và Next phase; xác nhận trước khi bỏ thời gian còn lại của một pha/lượt. **Đề xuất của Codex:** hết giờ tự đi qua các pha tới lúc đóng kết luận; Reveal luôn do host bấm. Pause khóa thao tác thay đổi game và giữ thời gian còn lại. Next phase bỏ qua lượt điều tra chưa dùng, có cảnh báo cụ thể cho host. Không có điều khiển buộc đội phải chọn hành động.

Host có thể nhắc cách diễn đạt hoặc gợi ý cách đặt câu hỏi; không có hint tự động cung cấp bằng chứng ngoài bốn lượt trong bản đầu.

- Mất kết nối tạm thời: giữ thẻ và thứ tự; reconnect trở về cùng tiến độ. Host có thể gia hạn/pause hoặc giao lại vai dẫn và thẻ cho người đang có mặt trong cùng đội. Chuyển giao được giữ tới hết vụ, người cũ trở lại thấy thẻ mình đang sở hữu hiện tại.
- Rời/kick: chuyển thẻ cho thành viên còn lại có ít thẻ nhất, chỉnh các lượt dẫn tương lai theo thứ tự; nếu đang dẫn thì chọn người đang có mặt tiếp theo. Từ 1–2 người sau khi rời vẫn được tiếp tục với cảnh báo host; kiểm tra 3–4 người áp dụng lúc Prepare.
- Đội không còn ai: đánh dấu không hoạt động; bỏ qua khi tính tiến độ, giữ kết luận đã nộp nếu có. Không chặn cả lớp.
- Học viên mới giữa vụ: xem hồ sơ công khai và đứng ngoài đội điều tra đến vụ tiếp; không tự chia lại thẻ hay hồi lượt.
- Hết giờ và gửi hành động đồng thời: server chỉ nhận hành động nếu nhận trước deadline của đúng lượt; thao tác cũ không ăn sang lượt mới.
- New case khi chưa Reveal: không khả dụng; host có thể Exit để hủy theo hành vi nền tảng. Sau Reveal, đội cần đủ người theo điều kiện Prepare để bắt đầu vụ tiếp.

## 9. Kiểm chứng trước khi dùng

Khi triển khai, cần kiểm chứng:

- Các cấu hình logic và toàn bộ tuyến hành động theo §7; tập chứng cứ chấm điểm và phần giải thích cuối cùng nhất quán với nhau.
- Phân phối đủ bốn thẻ đầu cho cả đội ba và bốn người; quyền dẫn, đổi lượt, bốn hành động và nộp đúng một lần.
- Lọc dữ liệu: các loại client không nhận nội dung ngoài quyền của mình trước Reveal; host và reveal nhận đủ.
- Timer, pause/extend/skip, ranh giới deadline, retry, disconnect/reconnect, rời và chuyển giao người dẫn.
- Hai đội cùng vụ đi hai nhánh khác nhau, cùng có đủ chứng cứ; một ván toàn lớp đầy đủ; hồi quy các game hiện có.
- Thử với nhóm B1 thật: có bàn luận trước khi chọn hành động, mọi người chia sẻ được manh mối, đổi giả thuyết có lý do, và giải thích được kết luận trong khoảng 24 phút. Quan sát số lượt đóng góp và điểm nghẽn từ vựng; không dùng số lần bấm làm bằng chứng đã nói tiếng Anh.

## 10. Để người lập kế hoạch/người làm quyết

- Tên game cuối cùng, chi tiết mỹ thuật và bố cục theo style hiện có; không cần đồ họa bản đồ để chơi bản đầu.
- Tổ chức dữ liệu, cấu trúc validator/solver, cách biểu diễn điều kiện hành động và tập chứng cứ, tên ID, thuật toán shuffle dùng tiện ích hiện có.
- Chi tiết câu chữ, danh tính hư cấu và vật chứng của ba họ vụ án, miễn đáp ứng B1, quy mô nội dung và các kiểm tra §7.
- Khoảng min/max và bước chỉnh thời gian phù hợp config form hiện có; mô tả rõ tổng thời lượng cho host.
- Cách tích hợp module với host controls, shared deadlines và view filters; tái sử dụng cơ chế hiện có và giữ hành vi game khác.

Sau khi người dùng duyệt bản thiết kế, bước tiếp theo là lập kế hoạch triển khai riêng. Tài liệu này chưa cho phép bắt đầu viết code sản phẩm.
