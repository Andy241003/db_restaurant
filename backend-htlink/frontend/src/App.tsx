// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
// MainLayout & DashboardSelection - removed for restaurant-only app
// import MainLayout from './layouts/MainLayout';
// import DashboardSelection from './pages/DashboardSelection';
import Login from './pages/Login';

// Admin imports
import AdminLayout from './pages/admin/AdminLayout';

// Shared imports
import SharedSettingsLayout from './layouts/SharedSettingsLayout';
import Media from './pages/Media';

// VR Hotel imports removed for restaurant-only app
// import VRHotelActivities from './pages/vr-hotel/Activities';
// import VRHotelContact from './pages/vr-hotel/Contact';
// ... (all VR Hotel imports removed)

// Travel Link imports removed for restaurant-only app
// import MainLayout from './layouts/MainLayout';
// import DashboardSelection from './pages/DashboardSelection';

// Restaurant imports
import RestaurantActivities from './pages/restaurant/Activities';
import RestaurantAchievements from './pages/restaurant/Achievements';
import RestaurantBranches from './pages/restaurant/Branches';
import RestaurantCareers from './pages/restaurant/Careers';
import RestaurantContact from './pages/restaurant/Contact';
import RestaurantDashboard from './pages/restaurant/Dashboard';
import RestaurantEvents from './pages/restaurant/Events';
import RestaurantGallery from './pages/restaurant/Gallery';
import RestaurantAbout from './pages/restaurant/About';
import RestaurantHome from './pages/restaurant/Home';
import RestaurantLanguages from './pages/restaurant/Languages';
import RestaurantLayout from './pages/restaurant/RestaurantLayout';
import RestaurantMenu from './pages/restaurant/Menu';
import RestaurantPromotions from './pages/restaurant/Promotions';
import RestaurantSettings from './pages/restaurant/Settings';
import RestaurantSpace from './pages/restaurant/Space';
import RestaurantUsers from './pages/restaurant/Users';
import RestaurantTenants from './pages/restaurant/Tenants';
import { autoDetectLanguage } from './utils/languageDetection';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  // Direct localStorage check, bypass useAuth hook
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem('access_token');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    return !!(token && isAuth);
  });

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('access_token');
      const isAuth = localStorage.getItem('isAuthenticated') === 'true';
      const newState = !!(token && isAuth);
      
      setIsAuthenticated((prev) => (prev === newState ? prev : newState));
    };

    // Check immediately
    checkAuth();

    // Listen for storage events
    const handleStorageChange = () => {
      checkAuth();
    };

    // Listen for custom auth events
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authStateChanged', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
    };
  }, []);

  // Auto-detect browser language on app mount
  useEffect(() => {
    // Only run if user is authenticated
    if (isAuthenticated) {
      autoDetectLanguage().catch(error => {
        console.error('Failed to auto-detect language:', error);
      });
    }
  }, [isAuthenticated]); // Run when auth state changes

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Dashboard selection removed for restaurant-only app */}
            {/* <Route path="/dashboard-selection" element={...} /> */}
            
            {/* Core Admin Routes - Super Admin only */}
            <Route 
              path="/admin/*" 
              element={
                isAuthenticated ? (
                  <ProtectedRoute requireOwner>
                    <AdminLayout />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* Shared Settings Route - Accessible by all authenticated users */}
            <Route 
              path="/settings" 
              element={
                isAuthenticated ? (
                  <SharedSettingsLayout />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* VR Hotel routes removed for restaurant-only app */}
            {/* <Route path="/vr-hotel/*" element={...} /> */}

            {/* Restaurant Routes */}
            <Route 
              path="/restaurant/*" 
              element={
                isAuthenticated ? (
                  <ProtectedRoute>
                    <Routes>
                      <Route element={<RestaurantLayout />}>
                        <Route path="" element={<RestaurantDashboard />} />
                        <Route path="activities" element={<RestaurantActivities />} />
                        <Route path="users" element={<RestaurantUsers />} />
                        <Route path="tenants" element={<ProtectedRoute requireAdmin><RestaurantTenants /></ProtectedRoute>} />
                        <Route path="home" element={<RestaurantHome />} />
                        <Route path="about" element={<RestaurantAbout />} />
                        <Route path="menu" element={<RestaurantMenu />} />
                        <Route path="space" element={<RestaurantSpace />} />
                        <Route path="branches" element={<RestaurantBranches />} />
                        <Route path="events" element={<RestaurantEvents />} />
                        <Route path="careers" element={<RestaurantCareers />} />
                        <Route path="promotions" element={<RestaurantPromotions />} />
                        <Route path="achievements" element={<RestaurantAchievements />} />
                        <Route path="gallery" element={<RestaurantGallery />} />
                        <Route path="media" element={<Media defaultSource="restaurant" />} />
                        <Route path="contact" element={<RestaurantContact />} />
                        <Route path="languages" element={<RestaurantLanguages />} />
                        <Route path="settings" element={<RestaurantSettings />} />
                      </Route>
                    </Routes>
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />

            {/* Travel Link routes removed for restaurant-only app */}
            {/* Default route: redirect to Restaurant */}
            <Route 
              path="/" 
              element={isAuthenticated ? <Navigate to="/restaurant" replace /> : <Navigate to="/login" replace />} 
            />
            <Route path="/*" element={<Navigate to="/restaurant" replace />} />
          </Routes>
        </div>
      </Router>
      {/* Modern Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;



