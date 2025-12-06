import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import CreateEvent from './pages/CreateEvent';
import Login from './pages/Login';
import Profile from './pages/Profile'; // Din privata profil
import PublicProfile from './pages/PublicProfile'; // <--- NY: Importera den publika profilen
import Chat from './pages/Chat';
import MigrationTool from './pages/MigrationTool';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/event/:id" element={<EventDetails />} />
      <Route path="/create" element={<CreateEvent />} />
      <Route path="/login" element={<Login />} />
      
      {/* Mina sidor (Privat) */}
      <Route path="/profile" element={<Profile />} /> 
      
      {/* Annan användare (Publik) - T.ex. /profile/ABC-123 */}
      <Route path="/profile/:uid" element={<PublicProfile />} /> 
      <Route path="/admin-fix" element={<MigrationTool />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;