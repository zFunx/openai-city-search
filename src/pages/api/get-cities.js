import { getOpenAiCities } from "@/lib/openai-city-search";
import firebase from "@/lib/init-firebase";
import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  where,
  writeBatch,
} from "firebase/firestore";
const db = getFirestore(firebase);

// Internal params
const maxSuggestions = 5;
// const openAIInterval = 2 * 60 * 60 * 1000; // call OpenAI API once per 2 hrs
const openAIInterval = 10 * 1000; // call OpenAI API once per 10 seconds

async function getSavedCitiesByPartialName(partialName) {
  const q = query(
    collection(db, "cities"),
    orderBy("name_lowercase"),
    startAt(partialName.toLowerCase()),
    endAt(partialName.toLowerCase() + "\uf8ff"),
    where("is_approved", "==", true),
    limit(maxSuggestions)
  );
  const cities = [];

  try {
    const docs = await getDocs(q);
    docs.forEach((doc) => {
      cities.push({
        id: doc.id,
        ...doc.data(),
      });
    });
  } catch (e) {
    console.error(
      "Somthing went wrong while searching for cities from Firbase",
      e
    );
  }

  return cities;
}
function removeTrailingPeriod(str) {
  if (str.charAt(str.length - 1) === ".") {
    return str.slice(0, -1);
  } else {
    return str;
  }
}
function formatSavedCities(cities) {
  return cities.map((city) => `${city.name} in ${city.country}`);
}
function removeDuplicates(array) {
  const uniqueArray = [];
  for (let i = 0; i < array.length; i++) {
    if (uniqueArray.indexOf(array[i]) === -1) {
      uniqueArray.push(array[i]);
    }
  }
  return uniqueArray;
}
/**
 * Checks if Open AI was called within the given limit of time
 */
async function isRecentlyCalledOpenAi() {
  const docRef = doc(db, "logs", "last-suggestion-time");
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return false;
  } else {
    const lastTimestamp = docSnap.data().last_fetched.toDate();
    const currentTimestamp = new Date();

    if (
      Math.floor(currentTimestamp.getTime() - lastTimestamp.getTime()) >
      openAIInterval
    ) {
      return false;
    } else {
      return true;
    }
  }
}

export default async function handler(req, res) {
  const { query } = req.query;

  // Validation
  if (!query) {
    return res.status(400).json({ message: "query is required" });
  } else if (query.length < 3 || query.length > 20) {
    return res
      .status(400)
      .json({ message: "Length of query should be between 3 to 20 letters" });
  } else if (query.split(" ").length > 2) {
    return res
      .status(400)
      .json({ message: "query should not exceeds 2 words long" });
  }

  const savedCities = await getSavedCitiesByPartialName(query);

  if (
    1 == savedCities.length &&
    query.toLowerCase() == savedCities[0].name_lowercase
  ) {
    // If we get only one saved city
    return res.status(200).json({
      matchType: "Exact match",
      cities: formatSavedCities(savedCities),
    });
  } else if (maxSuggestions == savedCities.length) {
    // If we get all saved cities
    return res.status(200).json({
      matchType: "Partial match",
      cities: formatSavedCities(savedCities),
    });
  } else {
    if (await isRecentlyCalledOpenAi()) {
      if (0 == savedCities.length) {
        return res.status(200).json({
          matchType: "No match",
          cities: [],
        });
      } else {
        return res.status(200).json({
          matchType: "Partial match",
          cities: formatSavedCities(savedCities),
        });
      }
    }
    
    // If we get between zero to maxSuggestions saved cities
    try {
      const openaiResponse = await getOpenAiCities({
        query,
        numOfCities: maxSuggestions - savedCities.length,
      });
      let cleanedResponse = openaiResponse.replace(/'/g, '"');
      cleanedResponse = removeTrailingPeriod(cleanedResponse);
      cleanedResponse = JSON.parse(cleanedResponse);

      // Save new data in firebase
      {
        // Get a new write batch
        const batch = writeBatch(db);

        cleanedResponse.slice(1).map((city) => {
          const cityRef = doc(db, "cities", city.toLowerCase());
          const [name, country] = city.split(" in "); // eg. New York in United States
          batch.set(cityRef, {
            name,
            name_lowercase: name.toLowerCase(),
            country,
            is_approved: true,
          });
        });

        // Store time when the suggestion was asked from open ai
        const lastSuggestionTimeRef = doc(db, "logs", "last-suggestion-time");
        batch.set(lastSuggestionTimeRef, {
          last_fetched: serverTimestamp(),
        });

        // Commit the batch
        await batch.commit();
      }

      if (0 == savedCities.length && "No match" == cleanedResponse[0]) {
        return res.status(200).json({
          matchType: "No match",
          cities: [],
        });
      } else {
        return res.status(200).json({
          matchType:
            0 == savedCities.length ? cleanedResponse[0] : "Partial match",
          cities: removeDuplicates([
            ...cleanedResponse.slice(1),
            ...formatSavedCities(savedCities),
          ]),
        });
      }
    } catch (error) {
      console.error("Something went wrong while fetching cities", error);
      return res.status(200).json({
        matchType: "No match",
        cities: [],
      });
    }
  }
}
