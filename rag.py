import re
import chromadb as chroma
import PyPDF2
import spacy
from nltk.tokenize import sent_tokenize

#Descomentar este import la primera vez que se ejecute el proyeto. Luego comentar nuevamente
#import nltk
#nltk.download('punkt_tab')

#Lista de documentos PDF
documents = [
    "documentos/Leflunomida.pdf",
    "documentos/Inyección_de_insulina_glargina.pdf",
    "documentos/Nevirapina.pdf",
    "documentos/Repaglinida.pdf",
]


#Carga el modelo de lenguaje de spaCy (solo una vez)
nlp = spacy.load("en_core_web_sm") 


#Variable para controlar si ya se procesaron los archivos
processed = False


#Procesamiento de archivos PDF
def process_files():
    global processed  # Acceder a la variable global

    if processed:  # Verificar si ya se procesaron los archivos
        return

    chroma_client = chroma.Client()
    collection = chroma_client.get_or_create_collection(name="docs_farm_collection")
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
            chunks = split_text(pdf_text)  # Divide el texto del PDF

            # Imprimir los fragmentos en la terminal
            print("\nFragmentos del PDF:")
            for i, chunk in enumerate(chunks):
                print(f"Fragmento {i+1}:")
                print(chunk)
                print("---")  # Separador entre fragmentos

            generate_embeddings(chunks, document_title, file_name, collection, document_id, pdf_reader) 
            document_id += len(chunks)
        else:
            print(f"Advertencia: '{doc}' no es una ruta válida a un PDF. Se omitirá.")

    processed = True  # Marcar los archivos como procesados


#Generacion de embeddings
def generate_embeddings(chunks, document_title, file_name, collection, document_id, pdf_reader): 
    for i, chunk in enumerate(chunks):
        collection.add(
            metadatas={
                "document_title": document_title if document_title is not None else "",
                "file_name": file_name
            },
            documents=chunk,
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


#División de texto en fragmentos (chunks)
def split_text(text):
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


#Consulta de la colección ChromaDB
def query_collection(query):
    chroma_client = chroma.Client()
    collection = chroma_client.get_or_create_collection(name="docs_farm_collection")
    return collection.query(
        query_texts=[query],
        n_results=3, # Puedes ajustar el número de resultados que deseas
    )