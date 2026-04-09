# Interactive Master Plan Map Clone

This project is a fully interactive, production-grade clone of a master plan map site. It features smooth zoom and pan mechanics, tile virtualization to maintain 60 FPS performance regardless of map size, and SVG overlay integration.

## Setup Instructions

1. **Install Dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Add Your Dynamic SVG Element:**
   Make sure you place your actual `overlay.svg` in the `public/` directory (it is currently mocked automatically if not found).
   The engine automatically hooks into:
   - Polygons and Paths (creates hover and sidebar interaction bindings)
   - Groups `<g>` that have `data-name="360-x"` attribute (adds smooth, drift-free zoom-aware scaling and click bindings).
   - *Note: Ensure your `overlay.svg` doesn't have fixed `viewBox` that conflicts with the 8192 x 4096 expected space.*

3. **Start Development Server:**
   \`\`\`bash
   npm run dev
   \`\`\`

## Architecture & Features

- **Tile Virtualization Layer:** Only the tiles intersecting the current viewport are rendered dynamically as `<img>` elements to `#tiles-layer`. This prevents having $32 \times 32 = 1024$ DOM elements at once, which ensures fluid scrolling and zooming.
- **Hardware-Accelerated Map Space:** The map interactions use CSS Transforms (`translate`, `scale`) with `transform-origin: 0 0` set to the `will-change: transform;` container layer.
- **Cursor-Centric Zoom:** Natural wheel/pinch zooming mathematically interpolates around your exact cursor coordinate.
- **Drift-Free Relative Scaling for 360 SVG Groups:** Standard zoom scales the entire map uniformly. To keep the 360 markers physically fixed but visually distinct at high zooms, a reverse relative scale is mathematically pushed to markers automatically using the current viewport zoom scale.

## Further Tweaks
To modify scale constraints, marker scaling rates, panning clamps, or filter states, you can fine-tune values located globally in `main.js`.
