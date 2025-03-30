# --- Base Imports ---
import os
import re
import logging
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query, Body
from pydantic import BaseModel, Field
import uvicorn

import os
from dotenv import load_dotenv

import re
import logging
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query, Body
from pydantic import BaseModel, Field
import uvicorn
from typing import Optional, List
# --- API Client Imports ---
import google.generativeai as genai

load_dotenv()

# --- API Client Imports ---
import google.generativeai as genai # For Gemini models (summarization & embedding)

# --- LOGGING CONFIGURATION ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONSTANTS ---
MIN_TEXT_LENGTH_FOR_PROCESSING = 100 # Maybe lower threshold if API handles shorter text better
REQUEST_TIMEOUT_SECONDS = 10
# Google AI Model Names (Check documentation for latest/best options)
GEMINI_GENERATION_MODEL = 'gemini-1.5-flash-latest' # Good balance for summarization/generation
# NOTE: As of late 2023/early 2024, Google's dedicated embedding models might be preferred via specific APIs
# but `embed_content` using a text model often works. For production, use the recommended embedding model e.g., 'text-embedding-004'
# For simplicity here, we'll try using the general model's embedding capability or a placeholder name.
# Replace 'embedding-001' or similar if using genai.embed_content specifically.
GEMINI_EMBEDDING_MODEL = 'models/embedding-002' # Or specific embedding model name

# --- API CLIENT CONFIGURATION ---
gemini_model_generation = None
# gemini_model_embedding = None # Might not need separate model instance if using embed_content

try:
    # Load API Key from environment variable
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    if not GOOGLE_API_KEY:
        logging.error("CRITICAL ERROR: GOOGLE_API_KEY environment variable not set.")
        # Application might not function fully without the key
    else:
        genai.configure(api_key=GOOGLE_API_KEY)
        gemini_model_generation = genai.GenerativeModel(GEMINI_GENERATION_MODEL)
        # If using genai.embed_content, you might not need to instantiate the model here.
        # gemini_model_embedding = genai.get_embedding_model(GEMINI_EMBEDDING_MODEL) # Example if using specific func
        logging.info(f"Google AI client configured for model: {GEMINI_GENERATION_MODEL}")

except Exception as e:
    logging.error(f"CRITICAL ERROR: Failed to configure Google AI client: {e}", exc_info=True)
    gemini_model_generation = None

# --- FASTAPI APP INITIALIZATION (No lifespan needed for API setup) ---
app = FastAPI(
    title="Semantic History Backend (API Version)",
    description="API using external services for processing and searching history.",
    version="0.2.0", # Bump version
)

# --- HELPER FUNCTIONS ---

def fetch_and_extract_text(url: str):
    """
    Fetches URL content and extracts primary text using BeautifulSoup.
    (Code remains the same as before)
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/'
        }
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS, headers=headers, allow_redirects=True)
        response.raise_for_status()

        content_type = response.headers.get('content-type', '').lower()
        if 'text/html' not in content_type:
            logging.warning(f"Skipping non-HTML content: {url} ({content_type})")
            return None

        soup = BeautifulSoup(response.content, 'lxml')

        for element in soup(["script", "style", "nav", "footer", "header", "aside", "form", "button", "iframe", "noscript"]):
            element.decompose()

        main_content = soup.find('main') or \
                       soup.find('article') or \
                       soup.find('div', {'role': 'main'}) or \
                       soup.find('div', id='main-content') or \
                       soup.find('div', class_='post-content') or \
                       soup.find('div', id='content')

        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
        else:
            body = soup.find('body')
            if body:
                 text = body.get_text(separator=' ', strip=True)
            else:
                 logging.warning(f"Could not find <body> tag in {url}")
                 text = soup.get_text(separator=' ', strip=True)

        text = re.sub(r'\s{2,}', ' ', text).strip()

        if len(text) < MIN_TEXT_LENGTH_FOR_PROCESSING:
            logging.info(f"Skipping due to short content ({len(text)} chars) after cleaning: {url}")
            return None

        logging.info(f"Successfully extracted ~{len(text)} characters from {url}")
        return text

    except requests.exceptions.Timeout:
        logging.warning(f"Timeout fetching {url} after {REQUEST_TIMEOUT_SECONDS} seconds.")
        return None
    except requests.exceptions.HTTPError as e:
         logging.warning(f"HTTP Error fetching {url}: {e.response.status_code} {e.response.reason}")
         return None
    except requests.exceptions.ConnectionError as e:
        logging.warning(f"Connection Error fetching {url}: {e}")
        return None
    except requests.exceptions.RequestException as e:
        logging.warning(f"General Request Failed for {url}: {e}")
        return None
    except Exception as e:
        logging.error(f"Failed to parse or process {url}: {e}", exc_info=True)
        return None

# --- NEW API-based Functions ---
from typing import Optional
def summarize_text_api(text: str) -> Optional[str]:
    """
    Summarizes the input text using the configured Google AI API.
    """
    if not gemini_model_generation:
        logging.error("Gemini model not available for summarization.")
        return None
    if not text or len(text.strip()) < 30: # Need some text to summarize
        logging.warning("Text too short or invalid for API summarization.")
        # Return original if very short, rather than failing entirely
        return text if (text and len(text.strip()) > 0) else None

    try:
        # Basic prompt engineering
        # You can customize this prompt significantly for better results
        prompt = f"""Provide a concise, neutral summary (around 2-4 sentences) of the following web page content:

        Content:
        \"\"\"
        {text[:15000]}
        \"\"\"

        Summary:""" # Truncate input text to avoid excessively long prompts/costs

        logging.info(f"Requesting summary from Gemini API for text ({len(prompt)} prompt chars)...")

        # Optional: Add safety settings if needed
        # safety_settings=[...]

        response = gemini_model_generation.generate_content(
            prompt,
            # generation_config=genai.types.GenerationConfig(...) # For temp, top_k etc.
            # safety_settings=safety_settings
            )

        # Check response validity
        if not response.candidates or not response.text:
             logging.warning(f"Gemini API did not return a valid summary. Feedback: {response.prompt_feedback}. Parts: {response.parts}")
             # Fallback: return the beginning of the original text
             return text[:500].strip()

        summary = response.text
        logging.info("Gemini API summarization successful.")
        return summary.strip()

    except Exception as e:
        logging.error(f"Gemini API summarization call failed: {e}", exc_info=True)
        # Fallback
        return text[:500].strip()

def get_embedding_api(text: str, task_type="retrieval_document") -> Optional[List[float]]:
    """
    Generates a vector embedding using the Google AI Embedding API.
    task_type can be: retrieval_query, retrieval_document, semantic_similarity, classification, clustering
    """
    # Note: genai.embed_content might use a specific embedding model behind the scenes
    if not text or len(text.strip()) == 0:
        logging.warning("Cannot generate embedding for empty or invalid text.")
        return None
    if not GOOGLE_API_KEY: # Check if API was configured
         logging.error("Google API Key not configured, cannot generate embeddings.")
         return None

    try:
        logging.info(f"Requesting embedding from Google API for text ({len(text)} chars)...")

        # Use genai.embed_content (recommended way)
        # Ensure you use a model compatible with this function, e.g., 'models/embedding-001'
        result = genai.embed_content(
            model=GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type=task_type) # Important for optimizing embeddings

        # Check for valid response
        if not result or 'embedding' not in result:
            logging.error(f"Google API embedding call failed or returned invalid format. Result: {result}")
            return None

        embedding_list = result['embedding']
        logging.info(f"Google API embedding generated successfully (dimension: {len(embedding_list)}).")
        return embedding_list # Already a list

    except Exception as e:
        logging.error(f"Google API embedding call failed: {e}", exc_info=True)
        return None

# --- PYDANTIC MODELS ---
class TestText(BaseModel):
    text: str = Field(..., min_length=10, example="Sample text...")

# --- API ROUTES / ENDPOINTS ---

@app.get("/")
async def read_root():
    """ Basic welcome message for the root path. """
    return {"message": "Welcome to the Semantic History API! (Using Google AI)"}

@app.get("/ping")
async def ping_pong():
    """ A simple health check endpoint. """
    return {"message": "pong"}

@app.get("/hello/{name}")
async def say_hello(name: str):
    """ Returns a personalized greeting. """
    if not name:
        raise HTTPException(status_code=400, detail="Name parameter cannot be empty")
    return {"greeting": f"Hello, {name}!"}

@app.get("/testscrape")
async def test_scraping(url: str = Query(..., title="URL to Scrape")):
    """ Temporary endpoint to test the fetch_and_extract_text function. """
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format. Must start with http:// or https://")

    logging.info(f"Test scraping requested for URL: {url}")
    extracted_text = fetch_and_extract_text(url)

    if extracted_text:
        return {
            "url": url, "status": "Success", "extracted_length": len(extracted_text),
            "extracted_text_preview": extracted_text[:500] + ("..." if len(extracted_text) > 500 else "")
        }
    else:
         return {
            "url": url, "status": "Failed",
            "message": "Could not fetch web page, or failed to extract significant text content from the URL."
         }

@app.post("/testmodels_api") # Renamed endpoint slightly
async def test_ml_models_api(input_data: TestText = Body(...)):
    """
    Temporary endpoint to test API-based summarization and embedding.
    Requires a POST request with JSON body like: {"text": "Your text here"}
    """
    original_text = input_data.text
    logging.info(f"Testing API models with input text ({len(original_text)} chars)...")

    # Call the NEW API-based functions
    summary = summarize_text_api(original_text)
    # Embed the summary if available and valid, otherwise embed original text
    text_to_embed = summary if summary and len(summary) > 10 else original_text
    embedding = get_embedding_api(text_to_embed, task_type="retrieval_document") # Use appropriate task type
    if embedding:
        embedding_dimension = len(embedding)
        if embedding_dimension < 10:  # Most embedding models return vectors with hundreds of dimensions
            logging.warning(f"Suspiciously small embedding dimension: {embedding_dimension}")

    result = {
        "original_text": original_text,
        "summary": summary if summary else "Summarization via API failed or not applicable.",
        "text_embedded": text_to_embed, # Show what was actually embedded
        "embedding_generated": embedding is not None,
        "embedding_preview": embedding[:10] if embedding else None,
        "embedding_dimension": len(embedding) if embedding else 0
    }
    return result


# --- MAIN EXECUTION BLOCK ---
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    print("\n--- To run the development server (API Version): ---")
    print(f"1. Set GOOGLE_API_KEY environment variable.")
    print(f"2. Run: uvicorn {os.path.basename(__file__).replace('.py', '')}:app --reload --port {port}\n")
    # Optional: Programmatic run (less ideal for reload)
    # print(f"--- FastAPI Development Server (using Uvicorn programmatically) ---")
    # uvicorn.run(f"{os.path.basename(__file__).replace('.py', '')}:app", host="0.0.0.0", port=port, reload=True)