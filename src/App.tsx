import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Data from './pages/Data';
import Insights from './pages/Insights';
import Subscription from './pages/Subscription'; 
import Settings from './pages/Settings'; 
import Layout from './components/Layout'; 
import { Toaster } from 'sonner';
 
function App() {
  return (
    <Router>
      <Toaster position="top-right" richColors />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Dashboard Routes (Wrapped in Layout) */}
        <Route path="/dashboard" element={
          <Layout>
            <Dashboard />
          </Layout>
        } />
        <Route path="/data" element={
          <Layout>
            <Data />
          </Layout>
        } />
        <Route path="/insights" element={
          <Layout>
            <Insights />
          </Layout>
        } />
        <Route path="/subscription" element={
          <Layout>
            <Subscription />
          </Layout>
        } />
        <Route path="/settings" element={
          <Layout>
            <Settings />
          </Layout>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
