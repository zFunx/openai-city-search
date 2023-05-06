`Next.js Endpoint: /api/get-cities?query={query}`
<br>
This is an example of how to use the OpenAI chat completion API to provide suggested city names to a frontend using a Next.js API route. Firebase is used to store all searches from OpenAI. Care is taken to throttle the number of requests to OpenAI, with a 10-second interval that can be adjusted.

- Model used: `gpt-3.5-turbo`
- Range of tokens used per request: 150 to 200
- Query must be at least 3 letters long and no more than 20 letters long
- Queries are limited to a maximum of 2 words per request

## Start your application
Please fill in your OpenAI and Firebase credentials in  the `.env.local` file
```
FIREBASE_apiKey=
FIREBASE_authDomain=
FIREBASE_projectId=
FIREBASE_messagingSenderId=
FIREBASE_appId=
FIREBASE_measurementId=

OPENAI_API_KEY=
```

To start the application, run the following commands:
```bash
npm i
npm run dev
```

Adjust the number of suggestions and interval of requests in the `index.js` file:
```javascript
const maxSuggestions = 5;
const openAIInterval = 10 * 1000; // call OpenAI API once per 10 seconds
```

## Note for learners
1. To learn how to implement the chatGPT feature, please refer to the [openai-city-search.js](src/lib/openai-city-search.js) file.
1. Only one API route is created: [get-cities.js](src/pages/api/get-cities.js). In this file, I used logic to call the OpenAI API only when necessary.

## Test cases
Endpoint: /api/get-cities?query={query}
1. /api/get-cities?query=chennai
```json
{
  "matchType": "Exact match",
  "cities": [
    "Chennai in India"
  ]
}
```
1. /api/get-cities?query=new
```json
{
  "matchType": "Partial match",
  "cities": [
    "New Delhi in India",
    "New York City in United States",
    "New South Wales in Australia",
    "New Orleans in United States",
    "Newcastle upon Tyne in United Kingdom"
  ]
}
```
1. /api/get-cities?query=sponge+bob
```json
{
  "matchType": "No match",
  "cities": []
}
```