# Split Bill App — Design System

> 風格參考：Modychat UI Kit（深色 Header + 淺色 Card、圓角大膽、紅色 CTA）

---

## 1. Design Tokens

### Colors

```css
/* === Brand === */
--color-primary: #FF4B6E;        /* 紅色 CTA、主要 action */
--color-primary-hover: #E63D5F;
--color-primary-light: #FFE8EC;  /* 淺紅背景、badge 底色 */

/* === Secondary Accent === */
--color-accent-purple: #7B5EA7;  /* Group avatar、次要 icon */
--color-accent-blue: #4A90D9;    /* 已結清狀態、info */
--color-accent-orange: #F5A623;  /* 提醒、pending 狀態 */
--color-accent-teal: #3DBCAA;    /* 成功、已付款 */

/* === Surface === */
--color-surface-dark: #1E2340;   /* Header、Nav Bar 背景 */
--color-surface-dark-2: #2A3060; /* Card 深色變體 */
--color-surface-light: #F5F6FA;  /* 頁面背景 */
--color-surface-card: #FFFFFF;   /* 卡片底色 */
--color-surface-input: #F0F1F7;  /* 輸入框底色 */

/* === Text === */
--color-text-primary: #1A1D2E;   /* 主要內文 */
--color-text-secondary: #8A90B0; /* 副文字、timestamp */
--color-text-on-dark: #FFFFFF;   /* 深色背景上的文字 */
--color-text-on-dark-muted: #A0A8CC;

/* === Semantic === */
--color-success: #3DBCAA;
--color-warning: #F5A623;
--color-error: #FF4B6E;
--color-info: #4A90D9;

/* === Border === */
--color-border: #E8E9F3;
--color-border-dark: #3A4070;
```

### Typography

```css
/* === Font === */
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* === Scale === */
--text-xs:   12px / 1.4;   /* Badge、caption */
--text-sm:   13px / 1.5;   /* Timestamp、label */
--text-base: 15px / 1.6;   /* 內文、list item */
--text-md:   17px / 1.5;   /* Section header */
--text-lg:   20px / 1.4;   /* Page title */
--text-xl:   24px / 1.3;   /* 金額大數字 */
--text-2xl:  32px / 1.2;   /* Hero 數字 */

/* === Weight === */
--font-regular:   400;
--font-medium:    500;
--font-semibold:  600;
--font-bold:      700;
```

### Spacing

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

### Border Radius

```css
--radius-sm:   8px;    /* Input、小型 badge */
--radius-md:   12px;   /* List item card */
--radius-lg:   16px;   /* 主要 card */
--radius-xl:   24px;   /* Bottom sheet、大型 panel */
--radius-full: 9999px; /* Avatar、pill badge、FAB */
```

### Shadows

```css
--shadow-sm:  0 2px 8px rgba(30, 35, 64, 0.08);
--shadow-md:  0 4px 16px rgba(30, 35, 64, 0.12);
--shadow-lg:  0 8px 32px rgba(30, 35, 64, 0.16);
--shadow-fab: 0 6px 20px rgba(255, 75, 110, 0.40);
```

### Motion

```css
--duration-fast:   150ms;
--duration-base:   250ms;
--duration-slow:   400ms;
--easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
--easing-enter:    cubic-bezier(0, 0, 0.2, 1);
--easing-exit:     cubic-bezier(0.4, 0, 1, 1);
```

---

## 2. Layout

```
Screen max-width:        390px (mobile-first)
Page horizontal padding: 20px
Safe area bottom:        env(safe-area-inset-bottom) + 16px

Header height:           60px  (dark surface)
Tab bar height:          64px  (dark surface, 3-tab: Groups / Activity / Profile)
```

---

## 3. Components

### 3.1 TopBar

- 背景：`--color-surface-dark`
- 左：back icon 或 app logo（20px）
- 中：page title，`--text-md / --font-semibold / --color-text-on-dark`
- 右：action icon（search / edit），24px，`--color-text-on-dark`
- 無底部 border，使用視覺層次區隔

### 3.2 TabBar（Groups / Activity / Profile）

```
Container: dark background (#1E2340), full width, height 64px
Tab item:  1/3 width, centered icon + label
Active:    white pill background, radius-full, label bold
Inactive:  icon + label in --color-text-on-dark-muted
```

### 3.3 ListItem（分帳紀錄、成員列表）

```
Layout:    horizontal, align-center, padding 12px 16px
Left:      Avatar (40px circle) + optional badge (紅點，16px)
Middle:
  Primary:   --text-base / --font-semibold / --color-text-primary
  Secondary: --text-sm / --font-regular / --color-text-secondary
Right:
  Amount:    --text-base / --font-semibold
    你欠別人: --color-error
    別人欠你: --color-success
  Timestamp: --text-xs / --color-text-secondary
Background: --color-surface-card
Radius:    --radius-md
Shadow:    --shadow-sm（卡片感）或 flat + divider
```

### 3.4 Avatar

| Size | px  | Usage           |
|------|-----|-----------------|
| xs   | 28  | Inline mention  |
| sm   | 36  | Compact list    |
| md   | 44  | 標準 list item  |
| lg   | 64  | Profile header  |
| xl   | 88  | Profile page    |

- Group avatar：`--color-accent-purple` 背景 + 白色 emoji / 首字母
- Badge：`--color-primary` 右上角紅點，16px circle

### 3.5 Button

**Primary（CTA）**
```
Background: --color-primary
Text:       white, --text-base, --font-semibold
Padding:    14px 24px
Radius:     --radius-full
Shadow:     --shadow-fab
Min-width:  160px
```

**Secondary**
```
Background: transparent
Border:     1.5px solid --color-primary
Text:       --color-primary
Padding / Radius: 同 Primary
```

**Ghost / Icon Button**
```
Background: --color-surface-input
Icon:       20px, --color-text-secondary
Size:       40px × 40px, radius-full
```

**FAB（Floating Action Button）**
```
Size:       56px circle
Background: --color-primary
Icon:       24px white
Shadow:     --shadow-fab
Position:   bottom-right, margin 20px
```

### 3.6 Input Field

```
Background:  --color-surface-input
Border:      none (default) / 1.5px --color-primary (focus)
Radius:      --radius-sm
Padding:     12px 16px
Text:        --text-base / --color-text-primary
Placeholder: --color-text-secondary
Height:      48px
```

### 3.7 Amount Badge / Status Chip

```
Owe（欠款）:    bg --color-primary-light,           text --color-error
Settled（結清）: bg rgba(61, 188, 170, 0.12),        text --color-success
Pending:        bg rgba(245, 166, 35, 0.12),         text --color-warning
Radius:  --radius-full
Padding: 4px 10px
Font:    --text-sm / --font-medium
```

### 3.8 Section Header

```
Text:       --text-sm / --font-medium / --color-text-secondary
Padding:    16px 20px 8px
"See more": --color-primary / --text-sm
```

### 3.9 Bottom Sheet / Modal

```
Background: --color-surface-card
Radius:     --radius-xl (top only)
Padding:    20px
Handle bar: 4px × 32px, --color-border, centered, margin-bottom 16px
Overlay:    rgba(0, 0, 0, 0.5)
Animation:  slide-up, --duration-slow, --easing-enter
```

### 3.10 Action Icon Row

四個圓形圖示按鈕，顏色各異：

| Icon    | Color                  |
|---------|------------------------|
| 圖片    | `--color-primary`      |
| 收據    | `--color-accent-purple`|
| 聯絡人  | `--color-accent-blue`  |
| 位置    | `--color-accent-orange`|

```
Size: 44px circle, white icon 20px
```

---

## 4. Screen 架構

| 畫面         | 核心元素                              |
|--------------|---------------------------------------|
| Splash       | Hero illustration + Primary CTA       |
| 群組列表     | ListItem + FAB（新增群組）            |
| 群組內帳款   | 帳款卡片列表 + 結算 CTA               |
| 新增費用     | Form + Amount Input + 分帳方式選擇    |
| 結算紀錄     | ListItem + Status Badge               |
| 個人資料     | Avatar xl + 設定 list                 |
| 設定         | Section list，> 箭頭導覽              |

---

## 5. 給 Claude Code 的實作備註

1. 使用 React Native 或 Flutter 時，以上 token 轉為對應的 `StyleSheet` / `ThemeData`
2. 深色 Header + 淺色 body 需設定 `StatusBar style = light-content`
3. FAB 需 `position: absolute`，搭配 `KeyboardAvoidingView` 避免被鍵盤遮擋
4. 金額數字統一使用 `tabular-nums` font feature 避免跳動
5. Avatar 圖片需有 fallback（首字母 + 色塊），顏色依 `userId hash` 決定
6. 所有 list 建議使用 `FlatList`（RN）或 `ListView.builder`（Flutter）確保效能
7. 底部 safe area 務必用 `SafeAreaView` 或 `MediaQuery.padding` 處理
