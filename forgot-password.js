// [GI-AYO] I-align ang API_BASE sa signup.js para consistent ug malikayan ang configuration issues.
const API_BASE = 'http://localhost:8000';
const buildUrl = (path = '') => `${API_BASE}/${path.replace(/^\//, '')}`;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const verificationStep = document.getElementById('verificationStep');
    const resetStep = document.getElementById('resetStep');
    const verifyBtn = document.getElementById('verifyBtn');
    const resetBtn = document.getElementById('resetBtn');

    // [BAG-O] Helper function para sa Show/Hide Password toggle
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                btn.innerHTML = isPass ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
            });
        }
    };
    setupToggle('toggleNewPass', 'newPassword');
    setupToggle('toggleConfirmPass', 'confirmPassword');

    // Step 1: Verify Identity
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!username || !email) {
            alert("Please enter both username and email.");
            return;
        }

        const originalText = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Verifying...`;

        try {
            // [GI-AYO] Mas klaro nga URL construction
            const apiUrl = buildUrl('user');
            console.log("Attempting to verify user at:", apiUrl);

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // [BAG-O] Explicitly tell server we want JSON
                },
                body: JSON.stringify({ action: 'verify_reset', username, email }),
                credentials: 'include'
            });

            // [GI-AYO] Susiha kung JSON ba ang response sa dili pa i-parse
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const result = await res.json();
                console.log("Server response:", result);

                if (res.ok && result.status === 'Success') {
                    // Malampuson! Ipakita ang sunod nga step.
                    verificationStep.classList.add('d-none');
                    resetStep.classList.remove('d-none');
                } else {
                    alert(result.message || "Verification failed. Please check your username and email.");
                }
            } else {
                // Kung dili JSON (e.g., HTML error page gikan sa server)
                const text = await res.text();
                console.error("Server returned non-JSON response:", text);
                alert("Server Error: The server returned an unexpected response. Check console (F12) for details.");
            }
        } catch (err) {
            console.error("Forgot Password Error:", err);
            console.error(err);
            alert("Network error or server is unreachable. Please try again.");
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalText;
        }
    });

    // Step 2: Reset Password
    resetBtn.addEventListener('click', async () => {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword.length < 6) {
            alert("Password must be at least 6 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        resetBtn.disabled = true;
        resetBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Resetting...`;

        try {
            const apiUrl = buildUrl('user');
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ action: 'reset_password', new_password: newPassword }),
                credentials: 'include'
            });

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const result = await res.json();
                if (res.ok && result.status === 'Success') {
                    alert("Password reset successfully! You can now login.");
                    window.location.href = 'user-login.html';
                } else {
                    alert(result.message || "Failed to reset password.");
                    resetBtn.disabled = false;
                    resetBtn.innerHTML = "Reset Password";
                }
            } else {
                const text = await res.text();
                console.error("Reset Password Error (Non-JSON):", text);
                alert("An error occurred while resetting password.");
                resetBtn.disabled = false;
                resetBtn.innerHTML = "Reset Password";
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred.");
            resetBtn.disabled = false;
            resetBtn.innerHTML = "Reset Password";
        }
    });
});