document.getElementById("btn__iniciar-sesion").addEventListener("click", iniciarSesion);
document.getElementById("btn__registrarse").addEventListener("click", register);
window.addEventListener("resize", anchoPagina);

//Declaración de variables
var contenedor_login_register = document.querySelector(".contenedor__login-register");
var formulario_login = document.querySelector(".formulario__login");
var formulario_register = document.querySelector(".formulario__register");
console.log(formulario_register);
var caja_trasera_login = document.querySelector(".caja__trasera-login");
var caja_trasera_register = document.querySelector(".caja__trasera-register");

function registrarUsuario() {
    // Obtener los valores de los inputs
    var nombreCompleto = document.getElementById("nombre_completo").value;
    var correo = document.getElementById("correo").value;
    var usuario = document.getElementById("usuario").value;
    var contrasena = document.getElementById("contrasena").value;

    // Crear un objeto JSON con los datos
    var data = {
        "nombre_completo": nombreCompleto,
        "correo": correo,
        "usuario": usuario,
        "contrasena": contrasena
    };

    // Enviar los datos al servidor usando fetch
    fetch('/api/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) { 
            throw new Error('Error en el registro. Por favor, intenta de nuevo.');
        }
        return response.json(); 
    })
    .then(data => {
        // Mostrar un mensaje de éxito
        alert("Usuario registrado exitosamente. ¡Bienvenido!"); 

        // Limpiar los inputs
        document.getElementById("nombre_completo").value = "";
        document.getElementById("correo").value = "";
        document.getElementById("usuario").value = "";
        document.getElementById("contrasena").value = "";

        // Cambiar a la función iniciarSesion()
        iniciarSesion();
    })
    .catch((error) => {
        console.error('Error:', error);
        // Mostrar un mensaje de error al usuario
        alert(error.message || 'Hubo un error al registrar el usuario.'); 
    });
}


function anchoPagina(){
    if(window.innerWidth > 850){
        caja_trasera_login.style.display = "block";
        caja_trasera_register.style.display = "block";
    }else{
        caja_trasera_register.style.display = "block";
        caja_trasera_register.style.opacity = "1";
        caja_trasera_login.style.display = "none";
        formulario_login.style.display = "block";
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "0px";
    }
}

anchoPagina();

function iniciarSesion(){
    if (window.innerWidth > 850) {
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "10px";
        formulario_login.style.display = "block";
        caja_trasera_register.style.opacity = "1";
        caja_trasera_login.style.opacity = "0";
    } else {
        formulario_register.style.display = "none";
        contenedor_login_register.style.left = "0px";
        formulario_login.style.display = "block";
        caja_trasera_register.style.display = "block";
        caja_trasera_login.style.display = "none";
    }
    
}

function register(){
    if(window.innerWidth > 850){
        formulario_register.style.display = "block";
        contenedor_login_register.style.left = "410px";
        formulario_login.style.display = "none";
        caja_trasera_register.style.opacity = "0";
        caja_trasera_login.style.opacity = "1";
    }else{
        formulario_register.style.display = "block";
        contenedor_login_register.style.left = "0px";
        formulario_login.style.display = "none";
        caja_trasera_register.style.display = "none";
        caja_trasera_login.style.display = "block";
        caja_trasera_login.style.opacity = "1";
    }
    
}