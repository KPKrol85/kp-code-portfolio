# NovaLearn Academy — Multi-Page Static Website

## Project overview
NovaLearn Academy is a premium, trust-first education brand offering language learning, exam preparation, and professional upskilling. This project is a production-ready multi-page static site (HTML + CSS + vanilla JS) focused on accessibility, clarity, and performance.

## Features
- **UX & trust**: Clear value propositions, structured program cards, testimonials, and transparent pricing.
- **Accessibility (WCAG 2.2 AA)**: Skip link, semantic landmarks, keyboard support, visible focus states, accessible forms, and accordion semantics.
- **SEO**: Unique metadata per page, canonical tags, Open Graph/Twitter cards, and structured data where appropriate.
- **Performance**: Mobile-first CSS, system font stack, optimized SVG placeholders, and lightweight JS enhancements.

## File structure
```
education/html-css-js/pr-02-novalearn-academy/
  index.html
  courses.html
  course-detail.html
  about.html
  teachers.html
  teacher-detail.html
  pricing.html
  success-stories.html
  faq.html
  enroll.html
  contact.html
  privacy.html
  terms.html
  css/
    tokens.css
    base.css
    layout.css
    components/
      header.css
      footer.css
      buttons.css
      cards.css
      forms.css
      accordion.css
    style.css
  js/
    main.js
    modules/
      nav.js
      accordion.js
      form-validate.js
      course-filters.js
  assets/
    img/
      hero-illustration.svg
      map-placeholder.svg
```

## How to run locally
1. Open `index.html` in your browser.
2. Use a simple local server if you need consistent module loading:
   ```bash
   python3 -m http.server 8000
   ```
3. Navigate to `http://localhost:8000/education/html-css-js/pr-02-novalearn-academy/`.

## Accessibility notes
Keyboard testing checklist:
- Tab through the global navigation and ensure focus is visible.
- Use Enter/Space to open the mobile nav toggle.
- Verify the FAQ accordion opens and closes with keyboard input.
- Submit the enrollment form with missing fields to hear/read validation feedback.

## SEO / metadata checklist
- Unique `<title>` and meta description per page
- Canonical tags present
- Open Graph + Twitter card tags included
- JSON-LD structured data for organization and course page

## Performance checklist
- ✅ System font stack (no external font requests)
- ✅ SVG placeholders optimized and local
- ✅ Minimal JavaScript with `type="module"` and progressive enhancement
- ✅ Responsive layout and reduced motion support

## Localization note
All content is written in English and structured for straightforward localization. Replace copy blocks and update metadata per locale as needed.
