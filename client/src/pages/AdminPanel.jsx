// File: client/src/pages/AdminPanel.jsx

// --- REPLACE START: use centralized axios instance instead of raw axios ---
import axios from "../utils/axiosInstance";
// --- REPLACE END ---
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const AdminPanel = () => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [success, setSuccess] = useState("");

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setSuccess("❌ No file selected");
      return;
    }
    const formData = new FormData();
    formData.append("adImage", selectedFile);
    try {
      // withCredentials + Authorization come from axiosInstance config
      const res = await api.post("/api/ads/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess("✅ " + (res?.data?.message || "Upload successful"));
    } catch (err) {
      console.error(err);
      setSuccess("❌ Upload failed");
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">🖼️ {t("admin.uploadAdImage")}</h2>
      <input type="file" onChange={handleFileChange} className="mb-2" />
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {t("admin.upload")}
      </button>
      {success && <p className="mt-4">{success}</p>}
    </div>
  );
};

export default AdminPanel;
