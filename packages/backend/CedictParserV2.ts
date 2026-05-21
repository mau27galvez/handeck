export function parseCedictLine(line: string) {
  if (line === "") {
    return null;
  }

  if (line.startsWith("#")) {
    return null;
  }

  const [, simplifiedHanzi, rawPinyin, rawMeaning] = line.split(" ");

  if (!simplifiedHanzi || !rawPinyin || !rawMeaning) {
    return null;
  }

  const parsedSenses = parseRawMeaning(rawMeaning);
  if (parsedSenses.length === 0) {
    return null;
  }

  const keptSenses = parsedSenses.filter((sense) => !isOldVariantSense(sense));
  if (keptSenses.length === 0) {
    return null;
  }

  const formattedMeaning = keptSenses.join("; ");

  return {
    simplifiedHanzi,
    pinyin: rawPinyin,
    meaning: formattedMeaning,
  };
}

function parseRawMeaning(rawMeaning: string) {
  return rawMeaning?.split("/").filter(Boolean) ?? [];
}

function isOldVariantSense(sense: string) {
  return sense.trim().startsWith("old variant of ");
}
