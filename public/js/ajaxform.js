document
.querySelectorAll("[data-ajax-form]")
.forEach((form)=>{

    form.addEventListener("submit",async(e)=>{

        e.preventDefault();
         console.log("Submit event fired");

        showLoader(

            form.dataset.loaderIcon,

            form.dataset.loaderTitle,

            form.dataset.loaderMessage

        );

        const formData = new FormData(form);

        try{

            const response = await fetch(

                form.action,

                {

                    method:form.method,

                    body:formData

                }

            );

            const data = await response.json();

            hideLoader();

            if(data.success){

                window.location.href=data.redirect;

            }

        }
        catch(err){

            hideLoader();

            console.log(err);

        }

    });

});