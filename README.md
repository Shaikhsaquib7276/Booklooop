# BookLoop

BookLoop is a student marketplace for buying and selling second-hand books. Users can create an account, publish book listings with cover images, search and filter the catalogue, save books to a wishlist, and manage their listings from a dashboard.

## Current features

- Local account signup, login, and logout with Passport
- Create, edit, delete, and view book listings
- Cloudinary image uploads
- Search, filtering, sorting, and pagination
- Seller profiles, wishlists, and listing status management
- A personal dashboard with listing and wishlist statistics
- Reservation requests: buyers request a listing and sellers accept or reject it

## Local setup

1. Install Node.js 22 or later and MongoDB, or use a MongoDB Atlas database.
2. Copy `.env.example` to `.env` and enter your own configuration values.
3. Install packages with `npm.cmd install` in PowerShell (or `npm install` in a standard terminal).
4. Start the app with `npm.cmd run dev` for development or `npm.cmd start` for a normal run.
5. Open `http://localhost:3000`.

## Quality checks

Run `npm.cmd test` to execute the current automated tests.

## Planned work

The next product milestones are payment integration, private buyer-to-seller messaging, and server-side phone verification.
