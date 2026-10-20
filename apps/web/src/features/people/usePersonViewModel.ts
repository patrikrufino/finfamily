import { useCallback, useState } from "react";
import { readStored, writeStored } from "../../shared/storage";

export const PEOPLE = ["patrik", "heloisa"] as const;
export type PersonKey = (typeof PEOPLE)[number];
const STORAGE_KEY = "finfamily.person";

function readPerson(): PersonKey {
  const stored = readStored(STORAGE_KEY);
  return PEOPLE.find((p) => p === stored) ?? PEOPLE[0];
}

export function usePersonViewModel() {
  const [person, setPersonState] = useState<PersonKey>(readPerson);

  const setPerson = useCallback((next: PersonKey) => {
    writeStored(STORAGE_KEY, next);
    setPersonState(next);
  }, []);

  return { person, people: PEOPLE, setPerson };
}
