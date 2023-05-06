import { getOpenAiCities } from "@/lib/openai-city-search";
import firebase from "@/lib/init-firebase";
import {
  collection,
  doc,
  endAt,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAt,
  where,
  writeBatch,
} from "firebase/firestore";
const db = getFirestore(firebase);

// Internal params
const maxSuggestions = 5;

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
    console.log(
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
    query.toLocaleLowerCase() == savedCities[0].name_lowercase
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
    // If we get either zero saved cities or (between 1 and maxSuggestions)
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
          const cityRef = doc(db, "cities", city.toLocaleLowerCase());
          const [name, country] = city.split(" in "); // eg. New York in United States
          batch.set(cityRef, {
            name,
            name_lowercase: name.toLowerCase(),
            country,
            is_approved: true,
          });
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
