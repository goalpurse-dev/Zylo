// src/routes/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowUnverified = true }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null; // or a spinner

  if (!user) {
    // keep where the user was trying to go
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  // optional: block users who haven’t verified email yet
  if (!allowUnverified && !user?.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}
