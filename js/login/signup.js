import { app } from "../firebase/config.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile, signInWithPopup, GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const signup = document.querySelector("#signup-btn");
    const signupForm = document.querySelector("#signup-form");
    const nameInput = document.querySelector("#name");
    const emailInput = document.querySelector("#email");
    const passwordInput = document.querySelector("#password");
    const signupError = document.querySelector("#signup-error");
    

  if (signup) {
        signup.addEventListener("click", () => {
            signInWithPopup(auth, provider)
                .then(async (result) => {
                    const user = result.user;
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);
                    const name = user.displayName;
                    const photoURL = user.photoURL;
                    const creationTime = user.metadata?.creationTime;
                    const email = user.email;
                    

                    // User exists, update last login
                    await setDoc(userRef, {
                        account: {
                            name: name,
                            email: email,
                            createdAt: creationTime,
                            lastLogin: new Date(),
                            photoURL: photoURL,
                            username: "Guest"
                        },
                        preferences: {
                            weightUnit: "kg",
                            measurementUnit: "cm"
                        },
                        onboarding: {
                            usernameSet: false,
                            unitsSet: false,
                            onboardingComplete: false
                        }
                    }, { merge: true });
                    const userData = userSnap.data();
                    if (userData && userData.usernameSet) {
                        window.location.href = "index.html";
                    } else {
                        window.location.href = "onboarding.html";
                    }
                   
                })
                .catch(console.error);
        });
    }

    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = nameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update display name
            await updateProfile(user, { displayName: name });

            // Store user in Firestore
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                account: {
                    name: name,
                    email: email,
                    createdAt: new Date(),
                    lastLogin: new Date(),
                    photoURL: "image/img.jpg",
                    username: "Guest"
                },
                preferences: {
                    weightUnit: "kg",
                    measurementUnit: "cm" 
                },
                onboarding: {
                    usernameSet: false,
                    unitsSet: false,
                    onboardingComplete: false
                }
            });

            // Fetch the user document to check usernameSet
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();
            if (userData && userData.usernameSet) {
                window.location.href = "index.html";
            } else {
                window.location.href = "onboarding.html";
            }
        } catch (err) {
            signupError.textContent = err.message;
            signupError.style.display = "block";
        }
    });
});
