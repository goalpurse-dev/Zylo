// src/pages/CreateLauncher.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import FlowBrowser from "../components/video/FlowBrowser";

export default function CreateLauncher() {
  const navigate = useNavigate();

  return (
    <FlowBrowser
      open
      onClose={() => navigate(-1)}                 // close goes back
      onSubmit={({ navigateTo }) => {
        if (navigateTo) navigate(navigateTo);      // handle hard-redirect cards
      }}
    />
  );
}
