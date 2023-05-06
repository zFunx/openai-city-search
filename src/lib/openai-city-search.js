import { Configuration, OpenAIApi } from "openai";

const examplesOfPartialMatch = [
  "Mumbai in India",
  "Mumbwa in Zambia",
  "Mumbil in Australia",
  "Mumbwa District in Zambia",
  "Muminabad in Tajikistan",
];

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function getOpenAiCities({ query, numOfCities = 5 } = {}) {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You suggest ${numOfCities} ${
            numOfCities > 1 ? "cities" : "city"
          } along with ${
            numOfCities > 1 ? "their full country names" : "its country name"
          }.`,
        },
        { role: "user", content: "mum" },
        {
          role: "assistant",
          content: `['Partial match', '${examplesOfPartialMatch
            .slice(0, numOfCities)
            .join("', '")}'].`,
        },
        { role: "user", content: "new delhi" },
        {
          role: "assistant",
          content: "['Exact match','New Delhi in India'].",
        },
        { role: "user", content: "fdsmfbjkhfd" },
        {
          role: "assistant",
          content: "['No match'].",
        },
        { role: "user", content: query },
      ],
    });

    return completion.data.choices[0].message.content;
  } catch (error) {
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
    }

    return [];
  }
}
