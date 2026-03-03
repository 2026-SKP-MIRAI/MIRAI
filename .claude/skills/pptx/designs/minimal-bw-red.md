# Minimal B&W + Red Design System

Proven minimal design for professional presentations. High contrast, clean layout, strong hierarchy.

## Color Palette

| Color | Hex | Role |
|-------|-----|------|
| **Black** | `#000000` | Section dividers, closing slides, primary text |
| **White** | `#ffffff` | Content slide backgrounds |
| **Red** | `#FF3B30` | Accent: numbers, labels, accent bars, CTAs |
| **Dark Gray** | `#333333` | Code text, secondary emphasis |
| **Medium Gray** | `#666666` | Body text (secondary) |
| **Light Gray** | `#999999` | Captions, labels, descriptions |
| **Off White** | `#F5F5F5` | Card backgrounds, code blocks |
| **Faint Gray** | `#DDDDDD` | Watermark-style step numbers |

### Opacity Values (for dark backgrounds)
- `rgba(255,255,255,0.7)` — Body text on black
- `rgba(255,255,255,0.4)` — Captions on black
- `rgba(255,255,255,0.2)` — Faint numbering on black
- `rgba(255,255,255,0.1)` — Subtle dividers on black
- `rgba(255,255,255,0.06)` — Background watermark numbers

## Typography

| Element | Size | Weight | Color | Notes |
|---------|------|--------|-------|-------|
| Cover title | 48pt | 900 (black) | #000000 | letter-spacing: -2pt |
| Section title (dark bg) | 36pt | bold | #ffffff | |
| Content title | 24-28pt | bold | #000000 | |
| Body text | 13-14pt | regular | #000000 | |
| Code/command | 9-10pt | regular | #333333 | font-family: Courier New |
| Labels/captions | 9-10pt | regular | #999999 | letter-spacing: 2pt, uppercase |
| Step numbers (light bg) | 18pt | bold | #DDDDDD | Watermark style |
| Step numbers (dark bg) | 14pt | bold | rgba(255,255,255,0.2) | |
| Accent numbers | 22pt | bold | #FF3B30 | Index, numbered lists |

## Layout Rules

### Base Template (ALL slides)
```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
html { background: #ffffff; }  /* or #000000 for dark slides */
body {
  width: 720pt; height: 405pt; margin: 0; padding: 0;
  background: #ffffff; font-family: Arial, sans-serif;
  display: flex;
}
</style>
</head>
<body>
<div style="margin: 40pt 50pt; flex: 1; display: flex; flex-direction: column;">
  <!-- content here -->
</div>
</body>
</html>
```

### Critical Layout Rules
- **ALWAYS use flexbox** — NEVER use `position: absolute` (causes overlapping shapes in PPTX)
- **Content wrapper**: `margin: 40pt 50pt` on the main div (40pt top/bottom, 50pt left/right)
- **Two-column layout**: `display: flex` on parent, `flex: 1` on children, `margin-right/left: 10-20pt` for gap
- **Accent bar**: `<div style="width: 40pt; height: 3pt; background: #FF3B30; margin: 0 0 20pt 0;"></div>` below titles
- **Cards**: `background: #F5F5F5; padding: 10-14pt;` with optional `border-left: 3pt solid #000000`

### HTML Element Rules
- ALL text MUST be in `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` tags
- NO `<span>` tags (causes validation errors in html2pptx)
- Backgrounds/borders ONLY on `<div>` elements
- NO CSS gradients — rasterize as PNG first

## Slide Types

### 1. Cover Slide
White background with left red accent bar and bottom black bar.

```html
<body>
<div style="width: 8pt; background: #FF3B30;"></div>
<div style="margin: 40pt 50pt; flex: 1; display: flex; flex-direction: column;">
  <p style="font-size: 10pt; font-weight: 700; color: #FF3B30; letter-spacing: 4pt; margin: 0 0 20pt 0;">WORKSHOP</p>
  <h1 style="font-size: 48pt; font-weight: 900; color: #000000; letter-spacing: -2pt; line-height: 1.15; margin: 0 0 24pt 0;">TITLE<br>HERE.</h1>
  <p style="font-size: 14pt; color: #666666; line-height: 1.7; margin: 0;">Subtitle description</p>
  <div style="flex: 1;"></div>
  <div style="background: #000000; margin: 0 -50pt -40pt -50pt; padding: 16pt 50pt; display: flex; justify-content: space-between; align-items: center;">
    <p style="font-size: 11pt; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: 1pt;">brand.com</p>
    <p style="font-size: 12pt; color: rgba(255,255,255,0.3); margin: 0;">N SLIDES</p>
  </div>
</div>
</body>
```

### 2. Section Divider (dark)
Black background with large watermark number.

```html
<!-- html/body background: #000000 -->
<div style="margin: 40pt 50pt; flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
  <p style="font-size: 120pt; font-weight: 900; color: rgba(255,255,255,0.06); margin: 0; line-height: 1;">01</p>
  <h1 style="font-size: 36pt; font-weight: bold; color: #ffffff; margin: -30pt 0 10pt 0;">Section<br>Title.</h1>
  <p style="font-size: 10pt; color: rgba(255,255,255,0.4); margin: 0; letter-spacing: 2pt;">ENGLISH SUBTITLE</p>
</div>
```

### 3. Content Slide (standard)
White background, title + red accent bar + body.

```html
<div style="margin: 40pt 50pt; flex: 1; display: flex; flex-direction: column;">
  <h1 style="font-size: 24pt; font-weight: bold; color: #000000; margin: 0 0 8pt 0;">Title</h1>
  <div style="width: 40pt; height: 3pt; background: #FF3B30; margin: 0 0 20pt 0;"></div>
  <div style="display: flex; flex: 1;">
    <!-- Two columns -->
    <div style="flex: 1; margin-right: 20pt;">
      <!-- Left content -->
    </div>
    <div style="flex: 1; margin-left: 20pt;">
      <!-- Right content -->
    </div>
  </div>
</div>
```

### 4. Content Slide with Cards
Cards use #F5F5F5 background with optional left border.

```html
<!-- Inside two-column layout -->
<div style="background: #F5F5F5; padding: 10pt; margin: 0 0 6pt 0;">
  <p style="font-size: 12pt; font-weight: bold; color: #000000; margin: 0 0 3pt 0;">Card Title</p>
  <p style="font-size: 10pt; color: #666666; margin: 0; line-height: 1.4;">Card description text.</p>
</div>

<!-- Code block card -->
<div style="background: #F5F5F5; padding: 8pt 10pt; border-left: 3pt solid #000000;">
  <p style="font-size: 9pt; font-family: 'Courier New', monospace; color: #333333; margin: 0; line-height: 1.5;">code content here</p>
</div>
```

### 5. Step-by-Step Slide
Numbered steps in two columns with watermark numbers.

```html
<!-- Inside column -->
<div style="background: #F5F5F5; padding: 12pt 14pt; margin: 0 0 10pt 0;">
  <p style="font-size: 18pt; font-weight: bold; color: #DDDDDD; margin: 0 0 4pt 0;">01</p>
  <p style="font-size: 13pt; font-weight: bold; color: #000000; margin: 0 0 4pt 0;">Step Title</p>
  <p style="font-size: 10pt; font-family: 'Courier New', monospace; color: #333333; margin: 0 0 3pt 0;">command here</p>
  <p style="font-size: 9pt; color: #999999; margin: 0;">Description text</p>
</div>
```

### 6. Comparison/Before-After Slide
Left (before) vs right (after) with contrasting styles.

```html
<div style="display: flex; flex: 1;">
  <div style="flex: 1; margin-right: 10pt; display: flex; flex-direction: column;">
    <p style="font-size: 9pt; color: #999999; margin: 0 0 4pt 0; letter-spacing: 2pt;">BEFORE</p>
    <!-- Before content -->
  </div>
  <div style="flex: 1; margin-left: 10pt; display: flex; flex-direction: column;">
    <p style="font-size: 9pt; color: #FF3B30; margin: 0 0 4pt 0; letter-spacing: 2pt;">AFTER</p>
    <!-- After content (with red accents) -->
  </div>
</div>
```

### 7. Quote/Highlight Block
Left border accent for callout content.

```html
<div style="border-left: 4pt solid #000000; padding-left: 16pt; margin: 0 0 16pt 0;">
  <p style="font-size: 16pt; font-style: italic; color: #333333; margin: 0; line-height: 1.6;">Quote or key insight text here</p>
</div>
```

### 8. Dark Highlight Bar
Black background bar for key takeaways.

```html
<div style="background: #000000; padding: 8pt 10pt;">
  <p style="font-size: 11pt; color: #ffffff; margin: 0;">Key takeaway message</p>
</div>
```

### 9. Closing/CTA Slide (dark)
Black background with centered message.

```html
<!-- html/body background: #000000 -->
<div style="margin: 40pt 50pt; flex: 1; display: flex; flex-direction: column; justify-content: center;">
  <h1 style="font-size: 30pt; font-weight: bold; color: #fff; margin: 0 0 28pt 0; line-height: 1.4;">Main CTA message</h1>
  <div style="display: flex; margin: 0 0 28pt 0;">
    <div style="flex: 1; margin-right: 10pt;">
      <p style="font-size: 10pt; color: #FF3B30; margin: 0 0 6pt 0; letter-spacing: 2pt;">LABEL</p>
      <p style="font-size: 13pt; color: rgba(255,255,255,0.7); margin: 0;">Description</p>
    </div>
    <!-- More columns... -->
  </div>
  <p style="font-size: 16pt; font-weight: bold; color: #FF3B30; margin: 0;">brand.com</p>
</div>
```

## Design Principles

1. **Maximum 3 colors per slide** — Black/White + one accent (Red)
2. **Generous whitespace** — 40pt/50pt margins, never cramped
3. **Clear hierarchy** — Title (24-28pt bold) > Body (13-14pt) > Caption (9-10pt gray)
4. **Red sparingly** — Only for accent bars, numbers, labels, CTAs
5. **Alternate backgrounds** — White for content, Black for section dividers and emphasis
6. **Consistent patterns** — Same title + accent bar combo on every content slide
7. **Two-column max** — Never more than 2 columns for readability
