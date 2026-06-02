import { createHash } from "node:crypto";

const BASE91_TABLE = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "!",
  "#",
  "$",
  "%",
  "&",
  "(",
  ")",
  "*",
  "+",
  ",",
  "-",
  ".",
  "/",
  ":",
  ";",
  "<",
  "=",
  ">",
  "?",
  "@",
  "[",
  "]",
  "^",
  "_",
  "`",
  "{",
  "|",
  "}",
  "~",
] as const;

export function guidFor(...values: unknown[]) {
  const hashInput = values.map(String).join("__");
  const hashBytes = createHash("sha256").update(hashInput, "utf8").digest().subarray(0, 8);

  let hashInt = 0n;
  for (const byte of hashBytes) {
    hashInt = (hashInt << 8n) + BigInt(byte);
  }

  const base = BigInt(BASE91_TABLE.length);
  const reversed: string[] = [];
  while (hashInt > 0n) {
    reversed.push(BASE91_TABLE[Number(hashInt % base)]!);
    hashInt /= base;
  }

  return reversed.reverse().join("");
}

export function warnOrThrow(message: string, validation: "warn" | "error" = "warn") {
  if (validation === "error") {
    throw new Error(message);
  }

  console.warn(message);
}
