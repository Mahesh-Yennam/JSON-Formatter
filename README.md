# JSON Formatter, Validator & Tree Visualizer — Gamility Tools

A modern, privacy-first, client-side JSON engineering utility built for developers, data engineers, and API integrators. Features instant formatting, minification, real-time syntax error diagnosis with line/col coordinates, interactive collapsible tree visualization, and auto-repair for common JSON mishaps.

---

## 🌟 Features & Highlights

- **⚡ Configurable Formatting:** Beautify JSON with 2-space, 4-space, or Tab indentation.
- **📦 Minifier & Compressor:** 1-click removal of all whitespace, line breaks, and padding for optimal API payload sizes.
- **🔍 Syntax Error Diagnostics:** Pinpoint exact syntax errors with line number, column offset, and highlighted contextual error snippets.
- **🌳 Interactive Collapsible Tree View:**
  - Dynamic expand / collapse for nested objects and arrays.
  - Color-coded data types (Keys, Strings, Numbers, Booleans, Null).
  - Search / filter across keys and values.
  - Node path breadcrumb navigation.
- **🛠️ Smart Auto-Repair:** Automatically cleans common JSON syntax issues:
  - Converts single quotes `'` to double quotes `"`.
  - Removes trailing commas in arrays and objects.
  - Quotes unquoted property keys.
  - Strips JavaScript single-line (`//`) and multi-line (`/* */`) comments.
- **📊 Payload Analytics:** Live reporting of byte size, total nodes, total keys, array elements, and maximum object nesting depth.
- **🔒 100% Client-Side Privacy:** Zero network transmissions. All parsing and manipulation occurs strictly in your browser's local memory.
- **📥 Import & Export:** Drag-and-drop file upload (`.json`, `.txt`), instant clipboard copy, and `.json` file download.

---

## 🚀 Quick Start

### Local Preview
Open `index.html` directly in any modern browser:
```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

Or serve via any static HTTP server:
```bash
npx serve .
```

---

## 🛡️ License & Copyright

Copyright © 2026 [Gamility](https://mahesh-yennam.github.io/Gamility/). All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or commercial exploitation is strictly prohibited without prior written permission from Gamility.
