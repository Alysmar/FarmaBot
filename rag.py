# Importa las bibliotecas necesarias
import re
import chromadb as chroma
import PyPDF2
import nltk
import spacy
import json
from nltk.tokenize import sent_tokenize
from nltk.stem import WordNetLemmatizer


#Descomentar estos imports la primera vez que se ejecute el proyeto. Luego comentar nuevamente
#nltk.download('punkt_tab')
#nltk.download('punkt')
#nltk.download('wordnet')


#Lista de documentos PDF y TXT
documents = [
    "documentos/Enfermedades-Del-Sistema-Cardiovascular-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Respiratorio-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Digestivo-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Endocrino-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Renal-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Hematológico-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Musculoesquelético-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Nervioso-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Del-Sistema-Inmunitario-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Infecciosas-Y-Sus-Tratamientos.pdf",
    "documentos/Enfermedades-Mentales-Y-Sus-Tratamientos.pdf",
    "farmatodo.txt",
]


#Carga el modelo de lenguaje de spaCy (solo una vez)
nlp = spacy.load("en_core_web_sm") 


#Variable para controlar si ya se procesaron los archivos
processed = False


#Procesamiento de archivos PDF y TXT
def process_files():
    global processed  # Acceder a la variable global

    if processed:  # Verificar si ya se procesaron los archivos
        return

    chroma_client = chroma.Client()
    pdf_collection = chroma_client.get_or_create_collection(name="docs_farm_collection_pdf")
    txt_collection = chroma_client.get_or_create_collection(name="docs_farm_collection_txt")
    document_id = 1

    for doc in documents:
        if isinstance(doc, str) and doc.lower().endswith(".pdf"):  # Verifica si es una ruta a un PDF
            with open(doc, "rb") as file:  # Abre en modo binario para PDF
                pdf_reader = PyPDF2.PdfReader(file)
                pdf_text = ""
                for page in pdf_reader.pages:
                    pdf_text += page.extract_text()
                file_name = doc  # Guarda el nombre del archivo para los metadatos

                document_title = get_title_from_pdf(pdf_reader)  # Obtiene el título del PDF

            print("processing file: " + file_name)
            chunks = split_text_pdf(pdf_text)  # Divide el texto del PDF

            # Imprimir los fragmentos en la terminal
            #print("\nFragmentos del PDF:")
            #for i, chunk in enumerate(chunks):
            #    print(f"Fragmento {i+1}:")
            #    print(chunk)
            #    print("---")  # Separador entre fragmentos

            generate_embeddings(chunks, file_name, pdf_collection, document_id, pdf_reader, document_title) 
            document_id += len(chunks)

        elif isinstance(doc, str) and doc.lower().endswith(".txt"):  # Verifica si es una ruta a un TXT
            with open(doc, "r", encoding="utf-8") as file:  # Abre en modo texto para TXT
                txt_text = file.read()
                file_name = doc  # Guarda el nombre del archivo para los metadatos

                # El documento TXT no tiene título

            print("processing file: " + file_name)
            chunks = split_text_txt(txt_text)  # Divide el texto del TXT

            # Imprimir los fragmentos en la terminal
            #print("\nFragmentos del TXT:")
            #for i, chunk in enumerate(chunks):
            #    print(f"Fragmento {i+1}:")
            #    print(chunk)
            #    print("---")  # Separador entre fragmentos

            generate_embeddings(chunks, file_name, txt_collection, document_id, None)  # Pasa None para pdf_reader
            document_id += len(chunks)

        else:
            print(f"Advertencia: '{doc}' no es una ruta válida a un PDF. Se omitirá.")

    processed = True  # Marcar los archivos como procesados


#Generacion de embeddings
def generate_embeddings(chunks, file_name, collection, document_id, pdf_reader, document_title=None):  # Agrega document_title=None
    for i, chunk in enumerate(chunks):
        try:
            data = json.loads(chunk)  # Convierte el fragmento JSON a un diccionario
            media_description = data.get("mediaDescription", "")  # Extrae mediaDescription
        except json.JSONDecodeError:
            media_description = ""  # Si no es un JSON válido, mediaDescription será vacío
    
        metadata = {
            "document_title": document_title if document_title is not None else "",
            "file_name": file_name,
            "collection_type": "pdf" if file_name.lower().endswith(".pdf") else "txt", 
            "mediaDescription": media_description  # Agrega mediaDescription a los metadatos
        }

        collection.add(
            metadatas=metadata,
            documents=[chunk], # Indexa el fragmento JSON completo
            ids=[str(document_id + i)]
        )


#Extrae el título del documento PDF
def get_title_from_pdf(pdf_reader):
    try:
        # 1. Intenta obtener el título de los metadatos del PDF
        title = pdf_reader.metadata.title
        if title:
            return title
    except AttributeError:
        print("Advertencia: No se encontró título en los metadatos del PDF.")
    except KeyError:
        print("Advertencia: La clave 'title' no está presente en los metadatos del PDF.")

    # 2. Si no hay título en los metadatos, intenta extraerlo del contenido
    first_page_text = pdf_reader.pages[0].extract_text()

    # a. Buscar patrones comunes de títulos (mayúsculas, centrado, etc.)
    lines = first_page_text.split("\n")
    for line in lines:
        line = line.strip()
        if line.isupper() or line.istitle() or len(line) > 10 and line == line.upper():  # Mayúsculas o título o más de 10 caracteres y todo en mayúsculas
            if len(line) > 3:  # Evitar líneas muy cortas que podrían ser encabezados de sección
                return line

    # b. Buscar patrones específicos usando expresiones regulares
    match = re.search(r"^(.+)\n", first_page_text)  # Busca la primera línea no vacía
    if match:
        return match.group(1).strip()

    match = re.search(r"^\s*(.+?)\s*\n\n", first_page_text, re.MULTILINE)  # Busca una línea seguida de una línea vacía
    if match:
        return match.group(1).strip()

    # c. Si no se encuentra un título claro, usar las primeras palabras de la primera página
    words = first_page_text.split()
    if words:
        return " ".join(words[:10])  # Usar las primeras 10 palabras como título provisional

    # Si no se encuentra ningún título, devolver una cadena vacía
    return ""


#División de texto PDF en fragmentos (chunks)
def split_text_pdf(text):
    sentences = sent_tokenize(text)  # Tokenizar en oraciones
    chunks = []
    current_chunk = ""
    current_chunk_length = 0

    for sentence in sentences:
        sentence_length = len(sentence)

        # Si la oración actual excede la longitud máxima del fragmento, crea un nuevo fragmento
        if current_chunk_length + sentence_length > 500:  # Ajusta la longitud máxima según sea necesario
            chunks.append(current_chunk.strip())
            current_chunk = ""
            current_chunk_length = 0

        current_chunk += sentence + " "
        current_chunk_length += sentence_length

    # Agregar el último fragmento si no está vacío
    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


#División de texto TXT en fragmentos (chunks)
def split_text_txt(text):
    try:
        data = json.loads(text)  # Intenta cargar el texto como JSON
        chunks = []
        for item in data:  # Itera sobre los elementos del JSON (cada elemento es un fragmento)
            chunks.append(json.dumps(item))  # Convierte cada elemento de nuevo a JSON string
        return chunks
    except json.JSONDecodeError:
        print("Error: El archivo TXT no contiene un JSON válido.")
        return []  # Devuelve una lista vacía si no se puede decodificar el JSON
    

#Consulta la coleccion de archivos PDF
def query_collection_pdf(query, collection_name="docs_farm_collection_pdf"):
    chroma_client = chroma.Client()
    pdf_collection = chroma_client.get_or_create_collection(name="docs_farm_collection_pdf")

    # Crear una instancia del lematizador
    lemmatizer = WordNetLemmatizer()

    # Preprocesamiento de la consulta
    query_tokens = nltk.word_tokenize(query)
    query_lemmas = [lemmatizer.lemmatize(token) for token in query_tokens]
    query_processed = " ".join(query_lemmas)

    # Búsqueda con parámetros adicionales
    results = pdf_collection.query(
        query_texts=[query_processed],
        n_results=3,  
    )

    if results is None or not results['documents']:  # Verificar si results es None o si 'documents' está vacío
        return "No se encontraron fragmentos relevantes para tu consulta." 

    return results


#Consulta la coleccion de archivos TXT
def query_collection_txt(query, collection_name="docs_farm_collection_txt"):
    chroma_client = chroma.Client()
    txt_collection = chroma_client.get_or_create_collection(name="docs_farm_collection_txt")

    # Crear una instancia del lematizador
    lemmatizer = WordNetLemmatizer()

    # Preprocesamiento de la consulta
    query_tokens = nltk.word_tokenize(query)
    query_lemmas = [lemmatizer.lemmatize(token) for token in query_tokens]
    query_processed = " ".join(query_lemmas)

    # Búsqueda con parámetros adicionales
    results = txt_collection.query(
        query_texts=[query_processed],
        n_results=3,  
        where_document={"$contains": query_processed} 
    )

    if results is None or not results['documents']:  # Verificar si results es None o si 'documents' está vacío
        return "No se encontraron fragmentos relevantes para tu consulta." 

    return results