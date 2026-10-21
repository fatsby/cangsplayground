# DESIGN.md — ClubPlay · Arcade Night

> Tài liệu quy ước thiết kế **duy nhất** cho UI của ClubPlay. Áp dụng cho `apps/web`, `packages/ui`, `packages/games/*/src/views`.
> Agent (Claude) và dev **đọc file này trước khi viết bất kỳ UI nào** và tuân thủ tuyệt đối. Nếu gặp trường hợp chưa được nêu, chọn phương án gần nhất với tinh thần ở mục 1 và ghi chú lại trong PR.
>
> File này thay thế bản DESIGN.md nhiều style trước đó. Style đã chốt: **Arcade Night**. Không còn `data-style`, không có light theme.

---

## 0. Nhận diện trong một câu

**Một gian máy arcade lúc tối:** nền xanh đêm sâu, mỗi thứ quan trọng tự phát sáng như đèn neon. Màu nhóm là đèn của từng đội, cyan là đèn "đến lượt bạn", hồng là đèn "bí mật".

Ba thứ được phép sáng (glow) trên mọi màn hình, theo thứ tự ưu tiên:
1. **Thứ cần làm ngay** (đến lượt, nút hành động chính, timer sắp hết).
2. **Danh tính nhóm** (thẻ nhóm, badge).
3. **Bí mật** (thẻ bí mật, tab Secrets).

Mọi thứ khác nằm im trên nền tối, không glow.

---

## 1. Nguyên tắc thiết kế

1. **Đọc được từ cuối lớp.** Projector View là sân khấu: chữ to, ít chữ, tương phản cao. Projector luôn chạy ở chế độ Projector Boost (mục 3.6).
2. **Glow là tín hiệu, không phải trang trí.** Glow chỉ dùng cho 3 nhóm ở mục 0. Mỗi màn hình có **tối đa 1 glow mạnh** (`--cp-glow-lg`).
3. **Màu nhóm là đèn của đội.** Học viên tìm nhau bằng màu → màu nhóm phải nổi nhất màn hình khi đang ở bước chia nhóm.
4. **Màu không bao giờ đứng một mình.** Mỗi nhóm luôn có **màu + hình + tên**.
5. **Một màn hình, một hành động chính.** Trên điện thoại, mỗi trạng thái có tối đa 1 nút primary.
6. **Bí mật phải "cầm" mới thấy.** Chạm-giữ / lật thẻ, không bao giờ hiện sẵn.
7. **Tối nhưng không đen kịt, không đơn sắc.** Nền luôn có tông xanh đêm và vệt sáng môi trường; không dùng `#000`, không dùng xám trung tính.
8. **Tiếng Việt luôn hiển thị đúng dấu.** Tên học viên là tiếng Việt; mọi font phải có bộ ký tự tiếng Việt (mục 4.1).

---

## 2. Thư viện được phép

| Mục đích | Thư viện | Ghi chú |
|---|---|---|
| Styling | **Tailwind CSS v4** | Chỉ dùng token (mục 3) qua theme; cấm bảng màu mặc định (`gray`, `slate`, `zinc`, `neutral`…) |
| Primitive | **shadcn/ui** (Radix) | Chỉ làm khung hành vi; **bắt buộc map biến shadcn sang token** (mục 13.3) và re-style |
| Bottom sheet | **vaul** (Drawer của shadcn) | Mọi xác nhận trên mobile |
| Toast | **sonner** | `top-center` trên mobile; Projector không dùng toast |
| Animation | **motion** (Framer Motion) | Theo mục 8 |
| Icon | **lucide-react** | Stroke 2.25. **Không dùng emoji** làm icon hay trang trí |
| Confetti | **canvas-confetti** | Chỉ khi Reveal / kết thúc game, 1 lần mỗi sự kiện, dùng màu neon của nhóm |
| QR | `qrcode.react` | QR luôn **đen trên trắng** trong khung trắng, kể cả trên nền tối (máy quét cần tương phản) |
| Font | `@fontsource/*` (self-host) | Không gọi Google Fonts lúc runtime (Wi-Fi trường yếu) |

**shadcn dùng:** Button, Input, Label, Tabs, Select, Slider, Switch, RadioGroup, Dialog (chỉ Projector/desktop), Drawer, Tooltip (chỉ desktop), Badge, Sonner.
**Không dùng:** Card mặc định (dùng `Panel`), Table (dùng list).

---

## 3. Design tokens

Tất cả token có tiền tố `--cp-` để không đụng biến của shadcn (shadcn cũng có `--accent`, `--muted` nhưng nghĩa khác).

### 3.1 Màu nền & bề mặt (từ sâu đến nổi)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--cp-bg-deep` | `#080A1A` | Vùng ngoài cùng, khay sau Drawer |
| `--cp-bg` | `#0D0F24` | Nền trang |
| `--cp-surface` | `#171A3A` | Panel, thẻ |
| `--cp-surface-2` | `#20244D` | Input, vùng lồng trong panel, nút secondary |
| `--cp-surface-3` | `#2A2F63` | Hover / pressed của surface, hàng đang chọn |

### 3.2 Chữ & viền

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--cp-ink` | `#F4F3FF` | Chữ chính |
| `--cp-ink-muted` | `#A3A1CC` | Chữ phụ, nhãn |
| `--cp-ink-faint` | `#6E6C9A` | **Chỉ** trạng thái disabled và đường trang trí, không dùng cho chữ cần đọc |
| `--cp-border` | `#343A75` | Viền mặc định |
| `--cp-border-strong` | `#4A519A` | Viền khi hover/focus, viền overlay |

### 3.3 Màu chức năng — cặp "fill" và "neon"

Trên nền tối, một màu cần **hai phiên bản**:
- **fill**: nền của nút/khối, đủ đậm để chữ trên nó đạt tương phản.
- **neon**: dùng làm **chữ, viền, icon, glow** trên nền tối.

| Vai trò | Fill | Chữ trên fill (`-fg`) | Neon |
|---|---|---|---|
| Primary (hành động chính) | `#6D4AFF` | `#FFFFFF` | `#9B85FF` |
| Accent (đến lượt, đang nói, highlight) | `#00E5C7` | `#0D0F24` | `#00E5C7` |
| Success | `#2BE38B` | `#0D0F24` | `#2BE38B` |
| Warning | `#FFB547` | `#0D0F24` | `#FFB547` |
| Danger | `#FF4D7A` | `#0D0F24` | `#FF4D7A` |
| Secret (bí mật) | `#FF4D7A` | `#0D0F24` | `#FF7FA0` |

> Primary fill `#6D4AFF` đậm hơn bản preview (`#7C5CFF`) để chữ trắng trên nút đạt chuẩn 4.5:1. Danger và Secret dùng **chữ tối** trên nền hồng vì chữ trắng không đủ tương phản.

### 3.4 Glow & elevation

Glow và elevation là **hai thứ khác nhau**:
- **Elevation** = vật nằm trên vật (panel trên nền, drawer trên trang). Dùng bóng tối, không phát sáng.
- **Glow** = tín hiệu (mục 0). Dùng màu neon, phát sáng.

| Token | Giá trị |
|---|---|
| `--cp-elev-1` | `0 0 0 1px var(--cp-border)` |
| `--cp-elev-2` | `0 0 0 1px var(--cp-border), 0 12px 32px -12px rgb(0 0 0 / 0.6)` |
| `--cp-elev-3` | `0 0 0 1px var(--cp-border-strong), 0 24px 64px -16px rgb(0 0 0 / 0.75)` |
| `--cp-glow-sm` | `0 0 0 1px var(--glow), 0 0 12px -2px color-mix(in oklab, var(--glow) 70%, transparent)` |
| `--cp-glow-md` | `0 0 0 1px var(--glow), 0 8px 24px -6px color-mix(in oklab, var(--glow) 75%, transparent)` |
| `--cp-glow-lg` | `0 0 0 1px var(--glow), 0 16px 48px -10px color-mix(in oklab, var(--glow) 85%, transparent)` |

- Component đặt `--glow` bằng màu neon tương ứng (`--glow: var(--cp-accent-neon)`), rồi dùng `box-shadow: var(--cp-glow-md)`.
- Text glow (chỉ cho chữ hero như "YOUR TURN!"): `text-shadow: 0 0 24px color-mix(in oklab, var(--glow) 70%, transparent)`.
- **Tối đa 1 `--cp-glow-lg` mỗi màn hình.**

### 3.5 Hình khối

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--cp-r-sm` | `10px` | Chip, ô mã lobby, input |
| `--cp-r` | `20px` | Panel, nút, thẻ nhóm |
| `--cp-r-lg` | `28px` | Thẻ bí mật, Drawer (góc trên) |
| `--cp-r-pill` | `999px` | Badge, switch |
| `--cp-border-w` | `1px` | Viền mặc định |
| `--cp-border-w-strong` | `2px` | Viền thẻ nhóm, viền focus trong Projector Boost |

### 3.6 Projector Boost

Máy chiếu trong phòng còn đèn làm nền tối bị bạc và glow gần như biến mất. Vì vậy **Projector View luôn bật Boost** (`data-boost="projector"` trên root của `/display/:code`):

| Token | Bình thường | Boost |
|---|---|---|
| `--cp-bg` | `#0D0F24` | `#161A3D` |
| `--cp-surface` | `#171A3A` | `#232860` |
| `--cp-surface-2` | `#20244D` | `#2D3373` |
| `--cp-ink` | `#F4F3FF` | `#FFFFFF` |
| `--cp-ink-muted` | `#A3A1CC` | `#CFCDF0` |
| `--cp-border` | `#343A75` | `#5A62B8` |
| Glow | như 3.4 | **Thay bằng viền neon 3px**, bỏ phần quầng sáng |
| Độ đậm chữ | như mục 4 | **+100** (body 500 → 600) |

Nếu phòng tối hẳn, giáo viên có thể tắt Boost bằng phím `B` trên Projector (lưu vào `localStorage`, mặc định luôn bật).

### 3.7 CSS đầy đủ

```css
/* apps/web/src/styles/tokens.css */
:root {
  color-scheme: dark;

  --cp-bg-deep: #080A1A;
  --cp-bg: #0D0F24;
  --cp-surface: #171A3A;
  --cp-surface-2: #20244D;
  --cp-surface-3: #2A2F63;

  --cp-ink: #F4F3FF;
  --cp-ink-muted: #A3A1CC;
  --cp-ink-faint: #6E6C9A;
  --cp-border: #343A75;
  --cp-border-strong: #4A519A;

  --cp-primary: #6D4AFF;  --cp-primary-fg: #FFFFFF;  --cp-primary-neon: #9B85FF;
  --cp-accent: #00E5C7;   --cp-accent-fg: #0D0F24;   --cp-accent-neon: #00E5C7;
  --cp-success: #2BE38B;  --cp-success-fg: #0D0F24;
  --cp-warning: #FFB547;  --cp-warning-fg: #0D0F24;
  --cp-danger: #FF4D7A;   --cp-danger-fg: #0D0F24;
  --cp-secret: #FF4D7A;   --cp-secret-fg: #0D0F24;   --cp-secret-neon: #FF7FA0;

  --glow: var(--cp-primary-neon);
  --cp-elev-1: 0 0 0 1px var(--cp-border);
  --cp-elev-2: 0 0 0 1px var(--cp-border), 0 12px 32px -12px rgb(0 0 0 / 0.6);
  --cp-elev-3: 0 0 0 1px var(--cp-border-strong), 0 24px 64px -16px rgb(0 0 0 / 0.75);
  --cp-glow-sm: 0 0 0 1px var(--glow), 0 0 12px -2px color-mix(in oklab, var(--glow) 70%, transparent);
  --cp-glow-md: 0 0 0 1px var(--glow), 0 8px 24px -6px color-mix(in oklab, var(--glow) 75%, transparent);
  --cp-glow-lg: 0 0 0 1px var(--glow), 0 16px 48px -10px color-mix(in oklab, var(--glow) 85%, transparent);

  --cp-r-sm: 10px; --cp-r: 20px; --cp-r-lg: 28px; --cp-r-pill: 999px;
  --cp-border-w: 1px; --cp-border-w-strong: 2px;

  --cp-font-display: "Unbounded", "Be Vietnam Pro", system-ui, sans-serif;
  --cp-font-body: "Be Vietnam Pro", system-ui, sans-serif;
  --cp-font-mono: "JetBrains Mono", ui-monospace, monospace;

  --cp-ease-out: cubic-bezier(.2, .8, .2, 1);
  --cp-dur-fast: 150ms; --cp-dur: 250ms; --cp-dur-slow: 400ms;
}

:root[data-boost="projector"] {
  --cp-bg: #161A3D;
  --cp-surface: #232860;
  --cp-surface-2: #2D3373;
  --cp-ink: #FFFFFF;
  --cp-ink-muted: #CFCDF0;
  --cp-border: #5A62B8;
  --cp-glow-sm: 0 0 0 3px var(--glow);
  --cp-glow-md: 0 0 0 3px var(--glow);
  --cp-glow-lg: 0 0 0 3px var(--glow);
}

body {
  background-color: var(--cp-bg);
  background-image:
    radial-gradient(60vmax 40vmax at 0% 0%, color-mix(in oklab, var(--cp-primary) 25%, transparent), transparent 70%),
    radial-gradient(50vmax 40vmax at 100% 100%, color-mix(in oklab, var(--cp-accent) 15%, transparent), transparent 70%);
  background-attachment: fixed;
  color: var(--cp-ink);
  font-family: var(--cp-font-body);
}
```

### 3.8 Màu nhóm

Mỗi nhóm có **fill** (nền đặc), **fg** (chữ trên fill), **neon** (chữ/viền/glow trên nền tối) và **shape**. Thứ tự gán cố định; 4–6 nhóm đầu là bộ dễ phân biệt nhất vì lớp 24 người thường chia 4–6 nhóm.

| # | Tên | Fill `--team` | Fg `--team-fg` | Neon `--team-neon` | Shape (lucide) |
|---|---|---|---|---|---|
| 1 | Red | `#D62F33` | `#FFFFFF` | `#FF6B6E` | `Circle` |
| 2 | Blue | `#2563EB` | `#FFFFFF` | `#6EA8FF` | `Square` |
| 3 | Yellow | `#FACC15` | `#0D0F24` | `#FFE14D` | `Star` |
| 4 | Green | `#16A34A` | `#0D0F24` | `#3DDC84` | `Triangle` |
| 5 | Purple | `#9333EA` | `#FFFFFF` | `#C58BFF` | `Diamond` |
| 6 | Orange | `#F97316` | `#0D0F24` | `#FFA463` | `Hexagon` |
| 7 | Lime | `#84CC16` | `#0D0F24` | `#B5F23D` | `Heart` |
| 8 | Pink | `#EC4899` | `#0D0F24` | `#FF7AC6` | `Moon` |

- Nguồn duy nhất: `packages/core/src/teams.ts`. Component nhận `teamIndex`, set `style={{ "--team", "--team-fg", "--team-neon" }}`.
- **Không có Teal**: dễ nhầm với accent cyan (màu "đang nói"). Đã thay bằng Lime.
- Red, Green, Teal cũ có chữ không đủ tương phản → Red dùng fill đậm hơn; Green dùng chữ tối.
- Nền tint của nhóm trên nền tối: `color-mix(in oklab, var(--team) 18%, var(--cp-surface))`.
- Trên 8 nhóm: lặp lại, thêm số vào tên ("Red 2"), icon shape dùng stroke thay vì fill.

---

## 4. Typography

### 4.1 Font

| Vai trò | Font | Dùng cho | Không dùng cho |
|---|---|---|---|
| Display | **Unbounded** 600–800 | Tiêu đề, tên game, tên nhóm, hero ("YOUR TURN!", "SPY"), nhãn nút | Đoạn văn, **tên học viên**, chữ < 16px |
| Body | **Be Vietnam Pro** 400–700 | Mọi chữ còn lại, **tất cả tên học viên** | — |
| Mono | **JetBrains Mono** 500–700 | Timer, mã lobby, điểm, số liệu | Chữ thường |

**Quy tắc tiếng Việt (bắt buộc):**
- Tên học viên **luôn** dùng body font (Be Vietnam Pro, thiết kế cho tiếng Việt), kể cả trong thẻ nhóm trên Projector.
- Khi cài font từ `@fontsource`, phải import cả subset `vietnamese`.
- Mỗi component hiển thị tên phải được kiểm tra với chuỗi: `Thảo · Bảo · Quân · Việt · Ngọc · Phúc · Uyên`. Dấu bị rơi sang font hệ thống → lỗi.

**Đặc thù Unbounded:** chữ rất rộng nên:
- Hero tối đa ~12 ký tự mỗi dòng trên điện thoại.
- Letter-spacing `-0.01em` cho cỡ ≥ 24px; `0` cho cỡ nhỏ hơn.
- Chữ in hoa toàn bộ chỉ cho nhãn ngắn ≤ 3 từ ("YOUR TURN!", "NOW PLAYING").

### 4.2 Thang chữ

| Vai trò | Player (mobile) | Host Console (mobile) | Projector (1920×1080) |
|---|---|---|---|
| Hero | 32px / display / 800 | — | 88px / display / 800 |
| Timer | 52px / mono / 700 | 30px / mono / 700 | 120px (focus) · 44px (thẻ nhóm) / mono / 700 |
| Lobby code | 28px / mono / 700 | 22px / mono / 700 | 104px / mono / 700, letter-spacing 0.12em |
| H1 | 24px / display / 700 | 22px / display / 700 | 52px / display / 800 |
| H2 | 18px / display / 700 | 17px / display / 700 | 34px / display / 700 |
| Body | 17px / body / 500 | 16px / body / 500 | 28px / body / 600 |
| Tên học viên | 17px / body / 600 | 16px / body / 600 | 28px / body / 700 |
| Small / meta | 14px / body / 500 | 13px / body / 500 | 22px / body / 600 |

- **Không có chữ < 13px**. Projector: **không có chữ < 22px**.
- Số luôn `font-variant-numeric: tabular-nums`.
- Line-height: display 1.05, body 1.5.
- Copy UI: **tiếng Anh, câu ngắn, từ cấp A2** ("Wait for your teacher", "Your turn!", "Hold to see your card").

---

## 5. Nền & bề mặt

- Nền trang: `--cp-bg` + 2 vệt sáng môi trường (primary góc trên trái 25%, accent góc dưới phải 15%) — đã có trong `body` ở 3.7.
- Projector: thêm lưới mờ 1px `--cp-border` ở 12% opacity, ô 64px, chỉ ở nửa dưới màn hình (cảm giác "sàn sân khấu").
- Player sau khi có nhóm: vệt sáng trên trái đổi từ primary sang `--team-neon` 22%; nền vẫn là `--cp-bg`.
- **Không** dùng ảnh nền, noise texture, hay gradient tím-xanh phủ kín.

---

## 6. Layout & spacing

- Thang spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Mobile:** thiết kế cho 360–430px; gutter 16px; nút primary cố định đáy (`sticky bottom-0` + `env(safe-area-inset-bottom)`); vùng chạm tối thiểu **48×48px**.
- **Projector:** 1920×1080, scale bằng `clamp()`/`vw`, **không cuộn**. Header 1 dòng: mã lobby + QR + tên game + trạng thái.

| Số nhóm | Lưới Projector |
|---|---|
| 1–2 | 2 cột |
| 3–4 | 2×2 |
| 5–6 | 3×2 |
| 7–8 | 4×2 |

---

## 7. Component

Tất cả nằm trong `packages/ui`. Tên, biến thể và hành vi dưới đây là bắt buộc.

### Panel
- Nền `--cp-surface`, bo `--cp-r`, `box-shadow: var(--cp-elev-1)`. Padding 16px (mobile) / 32px (Projector).
- Panel nổi (popover, drawer): `--cp-elev-3`, nền `--cp-surface-2`.

### Button
| Biến thể | Nền | Chữ | Trạng thái |
|---|---|---|---|
| `primary` | `--cp-primary` | `--cp-primary-fg` | `--glow: var(--cp-primary-neon)` + `--cp-glow-md` luôn bật |
| `accent` | `--cp-accent` | `--cp-accent-fg` | `--cp-glow-md` màu accent; chỉ dùng cho hành động "tới lượt" ("I'm done", "Start round") |
| `secondary` | `--cp-surface-2` | `--cp-ink` | `--cp-elev-1`, hover `--cp-surface-3` + viền `--cp-border-strong`, không glow |
| `danger` | `--cp-danger` | `--cp-danger-fg` | `--cp-glow-sm` màu danger |
| `ghost` | trong suốt | `--cp-ink-muted` | hover: chữ `--cp-ink`, nền `--cp-surface-2` |

- Chữ: display 700, 16px (mobile `lg` = cao 56px, chữ 17px). Icon lucide bên trái khi hành động có nghĩa rõ.
- Hover (desktop): `translateY(-1px)` + `filter: brightness(1.1)`. Active: `translateY(0)` + `brightness(.95)`.
- Disabled: nền `--cp-surface-2`, chữ `--cp-ink-faint`, bỏ glow.

### TeamBadge
- Pill `--cp-r-pill`: nền `--team`, chữ `--team-fg`, shape icon bên trái, tên nhóm (display 700, 14px).
- `--glow: var(--team-neon)` + `--cp-glow-sm`. Không có phiên bản chỉ chấm màu.

### GroupCard (Projector)
- Khung: nền tint nhóm, viền `--cp-border-w-strong` màu `color-mix(in oklab, var(--team-neon) 60%, var(--cp-border))`, bo `--cp-r`.
- Header đặc `--team` / `--team-fg`: shape + "Team Red" + số người + Timer nhóm (pill `--cp-surface`, mono).
- Thân: tên thành viên 2 cột (body 700). Người đang nói: nền `--cp-accent`, chữ `--cp-accent-fg`, icon `Mic`.
- Chân: "Next: **Huy**".
- Glow `--team-neon` cỡ `md` chỉ khi nhóm đang có người nói; nhóm đã xong lượt thì không glow.

### Timer
- `m:ss`, mono, tabular. Player dùng vòng tròn (stroke 12, đầu tròn), Projector dùng số + thanh mảnh dưới header nhóm.
- Màu: bình thường `--cp-accent-neon` → ≤ 10s `--cp-warning` → ≤ 5s `--cp-danger` + nhịp scale 1 → 1.04 mỗi giây.
- Vòng tròn có glow cùng màu trạng thái (`--cp-glow-md`); khi ≤ 5s là glow mạnh nhất màn hình.
- Pause: chữ `--cp-ink-muted`, vòng `--cp-surface-3`, icon `Pause`, tắt glow.

### TurnIndicator
- "Now: **Minh**" (tên màu `--cp-accent-neon`) · "Next: Lan" (`--cp-ink-muted`).
- Player: nếu là mình → chuyển sang **YourTurn**.

### YourTurn (Player)
- Nền: radial gradient từ `color-mix(in oklab, var(--cp-accent) 45%, var(--cp-bg))` ở tâm trên ra `--cp-bg`.
- "YOUR TURN!" hero, màu `--cp-accent-neon`, text glow.
- Vòng timer lớn ở giữa. Nút `accent` "I'm done" ở đáy.
- `navigator.vibrate(200)` nếu có.

### SecretCard (Player)
- Kích thước: chiếm phần còn lại của màn, tối thiểu 280px; bo `--cp-r-lg`.
- Mặt úp: nền `--cp-secret`, chữ `--cp-secret-fg`, icon `Eye` 44px, "Hold to see your card" (display 800, 20px), "Let go to hide it". `--glow: var(--cp-secret-neon)` + `--cp-glow-md`.
- Giữ (pointerdown + pointer capture) → lật rotateY 180° trong 300ms; thả / cancel / mất focus → úp ngay.
- Mặt ngửa: nền `--cp-surface`, viền `--cp-secret-neon` 1px.
  - Vai thường / topic: nhãn nhỏ ("LOCATION"), từ khóa hero màu `--cp-accent-neon`, 3–5 chip `vocabHints` (nền `--cp-surface-2`).
  - Vai đặc biệt (Spy, Werewolf): "You are the SPY" màu `--cp-danger`, chip category nếu có.
- **Không render nội dung bí mật vào DOM khi đang úp** (render có điều kiện, xóa sau khi animation úp kết thúc).

### HostSecretRow (Host Console)
- Hàng: TeamBadge + nội dung (`Spy: Khoa` / `Topic: Airport`) + icon `EyeOff`.
- Mặc định `filter: blur(7px)`; chạm-giữ để bỏ mờ. Nút "Show all" (`secondary`) mở Drawer xác nhận.

### LobbyCodeDisplay (Projector)
- Mỗi ký tự 1 ô: nền `--cp-surface`, viền 1px `--cp-accent-neon`, chữ `--cp-accent-neon`, bo `--cp-r-sm`, `--glow: var(--cp-accent-neon)` + `--cp-glow-sm`.
- QR bên phải, cao bằng khối mã, **đen trên khung trắng**, padding 8px.
- Dòng phụ: "Scan or go to **clubplay.app**".

### Input
- Nền `--cp-surface-2`, viền 1px `--cp-border`, bo `--cp-r-sm`, cao 48px, chữ body 600 17px.
- Focus: viền `--cp-accent-neon` + `--glow: var(--cp-accent-neon)` + `--cp-glow-sm`.
- Lỗi: viền `--cp-danger`, thông báo inline bên dưới (body 700 14px, `--cp-danger`).
- Ô mã lobby: mono, in hoa, letter-spacing 0.2em.

### Switch, Tabs, Chip
- Switch: track `--cp-surface-2`, viền `--cp-border`; bật = track `--cp-accent`, núm `--cp-accent-fg`.
- Host bottom tab bar: nền `--cp-surface`, viền trên `--cp-border`. Tab active: pill nền `--cp-surface-3`, chữ + icon `--cp-primary-neon`. **Riêng tab Secrets khi active:** pill nền `--cp-secret`, chữ `--cp-secret-fg`.
- Chip: nền `--cp-surface-2`, chữ `--cp-ink`, bo `--cp-r-pill`, body 700 14px. Chip nổi bật (category trên Projector): nền `--cp-accent`, chữ `--cp-accent-fg`.

### PlayerList (Host Console)
- Hàng: chấm trạng thái (online `--cp-success`, away `--cp-warning`, offline `--cp-ink-faint`), tên (body 600), TeamBadge, nút `…` (Move, Kick).

### Drawer (mobile)
- Nền `--cp-surface-2`, góc trên `--cp-r-lg`, `--cp-elev-3`, khay phía sau `--cp-bg-deep` 70%.
- Hành động phá hủy: nút `danger` full-width + nút `ghost` "Cancel".

### EmptyState / Waiting
- Icon lucide 64px màu `--cp-ink-muted` trong vòng tròn `--cp-surface-2`, 1 câu ngắn, 3 chấm nhấp nháy màu `--cp-primary-neon`.

---

## 8. Motion

| Sự kiện | Animation | Thời lượng |
|---|---|---|
| Vào màn mới | "Power-on": opacity 0 → 1, scale .98 → 1, brightness 1.3 → 1 | 250ms, chỉ 1 lần |
| Chia nhóm (Projector) | Tên bay từ danh sách vào thẻ nhóm, stagger 30ms; thẻ nhóm sáng glow khi đủ người | ≤ 2.0s |
| Nhận nhóm (Player) | Vệt sáng nền đổi sang màu nhóm, TeamBadge scale 0.8 → 1 (spring) | 500ms |
| Chuyển lượt | Highlight accent trượt sang người mới | 250ms |
| YourTurn | Nền accent lan từ tâm (clip-path circle) | 400ms |
| Lật SecretCard | rotateY 180° | 300ms |
| Reveal (Projector) | Từng nhóm lật lần lượt, stagger 400ms; confetti màu neon của nhóm sau nhóm cuối | ≤ 4s |

- Easing: `--cp-ease-out` cho fade/slide; spring `{ stiffness: 400, damping: 30 }` cho bật/nảy.
- Chuyển động lặp vô hạn chỉ được phép cho: chấm "đang chờ", nhịp timer ≤ 5s, và vệt sáng nền trôi rất chậm (chu kỳ ≥ 30s) **chỉ trên màn lobby chờ của Projector**.
- Không nhấp nháy kiểu đèn hỏng, không scanline chạy, không glitch.
- `prefers-reduced-motion`: thay toàn bộ bằng fade 150ms, tắt confetti, tắt vệt sáng trôi.

---

## 9. Quy ước theo view

### Projector View (`/display/:code`)
- Luôn `data-boost="projector"` (phím `B` để tắt khi phòng tối).
- Chỉ thông tin `public`. Không nút bấm ngoài màn tạo lobby và nút fullscreen.
- Con trỏ chuột tự ẩn sau 3s.
- QR join nhỏ luôn ở header.
- Không toast; chỉ banner khi mất kết nối.

### Host Console (`/host/:code`)
- Bottom tab bar: **Players · Groups · Game · Secrets** (`Users`, `Shuffle`, `Gamepad2`, `EyeOff`).
- Thanh điều khiển cố định trên tab bar: Play/Pause (`primary`), Skip, +30s, End round (`secondary`).
- Hành động phá hủy luôn qua Drawer xác nhận.

### Player View (`/play/:code`)
- Header nhỏ: tên mình + TeamBadge. Không menu, không điều hướng.
- Mỗi trạng thái game là một màn toàn trang.
- Wake Lock khi game đang chạy.

---

## 10. Trạng thái hệ thống

| Trạng thái | Hiển thị |
|---|---|
| Đang kết nối lại | Banner trên cùng nền `--cp-warning`, chữ `--cp-warning-fg`, icon `WifiOff`, "Reconnecting…" |
| Mất kết nối > 30s | Màn chặn, nút `primary` "Try again" |
| Bị kick | "You were removed from the lobby", nút "Join again" |
| Lobby đã đóng | "This lobby has ended. Thanks for playing!" |
| Lỗi join | Inline dưới input, màu `--cp-danger`, không toast |

---

## 11. Accessibility

- Tương phản: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1. Các cặp fill/fg ở 3.3 và 3.8 đã chọn để đạt mức này; **không tự đổi màu chữ trên fill**.
- `--cp-ink-faint` không dùng cho chữ cần đọc.
- Focus ring: `outline: 2px solid var(--cp-accent-neon); outline-offset: 3px` — luôn hiện khi dùng bàn phím.
- Icon-only button có `aria-label`.
- Thông tin nhóm luôn có màu + hình + tên.
- Timer `aria-live="polite"` chỉ đọc mốc 30s / 10s / hết giờ.

---

## 12. Do / Don't cho agent

**Do**
- Dùng token `--cp-*` qua class Tailwind (`bg-surface`, `text-ink`, `bg-primary`, `text-accent-neon`…).
- Đặt `--glow` trên component rồi dùng `shadow-glow-*`; không viết box-shadow tay.
- Dùng màu **neon** cho chữ/viền/icon trên nền tối, màu **fill** cho nền khối.
- Kiểm tra mỗi UI ở 360×780 (Player), 390×844 (Host), 1920×1080 (Projector, Boost bật).
- Kiểm tra tên tiếng Việt có dấu trong mọi component có tên người.
- Khi thêm component mới vào `packages/ui`, bổ sung mô tả vào mục 7.

**Don't**
- Không dùng light theme, `#000`, `#FFF` làm nền, hay màu mặc định của Tailwind/shadcn.
- Không glow cho thứ không thuộc 3 nhóm ở mục 0; không quá 1 glow mạnh mỗi màn.
- Không dùng màu neon làm nền khối có chữ, không dùng màu fill làm chữ trên nền tối.
- Không đặt tên học viên bằng Unbounded.
- Không dùng emoji, ảnh stock, scanline, hiệu ứng glitch.
- Không dùng gradient tím-xanh phủ kín làm nền chính.
- Không đặt thông tin bí mật vào Projector View, kể cả ẩn bằng CSS.
- Không dùng modal giữa màn hình trên mobile — dùng Drawer.
- Không thêm thư viện UI ngoài danh sách mục 2.

---

## 13. Cài đặt

### 13.1 Package

```bash
# trong apps/web
pnpm add motion lucide-react sonner vaul canvas-confetti qrcode.react
pnpm add @fontsource-variable/unbounded @fontsource-variable/be-vietnam-pro @fontsource/jetbrains-mono
npx shadcn@latest init
npx shadcn@latest add button input label tabs select slider switch radio-group dialog drawer tooltip badge sonner
```

Import font kèm subset tiếng Việt trong `main.tsx` (kiểm tra tên file subset trong `node_modules/@fontsource*/<font>/` nếu khác):

```ts
import "@fontsource-variable/unbounded";
import "@fontsource-variable/be-vietnam-pro";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";
```

> Nếu một package không có subset `vietnamese`, chuyển sang import theo subset (`.../vietnamese.css`) hoặc đổi font, rồi ghi lại trong PR. Không chấp nhận dấu tiếng Việt rơi sang font hệ thống.

### 13.2 Map token vào Tailwind v4

```css
/* apps/web/src/styles/theme.css */
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-bg-deep: var(--cp-bg-deep);
  --color-bg: var(--cp-bg);
  --color-surface: var(--cp-surface);
  --color-surface-2: var(--cp-surface-2);
  --color-surface-3: var(--cp-surface-3);
  --color-ink: var(--cp-ink);
  --color-ink-muted: var(--cp-ink-muted);
  --color-ink-faint: var(--cp-ink-faint);
  --color-line: var(--cp-border);
  --color-line-strong: var(--cp-border-strong);
  --color-primary: var(--cp-primary);
  --color-primary-fg: var(--cp-primary-fg);
  --color-primary-neon: var(--cp-primary-neon);
  --color-accent: var(--cp-accent);
  --color-accent-fg: var(--cp-accent-fg);
  --color-accent-neon: var(--cp-accent-neon);
  --color-success: var(--cp-success);
  --color-warning: var(--cp-warning);
  --color-danger: var(--cp-danger);
  --color-secret: var(--cp-secret);
  --color-secret-fg: var(--cp-secret-fg);
  --color-secret-neon: var(--cp-secret-neon);
  --color-team: var(--team);
  --color-team-fg: var(--team-fg);
  --color-team-neon: var(--team-neon);

  --font-display: var(--cp-font-display);
  --font-body: var(--cp-font-body);
  --font-mono: var(--cp-font-mono);

  --radius-sm: var(--cp-r-sm);
  --radius-ui: var(--cp-r);
  --radius-lg: var(--cp-r-lg);

  --shadow-elev-1: var(--cp-elev-1);
  --shadow-elev-2: var(--cp-elev-2);
  --shadow-elev-3: var(--cp-elev-3);
  --shadow-glow-sm: var(--cp-glow-sm);
  --shadow-glow-md: var(--cp-glow-md);
  --shadow-glow-lg: var(--cp-glow-lg);
}
```

### 13.3 Map biến shadcn sang token

Sau `shadcn init`, thay toàn bộ biến màu shadcn trong CSS bằng khối này (xóa khối `.dark` mặc định vì app chỉ có một theme):

```css
:root {
  --background: var(--cp-bg);
  --foreground: var(--cp-ink);
  --card: var(--cp-surface);
  --card-foreground: var(--cp-ink);
  --popover: var(--cp-surface-2);
  --popover-foreground: var(--cp-ink);
  --primary: var(--cp-primary);
  --primary-foreground: var(--cp-primary-fg);
  --secondary: var(--cp-surface-2);
  --secondary-foreground: var(--cp-ink);
  --muted: var(--cp-surface-2);
  --muted-foreground: var(--cp-ink-muted);
  --accent: var(--cp-surface-3);          /* shadcn "accent" = nền hover, KHÁC accent cyan của ClubPlay */
  --accent-foreground: var(--cp-ink);
  --destructive: var(--cp-danger);
  --border: var(--cp-border);
  --input: var(--cp-border);
  --ring: var(--cp-accent-neon);
  --radius: var(--cp-r);
}
```

Sau đó re-style từng file trong `components/ui/*` theo mục 7 (biến thể Button, viền focus, glow).

---

## 14. Checklist trước khi mở PR có UI

- [ ] Không có hex hay màu Tailwind mặc định trong component (chỉ token).
- [ ] Mỗi màn hình có tối đa 1 glow mạnh; glow chỉ dùng cho hành động / nhóm / bí mật.
- [ ] Chữ trên fill dùng đúng `-fg`; chữ trên nền tối dùng neon hoặc ink.
- [ ] Tên học viên dùng body font, chuỗi kiểm tra tiếng Việt hiển thị đúng.
- [ ] Projector đã xem ở chế độ Boost, không chữ < 22px, không cuộn.
- [ ] Không có thông tin bí mật trong DOM của Projector hoặc của thẻ đang úp.
- [ ] Đã kiểm tra `prefers-reduced-motion`.
- [ ] Mỗi nhóm hiển thị đủ màu + hình + tên.
