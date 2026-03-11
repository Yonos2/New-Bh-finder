// c:\Users\User\Jayson\Documents\BH_Finder\public\admin-login.js

// [BAG-O] Kini nga file para lang sa admin login logic.

// I-set ang API_BASE sa eksaktong URL sa imong PHP backend server.
const API_BASE = 'http://localhost:8000';
const buildUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;
const buildPageUrl = (path = '') => {
  // Sigurohon nga kanunay saktong URL ang ma-generate para sa redirection.
  return `${API_BASE}/${path.replace(/^\//, '')}`;
};

document.addEventListener("DOMContentLoaded", () => {
  const adminLoginForm = document.getElementById('adminLoginForm');

  // Function to display error messages below the form
  const displayErrorMessage = (formEl, message) => {
    let errorDiv = formEl.querySelector('.login-error-message');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger mt-3 login-error-message';
      // Ibutang ang error message sa dili pa ang unang input field
      formEl.insertBefore(errorDiv, formEl.firstElementChild);
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

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrorMessages(adminLoginForm); // Limpyohan ang daan nga errors

      const usernameInput = adminLoginForm.querySelector('#username');
      const passwordInput = adminLoginForm.querySelector('#password');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      if (!username || !password) {
        displayErrorMessage(adminLoginForm, 'Username and password are required.');
        return;
      }

      const data = { action: 'login', username, password };
      const API_URL = buildUrl('admin'); // Ang endpoint para sa admin login

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: 'include'
        });

        const result = await res.json();
        console.log(`[admin-login.js] API response:`, result);

        if (result.status === "Success" && result.user && result.user.role === 'admin') {
          // [GI-USAB] Gigamit ang sessionStorage para awtomatikong ma-delete ang data inig close sa browser.
          sessionStorage.setItem("currentUser", JSON.stringify(result.user));
          console.log(`[admin-login.js] Admin login successful. Redirecting to admin dashboard.`);
          window.location.href = buildPageUrl('admin-dashboard.html');
        } else {
          displayErrorMessage(adminLoginForm, "Login failed: " + (result.message || 'Invalid credentials or not an admin account.'));
        }
      } catch (err) {
        console.error("Admin Login Error:", err);
        displayErrorMessage(adminLoginForm, "Network error: Failed to fetch. Please check if the server/API is running and try again.");
      }
    });
  }

  // --- Show/Hide Password Logic ---
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  if (togglePassword && passwordInput) {
    const eyeIcon = togglePassword.querySelector('i');

    togglePassword.addEventListener('click', function() {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeIcon.classList.toggle('bi-eye-slash', !isPassword);
      eyeIcon.classList.toggle('bi-eye', isPassword);
    });
  }
});