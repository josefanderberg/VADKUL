# VADKUL

VADKUL is a spontaneous social event application built with modern web technologies. It allows users to create, view, and join events on a map or list, fostering real-time social interactions.

🌐 **Live Demo:** [vadkul.se](https://vadkul.se)

## 🚀 Features

- **Interactive Map & List Views**: Browse events geographically or in a list format.
- **Real-time Updates**: Functionality powered by Firebase for instant data synchronization.
- **Event Management**: Create, join, and manage social events easily.
- **Categorized Filtering**: Filter events by category to find what interests you.
- **Geolocation Support**: Find valid events near you.
- **Dark Mode**: Built-in dark mode support using Tailwind CSS.
- **Responsive Design**: optimized for both desktop and mobile use.

## 🛠️ Tech Stack

- **Framework**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (via [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
- **Maps**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Utilities**: `date-fns`, `clsx`, `tailwind-merge`

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/josefanderberg/vadkul.git
    cd vadkul
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory (based on `.env.example` if available) and add your Firebase configuration keys:
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

## 📜 Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run preview`: Previews the production build locally.

## 📂 Project Structure

```plaintext
src/
├── components/      # Reusable UI components
│   ├── layout/      # Layout components (Navbar, etc.)
│   └── ui/          # Generic UI elements (EventCard, Buttons)
├── context/         # React Context (Auth, Theme)
├── lib/             # Third-party library configs (Firebase)
├── pages/           # Application views/routes
├── services/        # API and business logic handling
├── types/           # TypeScript interface definitions
└── utils/           # Helper functions
```

## 🤝 Contributing

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
