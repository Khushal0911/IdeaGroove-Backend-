import db from "../config/db.js";

export const getNotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const filter = req.query.filter || "all";
    const degreeId = req.query.degree ? parseInt(req.query.degree) : null;
    const subjectId = req.query.subject ? parseInt(req.query.subject) : null;

    let conditions = ["n.Is_Active = 1"];
    const queryParams = [];

    if (search) {
      conditions.push("(n.Description LIKE ? OR sub.Subject_Name LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (degreeId) {
      conditions.push("n.Degree_ID = ?");
      queryParams.push(degreeId);
    }

    if (subjectId) {
      conditions.push("n.Subject_ID = ?");
      queryParams.push(subjectId);
    }

    const whereClause = conditions.join(" AND ");
    const orderClause =
      filter === "oldest_to_newest"
        ? "ORDER BY n.Added_on ASC"
        : "ORDER BY n.Added_on DESC";

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM notes_tbl n
       LEFT JOIN subject_tbl sub ON n.Subject_ID = sub.Subject_ID
       WHERE ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    const allNotesQuery = `
      SELECT 
        n.N_ID,
        n.Note_File,
        n.File_Name,
        n.Description,
        n.Is_Active,
        n.Added_on,
        n.Added_By,
        s.Username AS Author,
        s.S_ID AS Author_ID,
        d.Degree_Name,
        d.Degree_ID,
        sub.Subject_Name,
        sub.Subject_ID
      FROM notes_tbl n
      LEFT JOIN student_tbl s   ON n.Added_By = s.S_ID
      LEFT JOIN degree_tbl d    ON n.Degree_ID = d.Degree_ID
      LEFT JOIN subject_tbl sub ON n.Subject_ID = sub.Subject_ID
      WHERE ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const [notes] = await db.query(allNotesQuery, [
      ...queryParams,
      limit,
      offset,
    ]);

    res.status(200).json({
      status: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      notes,
    });
  } catch (err) {
    console.error("Fetch Notes Error: ", err);
    res.status(500).json({ status: false, error: "Failed to fetch notes" });
  }
};

export const getUserNotes = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM notes_tbl WHERE Added_By = ? AND Is_Active = 1`,
      [userId],
    );
    const total = countResult[0].total;

    const query = `
      SELECT n.*, s.Username as Author 
      FROM notes_tbl n 
      LEFT JOIN student_tbl s ON n.Added_By = s.S_ID
      WHERE n.Added_By = ? AND n.Is_Active = 1
      ORDER BY n.Added_on DESC
      LIMIT ? OFFSET ?`;

    const [notes] = await db.query(query, [userId, limit, offset]);

    res.status(200).json({
      status: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      notes,
    });
  } catch (err) {
    console.error("Fetch User Notes Error: ", err);
    res
      .status(500)
      .json({ status: false, error: "Failed to fetch user notes" });
  }
};

export const addNotes = async (req, res) => {
  const { Degree_ID, Subject_ID, Description, Added_By } = req.body || {};
  const Note_File = req.file ? req.file.path : null;
  const File_Name = req.file ? req.file.originalname : null;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const addNotesQuery = `INSERT INTO notes_tbl (Note_File, File_Name, Added_By, Added_on, Degree_ID, Subject_ID, Description, Is_Active) VALUES (?, ?, ?, NOW(), ?, ?, ?, 1)`;

    const [result] = await connection.query(addNotesQuery, [
      Note_File,
      File_Name,
      Added_By,
      Degree_ID,
      Subject_ID,
      Description,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(201)
        .json({ status: true, message: "Notes Uploaded Successfully" });
    } else {
      await connection.rollback();
      res
        .status(400)
        .json({ status: false, message: "Failed to upload notes" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Creation Error : ", {
      err,
      sqlMessage: err.sqlMessage,
    });
    res
      .status(500)
      .json({ error: "Failed to create Notes", sqlMessage: err.sqlMessage });
  } finally {
    if (connection) connection.release();
  }
};

export const updateNotes = async (req, res) => {
  const { Degree_ID, Subject_ID, Description, N_ID } = req.body;
  const Note_File = req.file ? req.file.path : null;
  const File_Name = req.file ? req.file.filename : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    let updateNotesQuery;
    let queryParams;

    if (Note_File && File_Name) {
      // New file uploaded — update everything including file fields
      updateNotesQuery = `UPDATE notes_tbl SET Note_File = ?, File_Name = ?, Degree_ID = ?, Subject_ID = ?, Description = ? WHERE N_ID = ?`;
      queryParams = [
        Note_File,
        File_Name,
        Degree_ID,
        Subject_ID,
        Description,
        N_ID,
      ];
    } else {
      // No new file — keep existing file, update only metadata
      updateNotesQuery = `UPDATE notes_tbl SET Degree_ID = ?, Subject_ID = ?, Description = ? WHERE N_ID = ?`;
      queryParams = [Degree_ID, Subject_ID, Description, N_ID];
    }

    const [result] = await connection.query(updateNotesQuery, queryParams);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Notes Updated Successfully" });
    } else {
      await connection.rollback();
      res
        .status(404)
        .json({ status: false, message: "Notes not found or no changes made" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Updation Error : ", err);
    return res.status(500).json({ error: "Failed to update notes" });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteNotes = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const deleteNotesQuery = `UPDATE notes_tbl SET Deleted_On = NOW(), Is_Active = 0 WHERE N_ID = ?`;
    const [result] = await connection.query(deleteNotesQuery, [id]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res
        .status(200)
        .json({ status: true, message: "Notes Deleted Successfully" });
    } else {
      await connection.rollback();
      res
        .status(404)
        .json({ status: false, message: "Notes already deleted or not found" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Deletion Error", err);
    return res.status(500).json({ error: "Failed to delete notes" });
  } finally {
    if (connection) connection.release();
  }
};
