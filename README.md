# BookLoop

BookLoop is a student-focused second-hand book marketplace designed to help students **find, buy, sell, request, exchange, and relist academic books**. The platform combines a normal marketplace with academic-semester matching and location-aware discovery.

## Key features

### Marketplace
- Student and shop accounts
- Create, edit, delete, and view book listings
- Multiple book images with Cloudinary uploads
- Book categories, conditions, pricing, stock, and availability
- Seller profiles
- Wishlist
- Dashboard and listing management
- Search, autocomplete, text search, fuzzy matching, filtering, sorting, and pagination

### Nearby Book Radar
- Find available books near the user's current location
- Browser-based location permission
- Radius selection
- GeoJSON + MongoDB geospatial search
- Pickup address and precise latitude/longitude for listings
- Map-based discovery and distance display

### Smart Semester Book Finder
Students can maintain an academic profile containing:
- College
- Degree
- Course
- Academic year
- Year
- Semester

BookLoop uses the profile to show verified academic books for the student's semester and then checks the marketplace for available copies.

The academic workflow supports:
- Prescribed and reference books
- Subject and subject-code mapping
- ISBN and edition information
- Admin verification/rejection of academic catalog submissions
- Existing marketplace listings linked to academic catalog records
- Book requests when no matching listing is available
- Matching requests automatically when a suitable listing becomes available
- Relisting previously purchased academic books

### Book Requests
Students can request unavailable academic books. When a matching seller listing appears, the request can move from:

`Open → Matched`

and the student can see the matching book and seller.

If a matched listing is removed before purchase, the affected request is reopened so the student can continue looking.

### Book Exchange
Students can exchange one available book for another student's book:
- Send an exchange offer
- Accept or reject an offer
- Cancel a pending offer
- Reserve both books after acceptance
- Both students confirm the physical swap
- Ownership is transferred after both confirmations
- Exchange completion notifications

### Cart and Payments
- Cart-based checkout
- Individual and multi-book checkout
- Razorpay integration
- Cashfree integration with sandbox/production configuration
- Server-side payment verification
- Order records and paid/failed states
- Purchased academic books can be tracked for later relisting

### Notifications
BookLoop includes an in-app notification center with unread notifications.

Notifications can be triggered for events such as:
- Academic book request matches
- Academic catalog verification/rejection
- Exchange activity
- Listing/request updates
- Successful payments

Optional email notifications can be enabled through Brevo's transactional email API.

## Technology stack

**Frontend**
- HTML5
- CSS3
- Bootstrap
- EJS
- JavaScript
- Leaflet

**Backend**
- Node.js
- Express
- Passport.js
- Joi / validation middleware

**Database**
- MongoDB
- Mongoose
- MongoDB text and geospatial indexes

**Services**
- Cloudinary for images
- Razorpay for payments
- Cashfree for payments
- Brevo for optional email notifications
- Nominatim/OpenStreetMap for location search where configured

## Project structure

```text
Booklooop/
├── config/              # Database and authentication configuration
├── controller/          # Route/controller logic
├── middleware/          # Authentication, validation, and middleware
├── models/              # Mongoose schemas
├── public/
│   ├── css/             # Page and theme styles
│   └── js/              # Client-side JavaScript
├── routes/              # Express routes
├── scripts/             # Utility scripts
├── test/                # Automated tests
├── utils/               # Shared helpers and services
├── views/               # EJS templates
├── .env.example         # Environment variable template
└── app.js               # Application entry point
```

## Local setup

### Requirements
- Node.js 22+ recommended
- MongoDB local instance or MongoDB Atlas
- Git

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/Shaikhsaquib7276/Booklooop.git
cd Booklooop
npm install
```

Copy the environment template:

**PowerShell**
```powershell
Copy-Item .env.example .env
```

**Command Prompt**
```cmd
copy .env.example .env
```

Then edit `.env` and provide the required values.

Start development mode:

```bash
npm run dev
```

Or start normally:

```bash
npm start
```

Open:

``text
http://localhost:3000
```

## Important environment variables

At minimum, configure:

```env
MONGO_URL=your_mongodb_connection_string
SESSION_SECRET=your_long_random_secret
```

Configure the services you use:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

CASHFREE_APP_ID=...
CASHFREE_SECRET_KEY=...
CASHFREE_ENV=sandbox

BOOKLOOP_BASE_URL=http://localhost:3000
```

For optional email notifications:

```env
NOTIFICATION_EMAIL_ENABLED=false
BREVO_API_KEY=...
NOTIFICATION_EMAIL_FROM=...
NOTIFICATION_EMAIL_FROM_NAME=BookLoop
```

Never commit real credentials or API secrets to GitHub.

## Testing and quality checks

Run the automated tests with:

```bash
npm test
```

To inspect dependency vulnerabilities:

```bash
npm audit
```

Avoid using `npm audit fix --force` without reviewing the dependency changes because it can introduce breaking updates.

## Deployment

BookLoop can be deployed as a Node.js web service on platforms such as Render.

Typical Render settings:

```text
Build Command: npm install
Start Command: node app.js
```

Production secrets should be configured in the hosting platform's environment-variable settings rather than committed to the repository.

## Academic workflow

```text
Student academic profile
        ↓
Verified academic catalog
        ↓
Required semester books
        ↓
Marketplace matching
        ↓
Available listing?
   ┌────┴────┐
  YES       NO
   ↓         ↓
View Book   Request Book
   ↓         ↓
Purchase    Seller lists book
             ↓
          Match + notification
```

## Nearby workflow

```text
Browser location permission
          ↓
Latitude / Longitude
          ↓
MongoDB geospatial query
          ↓
Available books within selected radius
          ↓
Map + distance + pickup information
```

## Payment workflow

```text
Cart
 ↓
Create BookLoop order
 ↓
Razorpay / Cashfree Checkout
 ↓
Payment
 ↓
Server-side verification
 ↓
Paid order
 ↓
Update purchased books / order status
```

## Security notes

- Keep API keys and secrets in environment variables.
- Do not expose payment secrets in frontend JavaScript.
- Validate user input on the server.
- Verify payment results on the server before marking orders as paid.
- Use authenticated routes for account, request, payment, and exchange actions.
- Respect browser location permission; location is requested only when the user chooses location-based discovery.

## Academic project documentation

For a college submission, the project can be documented with:
- Software Requirements Specification (SRS)
- System architecture
- UML diagrams
- Database/schema design
- Module descriptions
- Test cases and results
- IEEE-style literature review/references
- Deployment and future-scope documentation

## Current development focus

The project is being developed incrementally with separate feature branches so that marketplace, academic finder, nearby search, payment, exchange, notification, and UI/theme changes can be tested without unnecessarily mixing unrelated changes.
