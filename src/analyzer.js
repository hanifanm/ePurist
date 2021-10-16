export const TYPE_KEY = {
  NULL: "___null",
  UNDEFINED: "___undefined",
  ARRAY: "___array",
  BOOLEAN: "___boolean",
  NUMBER: "___number",
  STRING: "___string",
  OBJECT: "___object",
};

export const DATA_TYPES = [
  { name: "Null", key: TYPE_KEY.NULL },
  { name: "Undefined", key: TYPE_KEY.UNDEFINED },
  { name: "Array", key: TYPE_KEY.ARRAY },
  { name: "Boolean", key: TYPE_KEY.BOOLEAN },
  { name: "Number", key: TYPE_KEY.NUMBER },
  { name: "String", key: TYPE_KEY.STRING },
  { name: "Object", key: TYPE_KEY.OBJECT },
];

function getType(variable) {
  if (variable === null) {
    return TYPE_KEY.NULL;
  } else if (variable === undefined) {
    return TYPE_KEY.UNDEFINED;
  } else if (Array.isArray(variable)) {
    return TYPE_KEY.ARRAY;
  } else {
    return `___${typeof variable}`;
  }
}

export function doAnalyze(list) {
  const finalMap = {};

  function getOrCreate(keys) {
    let res = finalMap;
    for (let key of keys) {
      if (!res[key]) {
        res[key] = {};
      }
      res = res[key];
    }
    return res;
  }

  function updateMap(keys, obj) {
    for (let key of Object.keys(obj)) {
      getOrCreate([...keys, key]);
      const type = getType(obj[key]);
      if (type === TYPE_KEY.ARRAY) {
        for (let item of obj[key]) {
          updateMap([...keys, key], item);
        }
      } else if (type === TYPE_KEY.OBJECT) {
        updateMap([...keys, key], obj[key]);
      }
    }
  }

  function analyze(keys, finalMap, obj) {
    for (let key of Object.keys(finalMap)) {
      if (Object.values(TYPE_KEY).indexOf(key) >= 0) continue;
      const rec = getOrCreate([...keys, key]);
      const type = getType(obj[key]);
      if (rec[type]) rec[type]++;
      else rec[type] = 1;
      if (type === TYPE_KEY.ARRAY) {
        for (let item of obj[key]) {
          analyze([...keys, key], finalMap[key], item);
        }
      } else if (type === TYPE_KEY.OBJECT) {
        analyze([...keys, key], finalMap[key], obj[key]);
      }
    }
  }

  // Generate final map
  for (let obj of list) {
    updateMap([], obj);
  }
  console.log(finalMap);

  for (let obj of list) {
    analyze([], finalMap, obj);
  }

  return finalMap;
}
