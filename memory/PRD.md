# WriteSleuth - Handwriting Forensic Comparator

## Overview
Cross-platform mobile application for forensic handwriting analysis built with Expo/React Native and FastAPI backend.

## Core Features
1. **Image Import**: Load questioned document and known sample handwriting images
2. **Handwriting Comparison**: Multi-algorithm analysis (SSIM, edge detection, AI-powered via Grok)
3. **Visualization**: Side-by-side images, heatmaps, difference maps
4. **Scoring**: Composite similarity score with red (<50%) / green (≥50%) color coding
5. **Crop & Overlay Mode**: Detailed inspection with crop, overlay, pinch-to-zoom, rotation
6. **PDF Reports**: Export forensic analysis reports
7. **History**: Track and review past comparisons

## Tech Stack
- **Frontend**: React Native, Expo SDK 49+, TypeScript, Zustand, react-native-gesture-handler, react-native-reanimated
- **Backend**: FastAPI, Python, OpenCV, ReportLab
- **Database**: MongoDB
- **AI**: Grok API (xAI) for vision analysis

## Architecture
```
/app
├── backend/
│   ├── server.py      # FastAPI endpoints and image processing
│   ├── .env           # MONGO_URL, XAI_API_KEY
│   └── requirements.txt
├── frontend/
│   ├── app/           # Expo Router screens
│   │   ├── index.tsx  # Main screen
│   │   ├── results.tsx
│   │   ├── crop.tsx   # Crop selection
│   │   ├── overlay.tsx # Overlay manipulation
│   │   ├── help.tsx
│   │   └── history.tsx
│   ├── styles/
│   │   └── theme.ts   # Steampunk theme colors
│   ├── store/
│   │   ├── appStore.ts
│   │   └── overlayStore.ts
│   └── services/
│       └── api.ts
```

## Key API Endpoints
- `POST /api/compare` - Main handwriting comparison
- `GET /api/history` - Retrieve past comparisons
- `GET /api/report/{id}` - Generate PDF report
- `POST /api/crop-region` - Crop image region
- `POST /api/local-comparison` - Compare cropped regions

## Completed Work (Dec 2025)

### Phase 1: Core Application ✅
- Full-stack foundation with Expo + FastAPI
- Image upload and comparison logic
- MongoDB history tracking
- Grok AI integration for analysis
- PDF report generation

### Phase 2: Crop & Overlay Feature ✅
- Crop selection screen with draggable box
- Corner resize handles
- Overlay manipulation with gestures
- Local SSIM and edge comparison

### Phase 3: UI/Theme Updates (Dec 8, 2025) ✅
- **Fixed: Crop box gesture handling** - Properly saves start position in `onStart` and uses translation deltas
- **Fixed: Pinch-to-zoom flaky behavior** - Added damping factor (0.4) to reduce sensitivity by 60%
- **Fixed: Rotation gesture** - Added damping and snap-to-5-degrees feature
- **Applied: Steampunk Forensic Theme** across all screens
  - Dark mahogany backgrounds (#0d0907, #1a120e)
  - Brass accents (#cd9b3e)
  - Copper highlights (#b87333)
  - Aged parchment text (#e8dfd4)
  - Decorative rivets on cards and containers

### GitHub Repository
- Code pushed to: https://github.com/rcullens/Writesleuth
- API keys removed from version control

## Backlog / Future Tasks
- [ ] Multiple overlays support
- [ ] Save overlay state to PDF
- [ ] Alignment grid/crosshair visual aids in overlay
- [ ] Gesture testing with Detox or device simulator

## Credentials
- **xAI API Key**: Stored in `backend/.env` as `XAI_API_KEY`
