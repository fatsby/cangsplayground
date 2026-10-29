# Guess the Character — thiết kế

Trạng thái: chờ người dùng duyệt. Chưa triển khai game.

Các mục ghi **(Đề xuất của Codex)** là chi tiết chưa được người dùng chốt riêng; được đưa vào tài liệu để duyệt cùng thiết kế.

## 1. Mục đích và phạm vi

Minigame cho học sinh ESL A1–A2: hai nhóm hỏi và trả lời bằng tiếng Anh để đoán nhân vật bí mật của nhau. Nhiều cặp đấu diễn ra đồng thời; app điều phối lượt để từng thành viên có cơ hội hỏi và hỗ trợ học sinh bằng mẫu câu, ngữ pháp, từ vựng.

Mục tiêu:

- Host chia nhóm, chọn game, chỉnh thời gian, bắt đầu round và theo dõi tất cả các cặp trên host console.
- Số nhóm chẵn, mỗi nhóm từ một người; tất cả nhóm được ghép cặp ngẫu nhiên trong mỗi round.
- Mỗi cặp tự vote category, nhận hai nhân vật khác nhau, hỏi đáp luân phiên và tìm đội thắng độc lập.
- Người chơi A1–A2 biết mình cần làm gì và có gợi ý tiếng Anh ngay trên điện thoại.
- Giữ style hiện tại của app và dùng lại SecretCard của Who’s the Spy.

Ngoài phạm vi **(Đề xuất của Codex)**: chấm chất lượng câu hỏi/câu trả lời, ghi âm, nhận diện giọng nói, chatbot/AI, chat trong app, host tự nhập nhân vật, đấu loại trực tiếp, bảng điểm cộng dồn qua nhiều round.

Những điều phải tránh:

- Lộ nhân vật đối phương qua payload, máy chiếu, gợi ý, thông báo hoặc tên trong hướng dẫn.
- Chỉ thành viên mạnh nhất liên tục được hỏi.
- Cho từng thành viên thay nhau đoán để vượt cooldown của nhóm.
- Timer phụ thuộc vào điện thoại host hoặc điện thoại học sinh đang mở.
- Thay đổi hành vi các game hiện có khi thêm cơ chế timer mới.

## 2. Các hướng đã cân nhắc

### Hướng 1 — module game riêng, được người dùng chọn

Tạo `packages/games/guess-the-character`, tận dụng lobby, roster, chia nhóm, GameModule/shared state, GameViews và bộ UI có sẵn. Module quản lý các cặp đấu và luật chơi; bổ sung khả năng đặt deadline phía server cho shared-state game.

Ưu điểm: phạm vi tập trung, ít ảnh hưởng game khác, phù hợp cách Shark Tank đã tích hợp shared state. Đổi lại, thứ tự lượt giữa hai nhóm nằm trong module này và cần mở rộng nhỏ ở contract/server cho deadline.

### Hướng 2 — cơ chế đối kháng theo cặp ở core

Đưa pairing, lượt nói liên nhóm và vòng đời trận vào phần lõi để nhiều game dùng chung. Thuận lợi cho nhiều minigame đối kháng về sau nhưng phạm vi thay đổi và kiểm tra lớn hơn. Chưa chọn vì nhu cầu hiện tại là một minigame cụ thể.

## 3. Cài đặt và điều kiện bắt đầu

Game settings trên host console, dùng ConfigForm/configFields hiện có:

| Setting | Mặc định | Quy tắc |
|---|---|---|
| Category vote time | 30 giây **(Đề xuất của Codex)** | 10–180 giây, bước 5 giây **(Đề xuất của Codex)** |
| Turn time | 120 giây | Dùng chung cho một câu hỏi và phần trả lời; 15–600 giây, bước 15 giây **(Đề xuất của Codex về giới hạn)** |
| Wrong guess cooldown | 5 giây | Cả nhóm cùng chịu; 1–60 giây, bước 1 giây **(Đề xuất của Codex về giới hạn)** |

Mọi thời gian host chỉnh được trước Prepare. Settings cố định trong session đang chơi, theo quy tắc shared-state game hiện có **(Đề xuất của Codex)**.

- Tối thiểu hai nhóm; tổng số nhóm chẵn.
- Mỗi nhóm tối thiểu một thành viên, không bổ sung giới hạn tối đa riêng của game **(Đề xuất của Codex)**.
- Sĩ số hai nhóm có thể khác nhau.
- Server kiểm tra điều kiện khi Prepare và trước round mới; UI giải thích rõ nếu số nhóm lẻ hoặc có nhóm rỗng.
- Dùng công cụ chia và chỉnh nhóm hiện có; không tự thay đổi kế hoạch chia nhóm để ép đủ số chẵn **(Đề xuất của Codex)**.

## 4. Vòng đời round và các trận

### 4.1 Chuẩn bị, ghép cặp và bắt đầu

**(Đề xuất của Codex về thao tác host và ranh giới round)**:

1. Host Prepare: kiểm tra nhóm, tạo round 1, shuffle toàn bộ nhóm rồi ghép các nhóm liền nhau thành cặp. Hiện cặp đấu ở trạng thái READY; chưa chạy timer.
2. Host bấm Start round: mọi cặp vào CATEGORY_VOTE cùng lúc.
3. Từng cặp hết giờ vote thì tự chốt category và chuyển sang PLAYING. Mỗi cặp có timer riêng.
4. Cặp có đội thắng vào FINISHED; cặp khác tiếp tục chơi.
5. Khi toàn bộ cặp đã FINISHED hoặc ENDED, host có thể bấm New round. Bắt đầu vote của round mới với pairing và nhân vật mới. Không tự bắt đầu round tiếp.

Shuffle độc lập mỗi round; có thể gặp lại đối thủ cũ **(Đề xuất của Codex)**. Không đòi hỏi tránh lặp cặp. Việc đổi nhóm giữa session tuân theo giới hạn hiện có; host thoát game để xếp lại rồi Prepare.

### 4.2 Vote category

- Mỗi học sinh của hai nhóm trong cặp có một phiếu; các cặp vote độc lập.
- Chọn trong danh mục category có sẵn. Bản đầu mở rộng thành chín category theo §5.1, theo yêu cầu người dùng có thêm nhiều category; danh sách cụ thể là **đề xuất của Codex**.
- Phiếu là lựa chọn một category; có thể đổi trước deadline, server giữ lựa chọn cuối cùng **(Đề xuất của Codex)**.
- Chờ hết thời gian cấu hình rồi chốt, kể cả đã đủ phiếu.
- Category có tổng phiếu lớn nhất thắng; nhiều category cùng cao nhất thì random trong các category hòa.
- Không có phiếu: tất cả category đồng hạng 0, random trong toàn bộ category **(Đề xuất của Codex)**.
- Đây là vote theo đa số; nhóm đông người có nhiều phiếu hơn. Không yêu cầu hai nhóm đồng thuận tuyệt đối hoặc phải vote lại.
- Server chọn hai nhân vật khác nhau trong category đó, một nhân vật cho mỗi nhóm.

### 4.3 Hỏi và trả lời

- Mọi thành viên Red thấy nhân vật của Red bằng thẻ đè giữ; Blue đoán nhân vật này, và ngược lại. Host thấy cả hai.
- Người hỏi thay phiên theo nhóm. Trong mỗi nhóm giữ một vòng xoay thành viên riêng.
- **(Đề xuất của Codex về random ban đầu)**: shuffle thứ tự thành viên một lần mỗi round và random nhóm hỏi trước cho từng cặp.
- Ví dụ Red [A,C], Blue [B,D]: A → B → C → D → A…
- Nếu Red [A] và Blue [B,C,D]: A → B → A → C → A → D… Hai nhóm luôn luân phiên; thành viên nhóm ít người được hỏi thường xuyên hơn.
- Đến lượt Blue hỏi thì Red trả lời tự do bằng lời nói; sau đó đổi chiều. Câu hỏi mở và Yes/No đều được phép. Nhóm trả lời tự phối hợp, app không chỉ định người trả lời **(Đề xuất của Codex)**.
- Timer bắt đầu ở 120 giây mặc định cho cả hỏi và trả lời, dùng setting Turn time.
- Hết giờ tự chuyển lượt. Người đang có lượt hỏi có thể bấm “I'm done” để kết thúc lượt sớm; server kiểm tra đúng người và đúng lượt **(Đề xuất của Codex về quyền bấm nút)**.
- Không tách một timer riêng cho bên trả lời.
- Không giới hạn số vòng xoay lượt; chơi đến khi đoán đúng hoặc host kết thúc trận **(Đề xuất của Codex)**.
- Vòng xoay tạo cơ hội hỏi cho mọi thành viên. Trận vẫn kết thúc ngay khi đoán đúng, kể cả có người chưa đến lượt đầu tiên **(Đề xuất của Codex, ưu tiên luật thắng ngay)**.

### 4.4 Đoán và cooldown

- Trong PLAYING, bất kỳ thành viên nào cũng được nhập tên nhân vật của nhóm đối phương, kể cả ngoài lượt hỏi của mình.
- Server normalization rồi so khớp chính xác với tên hợp lệ của nhân vật. Đúng thì nhóm gửi đáp án thắng ngay.
- Sai thì cả nhóm bị khóa gửi đáp án trong số giây Wrong guess cooldown. Tất cả điện thoại nhóm đó cùng thấy countdown; hỏi đáp và timer lượt tiếp tục.
- Hết cooldown tự được nhập tiếp. Không cần host mở khóa.
- Payload sai định dạng, rỗng hoặc quá dài không tính là một lần đoán sai **(Đề xuất của Codex)**.
- Kết quả gửi về không tiết lộ đáp án đúng, độ gần đúng, hoặc nhân vật có tồn tại trong danh mục hay không **(Đề xuất của Codex)**.

Normalization **(Đề xuất của Codex)**:

1. Unicode NFKC; chuyển chữ thường.
2. Loại dấu phân cách/khoảng trắng/dấu câu; giữ chữ và số. Ví dụ `Spider-Man`, `spider man`, `SPIDERMAN` cùng khớp.
3. So exact với canonical name và aliases được ghi rõ trong dữ liệu; không tự dịch hay fuzzy match. Ưu tiên tên tiếng Anh quen thuộc; category truyện dân gian Việt Nam dùng tên tiếng Việt gốc. Chỉ thêm alias thật sự là biến thể tên của cùng nhân vật, được kiểm tra không trùng nhân vật khác trong category. Với tên tiếng Việt, ghi rõ alias không dấu (ví dụ “Thánh Gióng” / “Thanh Giong”); không tự suy ra mọi biến thể bằng cách bỏ dấu toàn bộ danh mục.
4. Sai chính tả như `Spidermen` vẫn sai. Không coi `Thor DC Comics` hoặc tên kèm franchise tùy ý là đúng.

Tên trong thẻ là tên ngắn quen thuộc, chẳng hạn “Thor”, thay vì một chuỗi có nhãn franchise. Không gửi toàn bộ bộ đáp án tới client.

### 4.5 Kết quả và host controls

- Đoán đúng: cố định winner, dừng timer trận, khóa guess/done, hiện nhóm thắng và lời nhắc chờ host.
- **(Đề xuất của Codex)**: trên điện thoại của hai nhóm trong cặp và host có thể xem cả hai nhân vật sau khi trận kết thúc. Máy chiếu chỉ công bố đội thắng, không hiện đáp án để tránh ảnh hưởng những cặp đang chơi cùng category.
- **(Đề xuất của Codex)**: host có Pause/Resume và Skip turn cho từng cặp; có Pause all/Resume all. Pause khóa vote/guess/done và giữ thời gian còn lại của vote, lượt và cooldown; resume tiếp tục từ đó.
- Host có End match cho từng cặp khi không tìm được đáp án hoặc gặp vấn đề; trận vào ENDED, không có đội thắng **(Đề xuất của Codex)**.
- Không có deadline tổng cho trận ở bản đầu **(Đề xuất của Codex)**.
- New round chỉ khả dụng khi mọi cặp đã kết thúc; host có thể End match các cặp còn lại. Nhóm kết thúc trước chờ host trong khi nhóm khác chơi **(Đề xuất của Codex)**.

## 5. Nội dung và hỗ trợ A1–A2

### 5.1 Nhân vật

App có dữ liệu tĩnh được kiểm tra trước: category ID, nhãn hiển thị, character ID, tên quen thuộc và aliases. Không dùng AI chọn đáp án lúc chạy.

Nhân vật phải quen thuộc với học sinh phổ thông; Blue Beetle là ví dụ quá niche cần tránh. Mỗi category cần ít nhất hai nhân vật hợp lệ và nên có khoảng 10–12 nhân vật trong bản đầu **(Đề xuất của Codex về số lượng)**.

**Danh mục mở rộng đề xuất của Codex:** chín category, mỗi category 10–12 nhân vật. Ưu tiên hoạt hình, phim, game và truyện quen thuộc với học sinh Việt Nam; không cần biết diễn viên, tác giả hoặc chi tiết cốt truyện sâu mới mô tả được.

| Category | Nhân vật trong bộ khởi đầu đề xuất |
|---|---|
| Superheroes | Superman, Batman, Wonder Woman, Spider-Man, Iron Man, Captain America, Thor, Hulk, Black Widow, Black Panther, The Flash, Aquaman |
| Disney Princesses | Snow White, Cinderella, Aurora, Ariel, Belle, Jasmine, Mulan, Tiana, Rapunzel, Merida, Moana, Pocahontas |
| Classic Cartoons | Mickey Mouse, Minnie Mouse, Donald Duck, Goofy, Tom, Jerry, Bugs Bunny, Daffy Duck, Scooby-Doo, SpongeBob SquarePants, Patrick Star, Popeye |
| Animated Movies | Shrek, Donkey, Po, Tigress, Woody, Buzz Lightyear, Nemo, Dory, Lightning McQueen, WALL-E, Baymax, Stitch |
| Anime & Manga | Doraemon, Nobita, Shizuka, Dorami, Shin-chan, Conan Edogawa, Naruto Uzumaki, Monkey D. Luffy, Son Goku, Sailor Moon, Pikachu, Totoro |
| Video Game Characters | Mario, Luigi, Princess Peach, Bowser, Yoshi, Donkey Kong, Sonic, Tails, Kirby, Pac-Man, Steve, Link |
| Fairy Tales | Little Red Riding Hood, Pinocchio, Peter Pan, Tinker Bell, Alice, Aladdin, Genie, Rapunzel, Snow White, Cinderella |
| Vietnamese Folk Tales | Tấm, Cám, Thánh Gióng, Sơn Tinh, Thủy Tinh, Thạch Sanh, Lý Thông, Sọ Dừa, Chú Cuội, Chị Hằng |
| Famous Villains | Joker, Harley Quinn, Thanos, Voldemort, Maleficent, Ursula, Jafar, Cruella de Vil, Captain Hook, Scar, Hades, Evil Queen |

Danh mục này sẽ được người dùng duyệt cùng tài liệu. Việc phổ biến phụ thuộc lớp cụ thể; bỏ hoặc thay nhân vật nào lớp không quen trước khi chốt bộ dữ liệu. Không lấp đủ số lượng bằng nhân vật phụ quá niche. Trong prep, mỗi category có nhãn dễ hiểu và ví dụ 2–3 nhân vật từ bộ trên để học sinh biết đang vote chủ đề nào **(Đề xuất của Codex)**.

Category có thể giao nhau: Snow White có thể thuộc cả Disney Princesses và Fairy Tales. Dùng cùng character ID cho cùng một nhân vật trong nhiều category; category xác định pool để chọn và gợi ý học tập, không tạo một đáp án khác cho phiên bản khác. Alias quen thuộc cần được ghi rõ, chẳng hạn “Conan”, “Naruto”, “Luffy”, “Goku”, “SpongeBob”, “Cruella”, “Snow White” / “Bạch Tuyết” nếu hỗ trợ tên Việt tương ứng **(Đề xuất của Codex)**. Không bật alias tên Việt hàng loạt nếu chưa được biên soạn.

Canonical names/aliases phải normalization không rỗng và không mơ hồ trong category. Hai nhóm cùng trận không nhận cùng character ID; các cặp khác có thể trùng. Không thêm cơ chế tránh lặp nhân vật qua round ở bản đầu **(Đề xuất của Codex)**.

### 5.2 Gợi ý tiếng Anh

- Player view có cấu trúc câu, ngữ pháp và từ vựng cho A1–A2, hỗ trợ cả hỏi và trả lời.
- **(Đề xuất của Codex theo bản mẫu)**: chọn A1 hoặc A2 trên máy mình; mặc định A1, lưu lựa chọn cục bộ. Giao diện chính bằng tiếng Anh như app hiện tại; mẫu câu và từ vựng có nghĩa tiếng Việt.
- Gợi ý dựa trên category và vai trò hỏi/trả lời; không suy ra từ đáp án đối phương. Từ vựng đủ đa dạng cho nhiều nhân vật, không chỉ đưa vài từ ám chỉ một đáp án.
- Không tự tạo câu trả lời hoàn chỉnh theo nhân vật của nhóm; học sinh tự chọn thông tin để nói **(Đề xuất của Codex)**.

Ví dụ A1: “Is your character ___?”, “Can your character ___?”, “What does your character wear?”, “My character can ___.”

Ví dụ A2: “What does your character look like?”, “What is your character famous for?”, “My character uses ___ to ___.”

Mẹo ngữ pháp ngắn như “can + động từ nguyên mẫu”. Mỗi category phải có bộ hỗ trợ A1/A2 riêng, gồm câu hỏi, câu trả lời, mẹo ngữ pháp và nghĩa tiếng Việt. Không dùng nguyên bộ từ Superheroes cho toàn bộ category. Từ vựng minh họa **(Đề xuất của Codex)**:

| Category | Từ vựng gợi ý chung |
|---|---|
| Superheroes | fly/bay, strong/khỏe, mask/mặt nạ, cape/áo choàng, shield/khiên, power/sức mạnh |
| Disney Princesses | dress/váy, castle/lâu đài, sing/hát, hair/tóc, brave/dũng cảm, kind/tốt bụng |
| Classic Cartoons | animal/động vật, funny/hài hước, small/nhỏ, chase/đuổi theo, friend/bạn, hungry/đói |
| Animated Movies | toy/đồ chơi, robot/người máy, fish/cá, car/xe hơi, family/gia đình, adventure/cuộc phiêu lưu |
| Anime & Manga | student/học sinh, robot/người máy, detective/thám tử, ninja, pirate/cướp biển, magic/phép thuật |
| Video Game Characters | jump/nhảy, run/chạy, collect/thu thập, build/xây, race/đua, rescue/giải cứu |
| Fairy Tales | forest/rừng, magic/phép thuật, fairy/tiên, wish/điều ước, wooden/bằng gỗ, tower/tòa tháp |
| Vietnamese Folk Tales | village/làng, bamboo/tre, moon/mặt trăng, mountain/núi, river/sông, brave/dũng cảm |
| Famous Villains | powerful/mạnh mẽ, cruel/độc ác, jealous/ghen tị, trick/lừa, fight/chiến đấu, enemy/kẻ thù |

Giữ bộ từ chung của category đủ rộng, không đưa từ riêng của đáp án đối phương hoặc tự động ưu tiên từ khớp đáp án. Câu mẫu bổ sung theo chủ đề, ví dụ “Is your character an animal?”, “Where does your character live?”, “What does your character want?”, cùng mẫu trả lời tương ứng. Với truyện dân gian Việt Nam, tên riêng giữ tiếng Việt nhưng phần hỏi đáp và gợi ý vẫn bằng tiếng Anh đơn giản kèm nghĩa Việt.

## 6. Giao diện và quyền xem

Style dùng đúng tokens/components của app: nền tím tối, accent cyan, nút tím, Unbounded và Be Vietnam Pro, team badge theo palette hiện có. Bản mẫu nằm trong `.superpowers/brainstorm/`, chỉ là tài liệu thảo luận.

### Player

- READY: cặp đấu và lời nhắc chờ host.
- CATEGORY_VOTE: đối thủ, danh sách category kèm ví dụ ngắn, lựa chọn hiện tại, số người đã vote và timer. Chưa có thẻ nhân vật. Với chín category, danh sách cuộn được; timer và trạng thái phiếu vẫn dễ thấy, không thu nhỏ chữ để ép mọi category vào một màn **(Đề xuất của Codex)**.
- PLAYING: nhóm/đối thủ, category, người đang hỏi và người hỏi tiếp theo, countdown lượt, thẻ bí mật, phần hỗ trợ tiếng Anh và ô đoán nhân vật đối phương.
- Chỉ người đang hỏi thấy nút “I'm done” hoạt động. Người khác thấy mình đang chờ ai.
- Cooldown khóa ô gửi đáp án cho cả nhóm và hiện thời gian còn lại.
- FINISHED/ENDED: kết quả của cặp, lời nhắc chờ host; không có nút tự tạo trận mới.

### Thẻ bí mật

Dùng chính `SecretCard` từ `@cangsplayground/ui`, giống Who’s the Spy:

- Mặc định úp, “Hold to see your card” / “Let go to hide it”.
- Đè giữ chuột/touch hoặc Space/Enter mới lật và mount nội dung nhân vật. Thả ra thì bỏ nội dung và úp lại.
- Che lại khi pointer cancel/lost capture, mất focus, cửa sổ blur hoặc chuyển tab.
- Không lặp tên nhân vật trong hướng dẫn, từ vựng, tooltip hoặc accessible label khi thẻ đang úp.
- Lớp che này chống nhìn lén màn hình. Server vẫn gửi nhân vật của chính nhóm cho thành viên có quyền xem; nhân vật đối phương không được gửi trước kết quả.

### Host console

- Game settings trước Prepare.
- READY và Start round; sau khi các trận kết thúc có New round.
- Danh sách cặp, category, trạng thái vote, hai nhân vật, người đang hỏi, timer, cooldown và kết quả.
- Controls theo §4.5; host thấy đáp án mà không cần đè giữ **(Đề xuất của Codex về thao tác host)**.

### Máy chiếu

Lưới các cặp: hai team badge, trạng thái chuẩn bị/đang chơi/đã kết thúc, category sau vote, người đang hỏi, timer và kết quả. Không có nhân vật bí mật hoặc lịch sử tên đoán sai **(Đề xuất của Codex về nội dung công khai)**.

| Dữ liệu | Player thuộc cặp | Player cặp khác | Máy chiếu | Host |
|---|---|---|---|---|
| Pairing, trạng thái, người hỏi, timer, kết quả | Có | Có, dạng tổng quan | Có | Có |
| Vote cá nhân | Chỉ phiếu của mình | Không | Không | Có **(Đề xuất)** |
| Category thắng | Có | Có | Có | Có |
| Nhân vật của nhóm trong PLAYING | Chỉ nhóm mình, thẻ giữ | Không | Không | Có |
| Nhân vật đối phương trong PLAYING | Không | Không | Không | Có |
| Hai đáp án sau kết thúc cặp | Có **(Đề xuất)** | Không | Không | Có |
| Cooldown | Nhóm mình | Không | Không | Có |
| Chuỗi đang gõ để đoán | Chỉ thiết bị đang gõ | Không | Không | Không |

## 7. Tích hợp và tính đúng của server

### 7.1 Module và dữ liệu

Module mới đăng ký ở registry server/web và dependency manifest tương ứng. Dùng shared-state game tương tự Shark Tank: `prepareShared`, `onSharedAction`, `onSharedPlayerLeft`, `onSharedRosterChange`, `sharedViewFor`; group data có thể là null. Dùng session-level player/host/projector views.

Shared state gồm round ID, snapshot roster, các cặp với match ID, phase, category votes, hai character ID, hai vòng xoay thành viên, bên đang hỏi, turn ID, timer, trạng thái pause, cooldown từng nhóm và kết quả.

Module có action riêng cho vote/guess/done/host controls. Nút “I'm done” dùng action có namespace của game; không dùng `turn:done` của core vì action đó hiện được xử lý trước shared-action routing.

### 7.2 Timer phía server

TimerService hiện chỉ đặt deadline của group runtime và session clock. Shared-state game chưa có callback timer tổng quát. Bổ sung contract tùy chọn để module xuất các deadline cần đánh thức và xử lý deadline hết hạn. Tên hook và kiểu cụ thể giao người xây dựng quyết.

- Server đặt lịch theo match, phase và turn/version; vote và lượt tự hết hạn khi không có client online.
- Callback chỉ tác động khi round/match/phase/turn/deadline vẫn khớp. Timer cũ của lượt trước, timer đã pause và timer sau khi kết thúc phải vô hiệu.
- Reconcile/hủy timer khi state thay đổi, round mới, exit, lobby đóng và dispose.
- Client chỉ render countdown từ serverNow và deadline; client không được tự quyết phase/category/winner.
- Cooldown có thể mở lại bằng so `now` với timestamp khi nhận action; không bắt buộc callback riêng mỗi giây.
- Trước khi xử lý action, giải quyết deadline đã đến hạn bằng cùng logic hết giờ. Vote tới đúng/sau deadline không tính; done của lượt đã hết không làm nhảy thêm; guess ở deadline được xử lý theo trạng thái hợp lệ sau khi chuyển lượt.
- Không gửi tick event liên tục. Broadcast khi state thực sự đổi; countdown chạy cục bộ.
- Hook mới tùy chọn, các module khác giữ nguyên hành vi.

### 7.3 Đồng thời và kiểm tra quyền

- Server kiểm tra actor thuộc đúng nhóm/cặp, match đang chơi, chưa pause, hết cooldown và payload hợp lệ.
- Action có round/match ID; done thêm turn ID. Controls/vote có phase hoặc version phù hợp để các lệnh cũ không tác động state mới.
- Mọi đường chuyển lượt dùng chung một hàm; timer hết và done cùng lúc chỉ chuyển một lần.
- Hai guess cạnh tranh xử lý tuần tự ở server; guess hợp lệ được xử lý trước xác lập winner. Các guess sau khi kết thúc bị từ chối.
- Hai guess sai gần nhau từ cùng nhóm chỉ chấp nhận lần đầu, rồi cả nhóm vào cooldown; request đến trong cooldown không kéo dài thêm thời gian.
- Settings/host controls kiểm tra quyền host; danh mục và secrets được lọc trong `sharedViewFor` trước broadcast.
- Không lưu/phát công khai lịch sử guess sai **(Đề xuất của Codex)**.

### 7.4 Mất kết nối và thay đổi roster — đề xuất của Codex

- Mất kết nối tạm thời giữ thành viên, phiếu và thứ tự; timer đang chạy tiếp tục. Reload khôi phục đúng match, lượt và cooldown, thẻ trở lại úp.
- Khi chọn người hỏi tiếp, bỏ qua người đang disconnected; reconnect trước lượt sau được tham gia lại. Nếu người đang hỏi disconnect, lượt đó vẫn chạy đến timeout hoặc host skip.
- Nếu một nhóm không còn ai online ở thời điểm bắt đầu lượt mới, tự pause cặp và báo host; không tự forfeit. Host resume khi có người quay lại hoặc End match. Quy tắc cũng áp dụng khi hết vote mà một bên không có ai online.
- Rời lobby chính thức: xóa khỏi vòng xoay và phiếu chưa chốt. Nếu đang là người hỏi thì chuyển lượt đúng một lần. Nhóm rỗng kết thúc riêng cặp đó với lý do thiếu người, không trao thắng tự động. Các cặp khác tiếp tục.
- Người mới vào giữa round chờ round tiếp theo; không tham gia vote/guess hiện tại. Server dùng snapshot thành viên của round để xác định quyền; không chỉ kiểm tra groupId hiện thời.
- Trước New round kiểm tra lại các nhóm; nếu có nhóm rỗng hoặc số nhóm không hợp lệ thì host cần thoát để xếp lại.
- Theo kiến trúc Phase 1 hiện có, state ở RAM; không bổ sung khôi phục session sau server restart.

## 8. Kiểm chứng cần có

- Luật ghép cặp chẵn/lẻ, nhóm một người, nhóm khác sĩ số, xoay hết thành viên và luân phiên đúng bên.
- Vote theo học sinh, đổi phiếu, hòa, không có phiếu, deadline đến khi không có client online.
- Hai nhân vật khác nhau trong một cặp, nội dung không niche theo danh mục đã duyệt, normalization và alias không mơ hồ.
- Guess đúng ngoài lượt, guess sai tạo cooldown chung, yêu cầu đồng thời và payload cũ không vượt khóa hoặc gây hai winner.
- Timer 120 giây cấu hình được, I'm done đúng quyền, timeout/done cạnh tranh, pause/resume giữ cả cooldown, callback cũ bị bỏ.
- Kiểm tra payload cho player/host/projector; giữ đúng bí mật cả sau kết quả của cặp khác.
- SecretCard đè giữ/thả/cancel/blur/tab change; tên không xuất hiện ở phần khác khi thẻ úp.
- Player hiển thị A1/A2, hỏi/trả lời/đợi, cooldown, kết quả; host quản lý nhiều cặp song song.
- Luồng tích hợp 4 nhóm: vote riêng → chơi song song → một cặp thắng → cặp còn lại tiếp tục → host bắt đầu round mới.
- Chạy các kiểm tra hiện có của core/server/web và games bị ảnh hưởng; build/typecheck theo script của repo.

## 9. Giao cho người xây dựng

Người xây dựng quyết tên hook timer, tên action, cấu trúc file chi tiết, tổ chức reducer, giới hạn độ dài input hợp lý, bố trí màn hình chi tiết và nội dung gợi ý từng category trong các ràng buộc trên. Dùng UI component và conventions hiện có; không thêm dependency nếu thư viện sẵn có đáp ứng được.

Các lựa chọn sản phẩm của Codex cần người dùng lưu ý khi duyệt: vote mặc định 30 giây; chín category và danh mục nhân vật mở rộng, đặc biệt những nhân vật có thể chưa quen với lớp; chỉ người đang hỏi bấm I'm done; vòng xoay có thể kết thúc sớm khi đoán đúng; tên quen thuộc exact sau normalization và alias ghi rõ (bao gồm tên Việt gốc cho truyện dân gian Việt Nam); host khởi động round chung khi các cặp đều kết thúc; End match khi cần; cách xử lý mất kết nối và rời nhóm.
