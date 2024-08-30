from flask import Flask, request, jsonify, send_file, render_template, redirect, url_for, session

from psycopg2 import connect, extras
from cryptography.fernet import Fernet, InvalidToken
import os
import secrets

app = Flask(__name__, static_url_path='/assets', static_folder='assets')

SECRET_KEY_FILE = 'secret_key.txt'

if not os.path.exists(SECRET_KEY_FILE):
    with open(SECRET_KEY_FILE, 'w') as f:
        f.write(secrets.token_urlsafe(32))

with open(SECRET_KEY_FILE, 'r') as f:
    app.secret_key = f.read().strip()


host = 'localhost'
port = 5432
dbname = 'postgres'
user = 'postgres'
password = '1234'

KEY_FILE = 'clave.key'

def get_connection():
    conn = connect(host=host, port=port, dbname=dbname, user=user, password=password)
    return conn

def generar_llave():
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as key_file:
        key_file.write(key)
    return key

def cargar_llave():
    if not os.path.exists(KEY_FILE):
        generar_llave()
    return open(KEY_FILE, "rb").read()

def encriptar_contrasena(contrasena, key):
    f = Fernet(key)
    contrasena_encriptada = f.encrypt(contrasena.encode('utf-8'))
    return contrasena_encriptada

def desencriptar_contrasena(contrasena_encriptada, key):
    f = Fernet(key)
    try:
        # Convertir de string hexadecimal a bytes
        contrasena_encriptada_bytes = bytes.fromhex(contrasena_encriptada[2:]) 
        contrasena_descifrada = f.decrypt(contrasena_encriptada_bytes).decode('utf-8')
    except InvalidToken:
        return None  # Devolver None en caso de error
    return contrasena_descifrada

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    correo = data.get('correo')
    contrasena = data.get('contrasena')

    # Validación en el Backend
    if not correo or not contrasena:
        return jsonify({'message': 'Por favor, ingrese su correo electrónico y contraseña.'}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        cur.execute('SELECT * FROM usuarios WHERE correo = %s', (correo,))
        user = cur.fetchone()

        if user:
            contrasena_almacenada = user['contrasena']
            print("Contraseña Almacenada (desde la BD):", contrasena_almacenada)  # Depuración
            key = cargar_llave()
            contrasena_descifrada = desencriptar_contrasena(contrasena_almacenada, key)
            print("Contraseña Descifrada:", contrasena_descifrada)  # Depuración
            print("Contraseña Ingresada:", contrasena) # Nueva línea para depuración
            if contrasena_descifrada and contrasena_descifrada.lower().strip() == contrasena.lower().strip():
                print("Contraseña correcta")
                session['correo'] = correo
                return jsonify({'message': 'Inicio de sesión exitoso'}), 200
            else:
                print("Contraseña incorrecta")
                return jsonify({'message': 'Contraseña incorrecta'}), 401
        else:
            return jsonify({'message': 'Usuario no encontrado'}), 404

    except Exception as e:
        return jsonify({'message': f'Error: {e}'}), 500

    finally:
        cur.close()
        conn.close()

def validar_correo(correo):
    import re
    regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    return re.fullmatch(regex, correo)


@app.post('/api/users')
def create_user():
    new_user = request.get_json()
    nombre_completo = new_user.get('nombre_completo')
    usuario = new_user.get('usuario')
    correo = new_user.get('correo')
    contrasena = new_user.get('contrasena') 

     # Validación en el backend
    if not nombre_completo or not usuario or not correo or not contrasena:
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    if not validar_correo(correo):
        return jsonify({'error': 'Ingrese un correo electrónico válido'}), 400

    key = cargar_llave()
    contrasena_encriptada = encriptar_contrasena(contrasena, key)  # Encriptar aquí

    conn = get_connection()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)

    try:
        # Verificar si el correo o usuario ya existen
        cur.execute('SELECT 1 FROM usuarios WHERE correo = %s OR usuario = %s', (correo, usuario))
        existing_user = cur.fetchone()

        if existing_user:
            return jsonify({'error': 'El correo electrónico o el nombre de usuario ya están registrados'}), 400

        # Insertar el nuevo usuario
        cur.execute(
            'INSERT INTO usuarios (nombre_completo, correo, usuario, contrasena) VALUES (%s, %s, %s, %s) RETURNING *',
            (nombre_completo, correo, usuario, contrasena_encriptada))
        new_created_user = cur.fetchone()
        conn.commit()

        return jsonify(new_created_user), 201  # 201 Created

    except Exception as e:
        return jsonify({'error': f'Error: {e}'}), 500

    finally:
        cur.close()
        conn.close()


@app.route('/farmabot')
def farmabot():
    if 'correo' in session: # Asegúrate de usar 'correo' si así lo defines en la sesión
        return render_template('ChatBot/farmabot.html') 
    return redirect(url_for('home'))

# ... other imports ...

@app.route('/api/check_session')
def check_session():
    if 'correo' in session:
        print("Sesión válida:", session)  # Mensaje de depuración
        return jsonify({'message': 'Sesión válida'}), 200
    else:
        print("Sesión no válida")  # Mensaje de depuración
        return jsonify({'message': 'Sesión no válida ingresa tus datos para iniciar sesión'}), 401

@app.route('/logout')
def logout():
    # Eliminar la sesión del usuario
    session.pop('correo', None)
    return redirect(url_for('home')) 

@app.route('/')
def home():
    return send_file('index_login_register.html')

if __name__ == '__main__':
    app.run(debug=True)