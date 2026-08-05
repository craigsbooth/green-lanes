# Green Lanes - Legal Byways Explorer

Interactive map application for exploring legal green lanes (BOATs and UCRs) in County Durham and Yorkshire.

## Features

- Interactive Map - Full-screen Leaflet map with route overlays colour-coded by difficulty
- Route Filtering - Filter by county, route type (BOAT/UCR), difficulty, and terrain features
- Route Details - Click any route for full info: description, length, grid ref, terrain, TRO status, images
- TRO Awareness - Routes with Traffic Regulation Orders are clearly flagged
- Responsive - Works on desktop, tablet and mobile

## Getting Started

npm install
npm run dev

Open http://localhost:3000

## Tech Stack

- Next.js 14 (App Router)
- React Leaflet + Leaflet.js
- Tailwind CSS
- TypeScript
- GeoJSON route data

## Adding Routes

Edit src/data/routes.ts to add new routes as GeoJSON Features.
