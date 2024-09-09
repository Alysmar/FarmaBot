import re
import chromadb as chroma
import PyPDF2
import spacy


#Lista de documentos PDF
documents = [
    "documentos/prueba-blue.pdf",
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

            print("processing file: " + file_name)
            chunks = split_text(pdf_text)  # Divide el texto del PDF

            # Imprimir los fragmentos en la terminal
            print("\nFragmentos del PDF:")
            for i, chunk in enumerate(chunks):
                print(f"Fragmento {i+1}:")
                print(chunk)
                print("---")  # Separador entre fragmentos

            document_title = get_title_from_pdf(pdf_reader)  # Obtén el título del PDF 
            generate_embeddings(chunks, document_title, file_name, collection, document_id)  # Pasa document_id como argumento
            document_id += len(chunks)
        else:
            print(f"Advertencia: '{doc}' no es una ruta válida a un PDF. Se omitirá.")

    processed = True  # Marcar los archivos como procesados


#Generacion de embeddings
def generate_embeddings(chunks, document_title, file_name, collection, document_id):
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
        # Intenta obtener el título de los metadatos del PDF
        title = pdf_reader.metadata.title
        if title:
            return title
    except:
        pass

    # Si no hay título en los metadatos, intenta extraerlo del contenido
    first_page_text = pdf_reader.pages[0].extract_text()
    match = re.search(r"^(.+)\n", first_page_text)  # Busca la primera línea
    if match:
        return match.group(1)
    else:
        return ""  # Devuelve una cadena vacía si no se encuentra un título


#División de texto en fragmentos (chunks)
def split_text(text):
    doc = nlp(text)
    
    chunks = []
    start_index = 0
    
    for sent in doc.sents:
        if sent.text.endswith("."):  # Considerar solo oraciones que terminen en punto
            chunks.append(text[start_index:sent.end_char].strip())
            start_index = sent.end_char
    
    if start_index < len(text):  # Agregar el último fragmento si es necesario
        chunks.append(text[start_index:].strip())
    
    return chunks


#Consulta de la colección ChromaDB
def query_collection(query):
    chroma_client = chroma.Client()
    collection = chroma_client.get_or_create_collection(name="docs_farm_collection")
    return collection.query(
        query_texts=[query],
        n_results=2, # Puedes ajustar el número de resultados que deseas
    )