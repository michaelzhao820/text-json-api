# JSON Formatter API

This API provides a service for converting unstructured text data into structured JSON format based on a provided schema. It uses Google Generative AI to generate structured JSON output from text input, adhering to the given schema.

## Features

- **CORS support:** Allows cross-origin requests.
- **Zod schema validation:** Converts JSON schema to Zod schema for input validation.
- **Retry mechanism:** Implements retry logic to handle transient errors.
- **Google Generative AI integration:** Leverages Google Generative AI for content generation.

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/json-formatter-api.git
cd json-formatter-api
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env` file and add your Google API key:

```plaintext
GOOGLE_API_KEY=your-google-api-key
```

## Usage

1. Start the server:

```bash
npm start
```

2. Make a POST request to the API with the following payload:

```json
{
  "input": "Your unstructured text here.",
  "format": {
    "your": {"type": "string"},
    "desired": {"type": "string"},
    "json": {"type": "string"},
    "format": {"type": "string"}
  }
}
```

3. Example cURL request:

```bash
curl -X POST http://localhost:3000/ \
     -H "Content-Type: application/json" \
     -d '{
           "input": "Your unstructured text here.",
           "format": {
             "your": {"type": "string"},
             "desired": {"type": "string"},
             "json": {"type": "string"},
             "format": {"type": "string"}
           }
         }'
```

## Code Overview

### Dependencies

- `hono`: Web framework for building APIs.
- `cors`: Middleware for enabling CORS.
- `zod`: TypeScript-first schema declaration and validation library.
- `@google/generative-ai`: Google Generative AI library.

### API Endpoints

#### POST `/`

Accepts a JSON payload with `input` and `format` fields, processes the input using Google Generative AI, and returns a structured JSON response based on the provided format.

### Functions

- `determineSchemaType(schema: any): string`: Determines the type of a JSON schema.
- `jsonSchemaToZod(schema: any): ZodTypeAny`: Converts JSON schema to Zod schema.
- `RetryablePromise<T>`: A class that extends `Promise` with retry logic.

### Example

Here’s an example of how the API processes input:

1. **Input:**

```json
{
  "input": "My name is John and I am 25 years old.",
  "format": {
    "name": {"type": "string"},
    "age": {"type": "number"}
  }
}
```

2. **Output:**

```json
{
  "name": "John",
  "age": 25
}
```


