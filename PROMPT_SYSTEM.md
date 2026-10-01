# SYSTEM PROMPT & DEVELOPMENT GUIDELINES
**Project Name:** GrabStudent (University Carpool MVP)
**Platform:** Responsive Web App (Mobile-First approach, adapting to Desktop)
**Theme:** Minimalist, SaaS Aesthetic, Soft Pastel Purple/Lilac (#E6E6FA, #D8BFD8), Clean White Backgrounds, Glassmorphism drop-shadows, Rounded Corners (rounded-lg).

## 1. PROJECT OVERVIEW
GrabStudent is a closed-ecosystem carpool matching platform built exclusively for university students. 
* **Problem:** High commercial e-hailing costs, inefficient campus buses, and restricted student mobility.
* **Cause:** Lack of a centralized, secure peer-to-peer platform with community cost-sharing pricing.
* **Resolution:** A verified, student-only web system that matches drivers and passengers using a flat-rate 'petrol-sharing' algorithm.

## 2. UI/UX GLOBAL STYLE GUIDELINES
Based on the provided wireframes, enforce the following UI/UX rules across all pages:
* **Responsiveness:** All pages must adapt flawlessly between desktop web and mobile screens. Use CSS Grid/Flexbox.
* **Color Palette:** Clean white/off-white backgrounds with soft pastel purple/lilac as the primary accent for active states, buttons, and highlights[cite: 1, 2, 3, 4].
* **Layouts:** Use sidebar navigation for desktop (collapsible to a hamburger menu on mobile)[cite: 2, 3, 4]. 
* **Components:** Use rounded cards with subtle drop shadows to display data (e.g., ride listings)[cite: 2].

## 3. USER ROLES & JOURNEYS
### A. Passenger (Student without vehicle)
* **Journey:** Register + Upload Student ID -> Wait for Admin Approval -> Login -> View Dashboard (Available Rides) -> Click "Book Now" -> Pay flat rate via Cash/QR offline.
* **UI Focus:** Clean grid of "Available Rides" cards showing Route, Time, Flat Rate, and a prominent "Book Now" button[cite: 2].

### B. Driver (Student with vehicle)
* **Journey:** Register + Upload Student ID & Driving License -> Wait for Admin Approval -> Login -> Create Ride (Route, Time, Seats) -> View Booking Requests -> Click "Accept" or "Reject" -> Execute ride.
* **UI Focus:** Top section for "Create Ride" form (From, To, Date, Time, Seats) and bottom section for "Booking Requests" showing passenger details with minimalist Accept (green) / Reject (grey) actions[cite: 3].

### C. System Admin (Platform Manager)
* **Journey:** Login -> Open Approval Dashboard -> Verify uploaded Student IDs / Licenses -> Click "Approve" or "Reject" -> Monitor System Logs.
* **UI Focus:** Professional data table for "User Approvals" with tabs (Pending, Approved), ID thumbnails, and quick action buttons[cite: 4].

## 4. CORE MVP FEATURES (IPO MODEL)
* **Input:** User credentials, ID document images (drag & drop zone)[cite: 1], Route selection, Date/Time, Seat count[cite: 3].
* **Process:** Authentication, Admin manual approval (Pending -> Active), Automatic seat deduction upon booking acceptance, Flat-rate generation based on zones.
* **Output:** Dashboard lists of available rides[cite: 2], Booking status notifications, Ride history audit trails.

## 5. BUSINESS RULES (LOGIC CONSTRAINTS)
1. **Default Status:** All new registrations are set to `Pending` and cannot book or create rides until approved by Admin.
2. **Document Mandatory:** Drivers must submit BOTH a valid Student ID and Driving License to be approved.
3. **Flat-Rate Capping:** Drivers cannot set their own prices. The system dictates a static flat rate based on the chosen destination zones.
4. **Seat Limits:** Maximum seat capacity per ride creation is capped at 4 passengers.
5. **Auto-Deduction:** Clicking "Accept" on a booking request automatically deducts 1 from the Available Seats count[cite: 3].
6. **Zero Seats:** The "Book Now" button becomes disabled/hidden if available seats reach 0.
7. **Time Validation:** Departure time input must be greater than the current system time.

## 6. REQUIRED PAGES & VIEWS
1. **Login & Register Page:** Split-screen (desktop) or centered card (mobile) with drag-and-drop ID upload zone[cite: 1].
2. **Passenger Dashboard:** Displays filterable 'Available Rides' cards[cite: 2].
3. **Driver Dashboard:** Features a 'Create Ride' widget and a 'Booking Requests' list[cite: 3].
4. **Admin Dashboard:** Features a 'User Approvals' data table with status badges and ID thumbnails[cite: 4].

**Developer Instruction:** Use standard modern frameworks (e.g., React/Next.js with Tailwind CSS or Laravel/Blade) to generate these interfaces adhering strictly to the pastel purple styling and MVP business logic.