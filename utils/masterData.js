const collapseWhitespace = (value = "") =>
  value.toString().trim().replace(/\s+/g, " ");

const formatSegment = (segment, forceShortUppercase = false) => {
  if (!segment) return segment;
  if (/^\d+$/.test(segment)) return segment;

  if (forceShortUppercase && /^[a-z]+$/i.test(segment) && segment.length <= 4) {
    return segment.toUpperCase();
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
};

const formatToken = (token, forceShortUppercase = false) =>
  token
    .split(/([./&()-])/)
    .map((segment) => {
      if (!segment || /^[./&()-]$/.test(segment)) return segment;
      return formatSegment(segment, forceShortUppercase);
    })
    .join("");

export const normalizeMasterDataName = (type, value) => {
  const cleaned = collapseWhitespace(value);
  if (!cleaned) return "";

  const forceShortUppercase = type === "degree";

  return cleaned
    .split(" ")
    .map((token) => formatToken(token, forceShortUppercase))
    .join(" ");
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const LOOKUP_CONFIG = {
  college: {
    table: "college_tbl",
    idColumn: "College_ID",
    nameColumn: "College_Name",
    insertSql:
      "INSERT INTO college_tbl (College_Name, City, State) VALUES (?, ?, ?)",
    getInsertValues: (name) => [name, "Unknown", "Unknown"],
  },
  degree: {
    table: "degree_tbl",
    idColumn: "Degree_ID",
    nameColumn: "Degree_Name",
    insertSql: "INSERT INTO degree_tbl (Degree_Name) VALUES (?)",
    getInsertValues: (name) => [name],
  },
  subject: {
    table: "subject_tbl",
    idColumn: "Subject_ID",
    nameColumn: "Subject_Name",
    insertSql: "INSERT INTO subject_tbl (Subject_Name) VALUES (?)",
    getInsertValues: (name) => [name],
  },
  hobby: {
    table: "hobbies_tbl",
    idColumn: "Hobby_ID",
    nameColumn: "Hobby_Name",
    insertSql: "INSERT INTO hobbies_tbl (Hobby_Name) VALUES (?)",
    getInsertValues: (name) => [name],
  },
};

const findLookupByName = async (connection, config, name) => {
  const [rows] = await connection.query(
    `SELECT ${config.idColumn}, ${config.nameColumn}
     FROM ${config.table}
     WHERE LOWER(TRIM(${config.nameColumn})) = LOWER(TRIM(?))
     LIMIT 1`,
    [name],
  );

  return rows[0] || null;
};

export const ensureLookupValue = async (connection, type, rawName) => {
  const config = LOOKUP_CONFIG[type];
  if (!config) {
    throw new Error(`Unsupported lookup type: ${type}`);
  }

  const normalizedName = normalizeMasterDataName(type, rawName);
  if (!normalizedName) return null;

  const existing = await findLookupByName(connection, config, normalizedName);
  if (existing) {
    return {
      id: existing[config.idColumn],
      name: existing[config.nameColumn],
      created: false,
    };
  }

  try {
    const [result] = await connection.query(
      config.insertSql,
      config.getInsertValues(normalizedName),
    );

    return {
      id: result.insertId,
      name: normalizedName,
      created: true,
    };
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      throw error;
    }

    const duplicate = await findLookupByName(connection, config, normalizedName);
    if (!duplicate) throw error;

    return {
      id: duplicate[config.idColumn],
      name: duplicate[config.nameColumn],
      created: false,
    };
  }
};

export const ensureDegreeSubjectMapping = async (
  connection,
  degreeId,
  subjectId,
) => {
  if (!degreeId || !subjectId) return;

  const [existing] = await connection.query(
    `SELECT DS_ID
     FROM degree_subject_mapping_tbl
     WHERE Degree_ID = ? AND Subject_ID = ?
     LIMIT 1`,
    [degreeId, subjectId],
  );

  if (existing.length > 0) return;

  await connection.query(
    `INSERT INTO degree_subject_mapping_tbl (Degree_ID, Subject_ID)
     VALUES (?, ?)`,
    [degreeId, subjectId],
  );
};

export const resolveDegreeSubjectIds = async (
  connection,
  { Degree_ID, Subject_ID, New_Degree_Name, New_Subject_Name },
) => {
  let degreeId = parsePositiveInt(Degree_ID);
  let subjectId = parsePositiveInt(Subject_ID);

  if (!degreeId && New_Degree_Name) {
    degreeId = (await ensureLookupValue(connection, "degree", New_Degree_Name))
      ?.id;
  }

  if (!subjectId && New_Subject_Name) {
    subjectId = (await ensureLookupValue(connection, "subject", New_Subject_Name))
      ?.id;
  }

  if (degreeId && subjectId) {
    await ensureDegreeSubjectMapping(connection, degreeId, subjectId);
  }

  return { degreeId, subjectId };
};

export const resolveHobbyIds = async (
  connection,
  existingHobbyIds = [],
  customHobbyNames = [],
) => {
  const resolvedIds = new Set(
    existingHobbyIds.map(parsePositiveInt).filter(Boolean),
  );

  for (const hobbyName of customHobbyNames) {
    const hobby = await ensureLookupValue(connection, "hobby", hobbyName);
    if (hobby?.id) {
      resolvedIds.add(hobby.id);
    }
  }

  return [...resolvedIds];
};
