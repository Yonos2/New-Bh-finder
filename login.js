// 🧠 [GI-AYO] Gi-simplify ang API_BASE para malikayan ang dobleng endpoint (e.g., /admin/admin)
const API_BASE = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  // Kanunay gamiton ang root URL para malikayan ang kalibog. Ang endpoint idugang sa buildUrl.
  return 'http://localhost:8000';
})();

const buildUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;
const buildPageUrl = (path = '') => {
  // 🧠 [GI-AYO] Sigurohon nga kanunay saktong URL ang ma-generate para sa redirection.
  return `${API_BASE}/${path.replace(/^\//, '')}`;
};

document.addEventListener("DOMContentLoaded", () => {
  // ... rest of the login form handling
  const userForm = document.getElementById('userLoginForm');
  const tenantForm = document.getElementById('tenantLoginForm'); // Para sa tenant-login.html
  
  // Function to display error messages below the form
  const displayErrorMessage = (formEl, message) => {
    let errorDiv = formEl.querySelector('.login-error-message');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger mt-3 login-error-message';
      formEl.insertBefore(errorDiv, formEl.firstChild);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  };

  // Function to clear error messages
  const clearErrorMessages = (formEl) => {
    const errorDiv = formEl.querySelector('.login-error-message');
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }
  };

  /**
   * Generic login handler para sa bisan unsa nga login form.
   * @param {HTMLFormElement | null} formEl Ang form element.
   * @param {string} apiEndpoint Ang API endpoint nga padalhan (e.g., 'user' o 'admin').
   */
  const attachLoginHandler = (formEl, apiEndpoint) => {
    if (!formEl) return; // Kung walay form, ayaw padagana

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrorMessages(formEl); // Clear previous errors on new submission

      const usernameInput = formEl.querySelector('#username');
      const passwordInput = formEl.querySelector('#password');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      if (!username || !password) {
        displayErrorMessage(formEl, 'Username and password are required.');
        return;
      }

      // [GI-AYO] I-apil ang role sa data nga ipadala
      const data = { action: 'login', username, password };
      // 🧠 [GI-AYO] Sigurohon nga ang URL sakto ang pagka-construct.
      // Ang `apiEndpoint` kay 'user' o 'admin', nga mao na ang saktong path.
      const API_URL = buildUrl(apiEndpoint);

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        const result = await res.json();
        console.log(`[login.js] API response:`, result);
        console.log(`[login.js] Checking result.status: ${result.status}, result.user:`, result.user);

        if (result.status === "Success" && result.user) {
          // [GI-USAB] Gigamit ang sessionStorage para awtomatikong ma-delete ang data inig close sa browser.
          sessionStorage.setItem("currentUser", JSON.stringify(result.user));
          const role = result.user.role;
          console.log(`[login.js - attachLoginHandler] Login successful. API Result:`, result);
          console.log(`[login.js - attachLoginHandler] User role for redirection: ${role}`);

          // I-redirect base sa role
          switch (role) {
            case 'owner':
              window.location.href = buildPageUrl('owner-dashboard.html');
              break;
            case 'tenant':
              window.location.href = buildPageUrl('tenant-dashboard.html');
              break;
            default: // Fallback para sa mga user nga walay role
              window.location.href = buildPageUrl('index.html');
          }
        } else {
          displayErrorMessage(formEl, "Login failed: " + (result.message || 'Invalid credentials'));
        }
      } catch (err) {
        console.error("Login Error:", err);
        displayErrorMessage(formEl, "Network error: Failed to fetch. Please check if the server/API is running and try again.");
      }
    });
  };

  // I-attach ang mga handlers sa saktong forms
  attachLoginHandler(userForm, 'user');   // Para sa user-login.html (owner/tenant)
  attachLoginHandler(tenantForm, 'user'); // Para sa tenant-login.html (tenant)

  // ---  [BAG-O] Show/Hide Password Logic para sa tanang login forms ---
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  // I-run lang ni kung naa ang 'togglePassword' button sa page
  if (togglePassword && passwordInput) {
    const eyeIcon = togglePassword.querySelector('i');

    togglePassword.addEventListener('click', function() {
      // Susiha kung ang type kay 'password' ba
      const isPassword = passwordInput.type === 'password';

      // I-ilis ang type sa input
      passwordInput.type = isPassword ? 'text' : 'password';

      // I-ilis ang icon base sa state
      eyeIcon.classList.remove(isPassword ? 'bi-eye-slash' : 'bi-eye');
      eyeIcon.classList.add(isPassword ? 'bi-eye' : 'bi-eye-slash');
    });
  }
});