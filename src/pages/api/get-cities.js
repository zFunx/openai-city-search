// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import firebase from "@/lib/init-firebase";
import {
  collection,
  endAt,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAt,
  where,
} from "firebase/firestore";
const db = getFirestore(firebase);

// Internal params
const maxSuggesttion = 5;

async function getSavedCitiesByPartialName(partialName) {
  const q = query(
    collection(db, "cities"),
    orderBy("name_lowercase"),
    startAt(partialName.toLowerCase()),
    endAt(partialName.toLowerCase() + "\uf8ff"),
    where("is_approved", "==", true),
    limit(maxSuggesttion)
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

  const cities = await getSavedCitiesByPartialName(query);

  if (
    1 == cities.length &&
    query.toLocaleLowerCase() == cities[0].name_lowercase
  ) {
    // If we get only one saved city
    return res.status(200).json({ cities });
  } else if (maxSuggesttion == cities.length) {
    // If we get all saved cities
    return res.status(200).json({ cities });
  } else {
    // If we get either zero saved cities or (between 1 and maxSuggestions)
    // TODO
    return res.status(200).json({ cities });
  }

  // Defaut response
  res.status(200).json({ cities: [] });
}
