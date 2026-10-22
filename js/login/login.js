import { app } from "../firebase/config.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup,
    onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.querySelector("#login-btn");
    const logoutBtn = document.querySelector("#logout-btn");
    const avatar = document.querySelector("#user-avatar");

    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            signInWithPopup(auth, provider)
                .then(async (result) => {
                    const user = result.user;
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        // User does not exist in Firestore — log them out and show error
                        await signOut(auth);
                        loginError.textContent = "User doesn't exist, sign up first";
                        loginError.style.display = "block";
                        return;
                    }

                    // User exists, update last login
                    await setDoc(userRef, {
                        lastLogin: new Date()
                    }, { merge: true });

                    window.location.href = "index.html";
                })
                .catch(err => {
                    console.warn("[non-critical failure]", err);
                });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            signOut(auth).then(() => window.location.href = "login.html");
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is logged in
        } else {
            // User is logged out
        }
    });
});

const emailForm = document.querySelector("#email-login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginError = document.querySelector("#login-error");

if (emailForm) {
    emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const user = result.user;
            // Optional: store user data in Firestore
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                email: user.email,
                lastLogin: new Date()
            }, { merge: true });

            window.location.href = "index.html"; // Redirect on success
        } catch (err) {
            if (err.message == "Firebase: Error (auth/invalid-credential).") {
                err.message = "Wrong Credentials";
            }
            loginError.textContent = err.message;
            loginError.style.display = "block";
        }
    });
}

const forgotPasswordLink = document.querySelector("#forgot-password-link");
const loginInfo = document.querySelector("#login-info");

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (e) => {
        e.preventDefault();
        loginError.style.display = "none";
        loginInfo.style.display = "none";

        const email = emailInput.value.trim();
        if (!email) {
            loginError.textContent = "Enter your email address above first, then click 'Forgot your password?'";
            loginError.style.display = "block";
            emailInput.focus();
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
        } catch (err) {
            if (err.code === "auth/invalid-email") {
                loginError.textContent = "That doesn't look like a valid email address.";
                loginError.style.display = "block";
                return;
            }
            if (err.code === "auth/too-many-requests") {
                loginError.textContent = "Too many attempts. Please try again later.";
                loginError.style.display = "block";
                return;
            }
            // Any other error (including user-not-found) gets the same neutral
            // message below so the form doesn't reveal which emails have accounts.
            console.warn("[non-critical failure]", err);
        }

        loginInfo.textContent = "If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).";
        loginInfo.style.display = "block";
    });
}

export { auth, db };
