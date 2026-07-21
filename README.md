# WanderLust - Premium Airbnb Clone

WanderLust is a feature-rich, full-stack MVC web application designed to replicate the listing, booking, review, and user management core experience of Airbnb. Built with modern backend engineering practices, a dynamic theme engine, responsive grid layouts, and interactive mapping, WanderLust provides a high-end, responsive travel booking feel.

---

## 💡 Development Philosophy & Handcrafted Architecture

This project was built from scratch, utilizing **organic, manual programming techniques** to implement its core systems. 

- **MVC Structural Foundation**: Built without heavy automation boilerplate, the Model-View-Controller (MVC) architecture was handcrafted line-by-line. Database models, route handlers, controllers, and middlewares were manually designed to keep the codebase dry, performant, and organized.
- **Robust Authorization & Logic Layers**: The security infrastructure—including sessions, Passport configurations, authorization middleware validations, and database schema mappings—was written from scratch, ensuring complete control over the application's runtime.
- **Handmade Custom Styling**: The custom styling system, theme state preservation, adaptive variables, and animation transitions were tailored manually in CSS to match modern design guidelines.

---

## 🚀 Key Features

### 1. Dynamic Dark & Light Theme Engine
- **State Persistence**: Instantly checks user preferences using local storage, loading the chosen theme synchronously in the head to prevent visual page flickering (FOUC).
- **Smooth Eased Transitions**: Transitions all background colors, typography, borders, and shadows seamlessly using a `cubic-bezier(0.4, 0, 0.2, 1)` easing curve.
- **Dark Mode Map Filter**: Applies a premium Mapbox Dark-style CSS filter onto active Leaflet map containers (`#map` and `#map-preview`) when the dark theme is active.

### 2. Premium Landing Page (Root `/` Routing)
- Designed an introductory landing page at the root route featuring:
  - An animated **Hero Section** with a glassmorphism travel search engine widget.
  - Interactive **Categories Filter Tiles** linking directly to filtered listing views.
  - **Featured Showcase** showcasing popular destinations.
  - **Host CTA & Value Proposition panels** for onboarding travelers and hosts.

### 3. Listings & Geocoding Management (CRUD)
- Complete creation, reading, editing, and deletion (CRUD) flow for properties.
- **Image Cloud Hosting**: Integrated Cloudinary services via `multer` for secure, optimized user-uploaded listing photos.
- **OpenStreetMap Nominatim Geocoding**: Automatically geocodes location details into geographic coordinates and maps them onto an interactive **Leaflet Map**.

### 4. Interactive Review System
- Hand-coded starability rating selections (1-5 stars).
- Custom reviews rendering with automated author identification.
- Authorization guards to ensure only the review's author can delete their feedback.

### 5. Mobile-First Optimization
- **Fluid Layout Adapting**: Form components (New listing, Edit listing, Login, and Signup forms) center dynamically (`col-lg-6 offset-lg-3 col-md-8 offset-md-2 col-12`) for readable margins on phones, tablets, laptops, and monitors.
- **Horizontal category scroll**: Category navigation lists on listings view scroll horizontally with custom hidden-scroll scrollbars.

---

## 🛠️ Technology Stack

- **Backend Architecture**: Node.js, Express.js (MVC Pattern)
- **Database Model**: MongoDB, Mongoose ODM
- **Templating Engine**: EJS (embedded Javascript) with `ejs-mate` layouts
- **Security & Authentication**: Passport.js, Passport-Local, Express-Session, Connect-Flash
- **Validation**: Joi schemas (backend form validations)
- **Frontend Components**: Bootstrap 5, Custom CSS3 Variables, Leaflet.js Maps, Tom-Select dropdown fields, FontAwesome icons

---

## 📁 Directory Structure

```text
├── config/             # Cloudinary configuration (cloudConfig.js)
├── controllers/        # Handcrafted business logic (listings, reviews, users, bookings)
├── init/               # DB initialization and geocode seeding scripts
├── models/             # Schema models (Listing, Review, User, Booking)
├── public/             
│   ├── css/            # Stylesheets (style.css, rating.css)
│   └── js/             # Scripts (script.js, map.js)
├── routes/             # Express routes (listing.js, review.js, user.js, bookings.js)
├── utils/              # Helper utilities (wrapAsync.js, ExpressError.js, categories.js)
├── views/              # EJS template folders
│   ├── bookings/       # Booking forms and receipt screens
│   ├── includes/       # Layout chunks (navbar.ejs, footer.ejs, flash.ejs)
│   ├── layouts/        # Base EJS layout boilerplate
│   ├── listings/       # Property forms, details, landing, and search templates
│   └── users/          # Authentication templates (login, signup)
├── app.js              # Server entry point
├── schema.js           # Validation schemas
└── middleware.js       # Authentication & security middlewares
```

---

## 🏁 Getting Started

### 📋 Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en) (v16.0 or higher)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) (running locally on port `27017`)

### ⚙️ Installation
1. Clone the project repository and open it in your terminal.
2. Install the project dependencies:
   ```bash
   npm install
   ```

### 🗄️ Database Seeding
Initialize and seed the MongoDB database with sample properties:
```bash
node init/index.js
```

### 🔑 Environment Variables
Create a `.env` file in the root directory and configure the variables required for Cloudinary uploads:
```env
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
```

### 🛰️ Running the Application
Start the Node server:
```bash
node app.js
```
The application will start, connect to MongoDB, and listen on:
[http://localhost:8080](http://localhost:8080)
