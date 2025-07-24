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
                    const isVerified = false;
                    const isAdmin = false;
                    const isOwner = false;
                    const email = user.email;

                    if (!userSnap.exists()) {
                        // New user → set default data
                        await setDoc(userRef, {
                            account: {
                                name,
                                email,
                                createdAt: creationTime,
                                lastLogin: new Date(),
                                photoURL,
                                username: "Guest",
                                isVerified,
                                isAdmin,
                                isOwner,
                                isVerified: false,
                                isAdmin: false,
                                isOwner: false
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
                    } else {
                        // Existing user → only update login time
                        await setDoc(userRef, {
                            account: {
                                lastLogin: new Date()
                            }
                        }, { merge: true });
                    }

                    // Always re-fetch to get the latest data
                    const updatedSnap = await getDoc(userRef);
                    const userData = updatedSnap.data();

                    if (userData?.onboarding?.onboardingComplete) {
                        window.location.href = "index.html";
                    } else {
                        window.location.href = "onboarding.html";
                    }
                })
                .catch(err => {
                    // Silent error handling
                });

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
            await updateProfile(user, {
                displayName: name,
                photoURL: "Image/img.jpg"
            });


            // Store user in Firestore
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                account: {
                    name: name,
                    email: email,
                    createdAt: new Date(),
                    lastLogin: new Date(),
                    photoURL: "Image/img.jpg",
                    username: "Guest",
                    isVerified: false,
                    isAdmin: false,
                    isOwner: false
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
            if (userData && userData.onboardingComplete) {
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
