// src/api/images.js
import axios from "axios"
import { BACKEND_BASE_URL } from "../config"

/**
 * Profiilikuvan lataus:
 * Lähetä kuva endpointiin ja palauta objekti, jossa uusi profilePicture-URL
 */
export const uploadAvatar = async (userId, file) => {
  const formData = new FormData()
  formData.append("profilePhoto", file)

  const token = localStorage.getItem("token")
  if (!token) throw new Error("Kirjaudu sisään tallentaaksesi profiilikuvan")

  try {
    const { data } = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-avatar`,
      formData,
      { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
    )
    // Palautetaan objektina, jotta caller saa myös muut mahdolliset kentät
    return { profilePicture: data.profilePicture }
  } catch (err) {
    console.error("uploadAvatar error:", err.response || err)
    const msg = err.response?.data?.error || "Avatarin tallennus epäonnistui"
    throw new Error(msg)
  }
}

/**
 * Lisäkuvien lataus (bulk-upload):
 * Palauttaa objektin { extraImages: string[] }
 */
export const uploadPhotos = async (userId, filesOrFormData) => {
  const formData =
    filesOrFormData instanceof FormData
      ? filesOrFormData
      : (() => {
          const fd = new FormData()
          filesOrFormData.forEach((file) => fd.append("photos", file))
          return fd
        })()

  const token = localStorage.getItem("token")
  if (!token) throw new Error("Kirjaudu sisään tallentaaksesi lisäkuvia")

  try {
    const { data } = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photos`,
      formData,
      { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
    )
    // Palautetaan aina objektina, ei pelkkä array
    return { extraImages: data.extraImages }
  } catch (err) {
    console.error("uploadPhotos error:", err.response || err)
    const errorMsg = err.response?.data?.error || "Lisäkuvien tallennus epäonnistui"
    throw new Error(errorMsg)
  }
}

/**
 * Yksittäisen kuvan vaiheittainen lataus (crop + caption + slot)
 * Palauttaa objektin { extraImages: string[] }
 */
export const uploadPhotoStep = async (userId, formData) => {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Kirjaudu sisään tallentaaksesi kuvan")

  try {
    const { data } = await axios.post(
      `${BACKEND_BASE_URL}/api/users/${userId}/upload-photo-step`,
      formData,
      { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
    )
    return { extraImages: data.extraImages }
  } catch (err) {
    console.error("uploadPhotoStep error:", err.response || err)
    const msg = err.response?.data?.error || "Kuvan tallennus epäonnistui"
    throw new Error(msg)
  }
}

/**
 * Poistaa kuvan tietyltä slotilta ja palauttaa objektin { extraImages: string[] }
 */
export const deletePhotoSlot = async (userId, slot) => {
  const token = localStorage.getItem("token")
  if (!token) throw new Error("Kirjaudu sisään poistaaksesi kuvan")

  try {
    const { data } = await axios.delete(
      `${BACKEND_BASE_URL}/api/users/${userId}/photos/${slot}`,
      { headers: { Authorization: `Bearer ${token}` }, withCredentials: true }
    )
    return { extraImages: data.extraImages }
  } catch (err) {
    console.error("deletePhotoSlot error:", err.response || err)
    const msg = err.response?.data?.error || "Kuvan poisto epäonnistui"
    throw new Error(msg)
  }
}
