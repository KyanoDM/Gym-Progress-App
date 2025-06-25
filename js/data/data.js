import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const weightInput = document.querySelector("#weight-input");
    const saveWeightBtn = document.querySelector("#save-weight-btn");
    const loginBtn = document.querySelector("#login-btn");
    const avatar = document.querySelector("#user-avatar");
    if (saveWeightBtn) {
        saveWeightBtn.addEventListener("click", async () => {
            
            const weight = parseFloat(weightInput.value);

            if (isNaN(weight) || weight <= 0) {
                alert("Please enter a valid weight");
                return;
            }

            const user = auth.currentUser;
            if (!user) {
                alert("You must be logged in to save your weight.");
                return;
            }

            const userRef = doc(db, "users", user.uid);
            try {
                await setDoc(userRef, { weight }, { merge: true });
                alert("Weight saved successfully!");
            } catch (err) {
                console.error(err);
                alert("Failed to save weight.");
            }
        });
    }
});
