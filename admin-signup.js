// [BAG-O] Kini nga file para lang sa admin signup logic.

const API_BASE = 'http://localhost:8000';
const buildApiUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById('signupForm');

  if (signupForm) {
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const formData = new FormData();

      const secretKey = document.getElementById('secret_key')?.value.trim();

      // [GI-DUGANG] I-validate sa frontend kung naay gisulod nga secret key.
      // Kini para malikayan ang pagpadala og request sa server kung daan nang sayop.
      if (!secretKey) {
        alert('Admin Secret Key is required to create an admin account.');
        return; // Hunongon ang pag-submit kung walay secret key.
      }

      // Kuhaon ang mga values gikan sa form
      formData.append('action', 'signup');
      formData.append('full_name', document.getElementById('fullname').value.trim());
      formData.append('username', document.getElementById('username').value.trim());
      formData.append('email', document.getElementById('email').value.trim());
      formData.append('password', document.getElementById('password').value.trim());
      formData.append('role', 'admin'); // I-hardcode ang role sa 'admin'
      // [GI-USAB] Gamiton ang variable nga naay sulod nga gi-trim na nga secret key.
      formData.append('secret_key', secretKey);

      try {
        const apiUrl = buildApiUrl('user');

        const res = await fetch(apiUrl, {
          method: "POST",
          body: formData,
          credentials: 'include'
        });

        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          if (result.status === "Success") {
            alert(`Account created successfully as admin!`);
            window.location.href = "admin-login.html"; // I-redirect sa admin login
          } else {
            alert("Signup failed: " + (result.message || "An unknown error occurred."));
          }
        } else {
          const errorText = await res.text();
          let errorMessage = `An error occurred (Status: ${res.status}).`;

          if (res.status === 409) {
            errorMessage = "The username or email you entered is already taken. Please choose a different one.";
          } else if (errorText) {
            try { errorMessage = JSON.parse(errorText).message; } catch (e) { console.error("Could not parse error response as JSON:", errorText); }
          }
          
          alert("Signup failed: " + errorMessage);
        }

      } catch (err) {
        console.error(err);
        alert("Network error: " + err.message + "\n\nCheck if the server/API is running and try again.");
      }
    });
  }

  // --- 👁️ Show/Hide Password & Secret Key Logic ---
  const showSecretKeyCheckbox = document.getElementById('showSecretKey');
  const secretKeyInput = document.getElementById('secret_key');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  if (showSecretKeyCheckbox && secretKeyInput) {
    showSecretKeyCheckbox.addEventListener('change', function() {
      secretKeyInput.type = this.checked ? 'text' : 'password';
    });
  }

  if (togglePasswordBtn && passwordInput) {
    const eyeIcon = togglePasswordBtn.querySelector('i');
    togglePasswordBtn.addEventListener('click', function() {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeIcon.classList.toggle('bi-eye-slash', !isPassword);
      eyeIcon.classList.toggle('bi-eye', isPassword);
    });
  }
});