// src/pages/ExtraPhotosPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MultiStepPhotoUploader from '../components/profileFields/MultiStepPhotoUploader';
import { uploadAvatar } from '../api/images';
import { BACKEND_BASE_URL } from '../config';

/**
 * PhotosPage: separate page for managing profile images
 * Näyttää avatarin ja extra-kuvat 0–6 (free) tai 0–20 (premium) erikseen
 */
export default function ExtraPhotosPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const navigate = useNavigate();
  const { userId: paramId } = useParams();
  const [user, setUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState(null);

  const userId = paramId || authUser?._id;
  const isOwner = !paramId || authUser?._id === paramId;

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const url = `${BACKEND_BASE_URL}/api/auth/me`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const u = res.data.user || res.data;
      setUser(u);
      // set avatar preview
      if (u.profilePicture) {
        setAvatarPreview(
          u.profilePicture.startsWith('http')
            ? u.profilePicture
            : `${BACKEND_BASE_URL}${u.profilePicture}`
        );
      }
    } catch (err) {
      console.error('Käyttäjän haku epäonnistui:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUserUpdate = (updated) => {
    setUser(updated);
    if (!paramId) setAuthUser(updated);
    // update avatar preview if changed
    if (updated.profilePicture) {
      setAvatarPreview(
        updated.profilePicture.startsWith('http')
          ? updated.profilePicture
          : `${BACKEND_BASE_URL}${updated.profilePicture}`
      );
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSubmit = async (e) => {
    e.preventDefault();
    if (!avatarFile || !userId) return;
    setAvatarError(null);
    try {
      const updated = await uploadAvatar(userId, avatarFile);
      handleUserUpdate({ ...user, profilePicture: updated.profilePicture });
    } catch (err) {
      setAvatarError(err.message || 'Avatarin tallennus epäonnistui');
    }
  };

  if (!user) return <div className="text-center mt-12">Ladataan kuvia…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Photos</h1>

      {/* Avatar section */}
      {isOwner && (
        <form onSubmit={handleAvatarSubmit} className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-avatar.png';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">?</span>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="block"
            data-cy="ExtraPhotosPage__avatarInput"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            data-cy="ExtraPhotosPage__avatarSaveButton"
          >
            Tallenna pääkuva
          </button>
          {avatarError && <p className="text-red-600">{avatarError}</p>}
        </form>
      )}

      {/* Extra photos uploader or gallery */}
      {isOwner ? (
        <MultiStepPhotoUploader
          userId={userId}
          isPremium={user.isPremium}
          extraImages={user.extraImages || []}
          onSuccess={(res) => handleUserUpdate({ ...user, extraImages: res.extraImages })}
          onError={(err) => console.error('Uploader error:', err)}
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(user.extraImages || []).map((src, i) => (
            <img
              key={i}
              src={src.startsWith('http') ? src : `${BACKEND_BASE_URL}${src}`}
              alt={`Extra ${i + 1}`}
              className="object-cover w-full h-32 rounded"
            />
          ))}
        </div>
      )}

      <button
        onClick={() => navigate(-1)}
        className="mt-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        Takaisin profiiliin
      </button>
    </div>
  );
}
