
// [SAKTONG PAG-AYO] I-set ang API_BASE sa eksaktong URL sa imong PHP backend server.
// Kini ang mosulbad sa 405 (Method Not Allowed) error.
const API_BASE = 'http://localhost:8000';
const buildApiUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById('signupForm');

  // [BAG-O] I-handle ang Back-Forward Cache sa browser.
  // Kini ang mosiguro nga kung ang user mo-klik sa "Back" button, malimpyohan ang form.
  window.addEventListener('pageshow', (event) => {
    // Ang `event.persisted` mahimong `true` kung ang page gikuha gikan sa cache.
    if (event.persisted && signupForm) {
      console.log('[Cache] Page loaded from back-forward cache. Resetting form.');
      signupForm.reset(); // Limpyohan ang tanang fields sa form.
    }
  });

  if (signupForm) {
    // [GI-AYO] Gamiton ang 'submit' event sa form mismo.
    // Kini mas kasaligan kaysa 'click' sa button, ilabi na kung naay validation.
    const submitBtn = signupForm.querySelector('button[type="submit"]'); // [BAG-O] Kuhaon ang submit button

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Kanunay pugngan ang default submission para ang JS ang mo-handle.

      // [BAG-O] I-disable ang button ug magpakita og loading state
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing Up...`;

      // [GI-USAB] Gamit na ta og FormData para maka-handle og file uploads
      const formData = new FormData();

      // ✅ Get text values and append to FormData
      formData.append('action', 'signup');
      formData.append('full_name', document.getElementById('fullname').value.trim());
      formData.append('username', document.getElementById('username').value.trim());
      formData.append('email', document.getElementById('email').value.trim());
      formData.append('password', document.getElementById('password').value.trim());
      formData.append('phone', document.getElementById('phone')?.value.trim() || '');

      const role = document.getElementById('role').value;
      formData.append('role', role);

      // [BAG-O] I-check kung owner, dayun i-append ang mga files
      if (role === 'owner') {
        const idPictureFile = document.getElementById('idPicture').files[0];
        const businessPermit = document.getElementById('businessPermit').files[0];

        // [BAG-O NGA SEGURIDAD] I-validate sa frontend kung naay gipili nga files.
        if (!idPictureFile || !businessPermit) {
          alert('Please upload both your ID Picture and Business Permit to continue.');
          // [BAG-O] I-enable balik ang button kung naay error
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return; // Hunongon ang pag-submit kung kulang ang files.
        }

        if (idPictureFile) {
          formData.append('idPicture', idPictureFile);
        }
        if (businessPermit) {
          formData.append('businessPermit', businessPermit); // Sakto na ni, pabilinon lang
        }
      }

      try {
        // [GI-USAB] Himuong dinamiko ang API URL base sa role.
        // [SAKTONG PAG-AYO] I-point sa '/user' endpoint. Ang router na ang bahala mo-pasa sa UserController.
        const apiUrl = buildApiUrl('user');

        // [GI-USAB] Ipadala ang FormData. Dili na kinahanglan ang Content-Type header.
        // Ang browser na ang mo-set sa saktong 'multipart/form-data' boundary.
        const res = await fetch(apiUrl, {
          method: "POST",
          // headers: { "Content-Type": "application/json" }, // DILI NA NI NEED
          body: formData,
          credentials: 'include' // [BAG-O] Gidugang para masiguro ang saktong pag-handle sa request sa server.
        });

        // [GI-AYO] Mas lig-on nga error handling.
        // Susiha una kung ang tubag kay OK (status 200-299) ug kung JSON ba kini.
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          if (result.status === "Success") {
            // [GI-AYO] Ibutang ang redirection sa sulod sa alert para masiguro nga makita gyud sa user.
            // Ang browser mohulat nga i-close ang alert sa dili pa mo-redirect.
            // [BAG-O] Limpyohan ang form human sa malampuson nga pag-signup.
            signupForm.reset();
            // [GI-USAB] Gihimong usa na lang ang mensahe para sa tanang role.
            let successMessage = "Account created successfully! You will now be redirected to the login page.";
            if (role === 'owner') {
              successMessage = "Owner account created successfully! You can now log in and add your boarding house.";
            }

            alert(successMessage);
            window.location.href = "user-login.html"; 
            return; // [SAKTO] I-return para dili na mo-agi sa finally block kung successful ang signup.
          } else {
            // Kung ang status kay "Success" pero naay laing mensahe
            alert("Signup failed: " + (result.message || "An unknown error occurred."));
          }
        } else {
          // Kung ang tubag dili OK o dili JSON (e.g., 409 Conflict, 400 Bad Request, 500 Server Error)
          const errorText = await res.text(); // Kuhaon ang text sa error para makita
          let errorMessage = `An error occurred (Status: ${res.status}).`;

          if (res.status === 409) {
            errorMessage = "The username or email you entered is already taken. Please choose a different one.";
          } else if (errorText) {
            // Sulayan pagkuha ang error message gikan sa JSON kung mahimo
            try { errorMessage = JSON.parse(errorText).message; } catch (e) { console.error("Could not parse error response as JSON:", errorText); }
          }
          
          alert("Signup failed: " + errorMessage);
        }

      } catch (err) {
        console.error(err);
        alert("Network error: " + err.message + "\n\nCheck if the server/API is running and try again.");
      } finally {
        // [GI-AYO] I-enable lang balik ang button kung naay error.
        // Dili na ni modagan kung successful ang signup tungod sa 'return' sa sulod sa 'if (result.status === "Success")' block.
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  } // End of if(signupForm)

  // --- [GIBALHIN GIKAN SA HTML] Logic para sa pag-interact sa form fields ---
  const roleSelect = document.getElementById('role');
  const ownerFields = document.getElementById('ownerFields');
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  // Ipakita/itago ang mga field para sa owner base sa role
  // [GI-TANGTANG] Dili na kinahanglan ang logic para sa roleSelect 'change' event
  // kay lahi na ang signup form sa owner ug tenant.

  // Show/Hide Password Logic
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