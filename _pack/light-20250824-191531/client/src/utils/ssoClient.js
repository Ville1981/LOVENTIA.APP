// SSO Client Utilities (Client-side)

export function initiateSSOLogin() {
  window.location.href = "/auth/sso/login";
}

export function handleSSOCallback(queryParams) {
  // Parse tokens or session info from server response
  const { token } = queryParams;
  if (token) {
    localStorage.setItem("authToken", token);
    return true;
  }
  return false;
}

export function logout() {
  localStorage.removeItem("authToken");
  window.location.href = "/logout";
}
