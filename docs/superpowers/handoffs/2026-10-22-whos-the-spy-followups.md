# Who's the Spy: việc còn lại sau playtest

Handoff cho người làm tiếp. Nhánh `feat-whos-the-spy` (HEAD `a2b5c88`) đã qua playtest lần 2 ngày 2026-10-22: 28/31 lỗi cũ đã hết, không có lỗi mới, không còn lỗi chặn chơi. Danh sách dưới đây là những gì **còn sót**, xếp theo mức ưu tiên.

Nguồn: báo cáo playtest `/tmp/playtest-retest/REPORT.md` cùng ảnh trong `/tmp/playtest-retest/shots/`. Đây là thư mục tạm, có thể mất khi khởi động lại máy, nên các bước tái hiện được chép lại đầy đủ ở đây. Spec: `docs/superpowers/specs/2026-10-22-whos-the-spy-design.md`. Mockup: `docs/superpowers/specs/2026-10-22-whos-the-spy/new-screens.html` và `style-preview.html#arcade`.

## A. Lỗi còn sót (minor)

### A1. Bấm "I'm done" khi mất mạng: im lặng vài giây, cú bấm bị bỏ

- **Tái hiện:** Free Talk (hoặc Who's the Spy), Start. Đến lượt học sinh X thì tắt mạng máy X (Playwright `context.setOffline(true)`). Chờ 3 giây rồi bấm I'm done.
- **Hiện tại:**
  - Ngay sau khi bấm, nút chuyển sang busy và không có thông báo nào (ảnh `098`).
  - Vài giây sau mới hiện "Reconnecting… / Offline…" (`100`).
  - Có mạng lại thì lượt nói vẫn đúng, nút bật lại (`102`). Nhưng cú bấm cũ không được gửi lại, học sinh phải bấm thêm lần nữa.
- **Mong muốn:** học sinh biết ngay là chưa gửi được, hoặc cú bấm được gửi lại khi có mạng. Spec §8 chấp nhận để timer tự hết, nên đây chỉ là minor.
- **Code liên quan:**
  - `apps/web/src/routes/Player.tsx`, hàm `done()`: race với timeout 5 s, hết giờ thì toast "Couldn't reach the server. Tap again.".
  - `doneLabel` đổi thành "Offline…" khi `connection !== "online"`.
  - Socket.IO chỉ nhận ra mất kết nối khi hết ping timeout, nên có khoảng trễ.
- **Hướng sửa gợi ý:** hiện ngay trạng thái "Sending…" trên nút. Còn việc gửi lại sau khi kết nối lại thì phải chống gửi trùng: chỉ gửi lại nếu vẫn đúng `round`/`turnIndex`.
- **Chưa kiểm:** chưa tái hiện đúng ca cũ trong Who's the Spy (máy mất mạng khoảng 50 s).

### A2. Màn kết thúc không có bảng đếm phiếu của lần vote cuối

- **Tái hiện:** nhóm 3 người, 2 phiếu cho dân A, 1 phiếu cho spy. Spy thắng vì dân không còn đông hơn spy. Cũng gặp khi lần vote cuối bắt được spy (Team wins).
- **Hiện tại:** màn You win / You lose ghi "A was voted out: was NOT the spy", nhưng không có tally 2–1 ở đâu cả (`066`–`071`, `094`). Các lần vote giữa ván thì có tally (`055`).
- **Mong muốn:** spec §3.4 bước 5 muốn cả nhóm thấy kết quả vote, gồm số phiếu.
- **Code liên quan:**
  - Server đã gửi `lastVote.tally` cho thành viên nhóm, xem `viewFor` trong `packages/games/whos-the-spy/src/logic.ts`.
  - Chỉ thiếu phần hiển thị: nhánh `data.result` của `PlayerScreen` trong `packages/games/whos-the-spy/src/views/index.tsx`.
  - Có thể tái dùng `<ul className="wts-tally">` từ màn ROUND_END.

### A3. Màn host còn thiếu thông tin tóm tắt như mockup

- **Hiện tại:** từng nhóm đã có các trạng thái Speaking (kèm tên), Voting x/y, Waiting for Continue, Paused và kết quả thắng (`027`, `053`, `073`). Còn thiếu:
  - Số lần vote hoặc số phiếu của từng nhóm, ví dụ "Team won · 2 votes" trong mockup.
  - Câu tóm tắt tiến độ cả lớp ở đầu trang, ví dụ "Round 2 of 2 done in 2 groups".
  - Các nút phụ bị disable vẫn chiếm chỗ, làm thẻ nhóm đang chạy cao trên điện thoại.
- **Code liên quan:** `HostGroupStatus` trong `packages/games/whos-the-spy/src/views/host.tsx` và `apps/web/src/components/HostGame.tsx`.
- **Chưa kiểm:** chữ số ít "1 team" ở chân máy chiếu (`apps/web/src/routes/Display.tsx`). Code đã có nhánh số ít nhưng playtest chưa có ván nào chỉ 1 nhóm.

## B. Giao diện chưa giống mockup (cosmetic)

1. **Lựa chọn vote:** chưa có chấm radio như mockup (`.wts-vote-option` trong `whos-the-spy.css`).
2. **Kết quả vote giữa ván:** chữ verdict gần như toàn màu trắng. Mockup tô vàng (amber) và làm nổi hàng nhiều phiếu nhất trong tally (`.wts-verdict`, `.wts-tally`) (`054`–`055`).
3. **Sau khi khoá phiếu:** có "Vote locked" và thanh tiến độ nhưng thiếu câu "Waiting for others…" để học sinh biết bước tiếp theo (`050`).
4. **Gợi ý số spy tối đa:**
   - Đang nằm dưới nút Save, xa ô chọn Spies, đôi khi phải cuộn mới thấy.
   - Chữ là "up to 1 spy", mockup ghi "Max 1 for a group of 3".
   - Nên đặt ngay cạnh hoặc dưới stepper Spies (`HostConfigNote` trong `host.tsx`) (`006`–`007`).
5. **Form cài đặt dài:** hiện đủ 17 chip topic (Random và 16 topic) cùng lúc. Có thể chỉ hiện topic của category đang chọn hoặc thu gọn bớt.
6. **Thẻ nhóm đã xong trên máy chiếu:** có "Done" và kết quả tô màu, nhưng thiếu dòng phụ "Spy caught in N votes" như mockup (`072`).
7. **Header điện thoại:** tên dài bị cắt bằng dấu "…". Cách này giữ được bố cục 360 px nhưng không thấy tên đầy đủ (`031`, `046`). Có thể chấp nhận. Nếu muốn, hãy hiện đủ tên ở nơi khác, ví dụ trong thẻ bí mật.
8. **Màn kết thúc:** chữ "Game over" lặp hai lần, một ở chip đồng hồ và một ở dòng trạng thái (`066`–`071`).
9. **Máy chiếu, ghi chú nhỏ:** tên người bị loại bị gạch ngang. Khi Team wins, người bị gạch cuối cùng chính là spy. Điều này khớp spec, không phải lỗi lộ dữ liệu, ghi lại để cân nhắc.

## C. Chưa được kiểm lại ở lần playtest này

- Soi dữ liệu socket thô gửi về máy chiếu. Lần playtest đầu đã soi và sạch. Lần này chỉ kiểm phần hiển thị.
- Sau khi Prepare, mở lại form cài đặt để sửa giữa ván.
- Speaker highlight trên máy chiếu khi pause trong lúc đang nói (lần này chỉ pause lúc vote).

## Cách kiểm sau khi sửa

1. `pnpm lint && pnpm typecheck && pnpm test`
2. `pnpm --filter @cangsplayground/server sim -- --game whos-the-spy`
3. `pnpm build`, rồi playtest bằng Playwright theo các bước tái hiện ở trên, với ba loại máy: máy chiếu 1920×1080, Pixel 7 / iPhone 13 và 360×640.
