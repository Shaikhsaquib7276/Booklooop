const toggle=document.querySelector("#themeToggle");

const savedTheme=localStorage.getItem("theme");

if(savedTheme==="dark"){

    document.body.classList.add("dark");

    toggle.innerHTML='<i class="bi bi-sun-fill"></i>';

}

toggle.addEventListener("click",()=>{

    document.body.classList.toggle("dark");

    if(document.body.classList.contains("dark")){

        localStorage.setItem("theme","dark");

        toggle.innerHTML='<i class="bi bi-sun-fill"></i>';

    }

    else{

        localStorage.setItem("theme","light");

        toggle.innerHTML='<i class="bi bi-moon-stars-fill"></i>';

    }

});