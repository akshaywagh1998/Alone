# UPSC Civil Services Mains Coaching Portal

A comprehensive client-side argument verification and substantiation portal for UPSC Civil Services examination preparation.

## Overview

This portal helps UPSC aspirants verify the accuracy, depth, and substantiation of their arguments across all 93 General Studies and History Optional syllabus topics. It uses a 6-dimension scoring algorithm to provide real-time feedback on argument quality.

## Features

- **Argument Verification Engine**: 6-dimension scoring system (0-100 scale)
  - Length & Depth (0-20 pts)
  - Evidence & Facts (0-25 pts)
  - Balance & Nuance (0-20 pts)
  - India Context (0-15 pts)
  - Structure (0-10 pts)
  - Logical Flow (0-10 pts)

- **Comprehensive Syllabus Coverage**
  - General Studies Papers I-IV (61 topics)
  - History Optional Papers I-II (32 topics)
  - Pinpoint arguments and examples for each topic

- **Real-time Analysis**
  - Instant text scoring and feedback
  - Topic-based navigation
  - Search and filter across syllabus
  - Responsive grid interface with tab-based navigation

## Quick Start

1. Open `upsc_coaching_portal_enhanced.html` in a web browser
2. Select your topic from General Studies or History tabs
3. Enter your argument in the text area
4. Click "Verify Argument" to receive instant feedback
5. Review the scoring breakdown and suggestions

## File Structure

```
.
├── upsc_coaching_portal_enhanced.html  # Main application
├── syllabus_data.json                  # Complete syllabus database
├── vercel.json                         # Vercel deployment config
├── .gitignore                          # Git ignore rules
├── START_HERE.txt                      # Comprehensive orientation
├── QUICK_START.txt                     # 2-minute guide
├── PORTAL_USAGE_GUIDE.md               # Detailed usage instructions
├── README_TECHNICAL.md                 # Technical architecture
└── FILES_SUMMARY.txt                   # File reference guide
```

## Technical Architecture

- **Client-Side Only**: No server required
- **Data Format**: JSON-based syllabus database (93 topics)
- **UI Framework**: HTML5 + CSS3 (Grid/Flexbox)
- **JavaScript**: ES6+ with async data loading
- **Responsive Design**: Works on desktop and tablet devices

## Deployment

### Local Testing

1. Ensure all files are in the same directory
2. Open `upsc_coaching_portal_enhanced.html` via HTTP server (not file://)
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```

### Vercel Deployment

This portal is configured for automatic deployment on Vercel:

1. Push this repository to GitHub
2. Connect repository to Vercel
3. Vercel automatically uses `vercel.json` configuration
4. Portal will be live at `your-vercel-domain.vercel.app`

The `vercel.json` file configures:
- Static file serving
- CORS headers for JSON data
- Automatic routing to main portal
- Content-type headers

## Scoring Algorithm Details

The verification engine analyzes arguments across 6 dimensions:

1. **Length & Depth (0-20)**: Comprehensiveness and elaboration
2. **Evidence & Facts (0-25)**: Factual backing and examples
3. **Balance & Nuance (0-20)**: Acknowledging multiple perspectives
4. **India Context (0-15)**: Relevance to Indian context
5. **Structure (0-10)**: Logical organization and flow
6. **Logical Flow (0-10)**: Coherence and connectivity

**Total Score**: Weighted sum across all dimensions (0-100)

## Documentation

- **START_HERE.txt**: Best starting point for orientation
- **QUICK_START.txt**: 2-minute quick start guide
- **PORTAL_USAGE_GUIDE.md**: Complete usage instructions with examples
- **README_TECHNICAL.md**: Technical implementation details
- **FILES_SUMMARY.txt**: Complete file reference and breakdown

## Data Source

Syllabus data extracted from official UPSC civil services mains examination syllabus covering:
- General Studies (61 topics across 4 papers)
- History Optional (32 topics across 2 papers)

Each topic includes:
- Value additions (key concepts)
- Relevant examples (case studies, events)
- Argument angles (multiple perspectives)

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Opera

## Requirements

- Modern web browser with ES6+ support
- HTTP/HTTPS access (for JSON loading)
- No additional installations needed

## Author

Created for UPSC Civil Services Mains examination preparation (August 2026 mains attempt)

## License

For educational and personal use

---

For more detailed information, see documentation files included in this repository.
