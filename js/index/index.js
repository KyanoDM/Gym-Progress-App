import { auth } from "../login/login.js"; // Adjust path if needed
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const avatar = document.querySelector("#user-avatar");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if(user.photoURL) {
                avatar.src = user.photoURL;
            } else {
                avatar.src = "image/img.jpg";
            }
            
            avatar.classList.remove("d-none");
          
        } else {
            avatar.classList.add("d-none");
          
        }
    });
});
