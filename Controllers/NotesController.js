import db from "../config/db.js";

export const getNotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM notes_tbl WHERE Is_Active = 1`,
    );
    const total = countResult[0].total;

    const allNotesQuery = `
  SELECT 
    n.N_ID,
    n.Note_File,
    n.Description,
    n.Is_Active,
    n.Added_on,

    s.Username AS Author,
    s.S_ID AS Author_ID,

    d.Degree_Name,
    sub.Subject_Name

  FROM notes_tbl n

  LEFT JOIN student_tbl s 
    ON n.Added_By = s.S_ID

  LEFT JOIN degree_tbl d 
    ON n.Degree_ID = d.Degree_ID

  LEFT JOIN subject_tbl sub 
    ON n.Subject_ID = sub.Subject_ID

  WHERE n.Is_Active = 1

  ORDER BY n.Added_on DESC
  LIMIT ? OFFSET ?
`;

    const [notes] = await db.query(allNotesQuery, [limit, offset]);

    res.status(200).json({
      status: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      notes: notes,
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
            SELECT n.*, s.username as Author 
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
      notes: notes,
    });
  } catch (err) {
    console.error("Fetch User Notes Error: ", err);
    res
      .status(500)
      .json({ status: false, error: "Failed to fetch user notes" });
  }
};

export const addNotes = async (req, res) => {
  const { Degree_ID, Subject_ID, Description, Added_By } = req.body;
  const Note_File = req.file ? req.file.path : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const addNotesQuery = `INSERT INTO notes_tbl (Note_File,Added_By,Added_on,Degree_ID,Subject_ID,Description,Is_Active) values (?,?,NOW(),?,?,?,1)`;

    const [result] = await connection.query(addNotesQuery, [
      Note_File,
      Added_By,
      Degree_ID,
      Subject_ID,
      Description,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res.status(201).json({
        status: true,
        message: "Notes Uploaded Successfully",
      });
    } else {
      await connection.rollback();
      res.status(400).json({
        status: false,
        message: "Failed to upload notes",
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Creation Error : ", {err,sqlMessage: err.sqlMessage
    });
    res.status(500).json({
      error: "Failed to create Notes",
      sqlMessage: err.sqlMessage
    });
  } finally {
    if (connection) connection.release();
  }
};

export const updateNotes = async (req, res) => {
  const { Degree_ID, Subject_ID, Description, N_ID } = req.body;
  const Note_File = req.file ? req.file.path : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const updateNotesQuery = `UPDATE notes_tbl SET Note_File = ?, Degree_ID= ?, Subject_ID = ?, Description = ? 
        WHERE N_ID = ?`;

    const [result] = await connection.query(updateNotesQuery, [
      Note_File,
      Degree_ID,
      Subject_ID,
      Description,
      N_ID,
    ]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message: "Notes Updated Successfully",
      });
    } else {
      await connection.rollback();
      res.status(404).json({
        status: false,
        message: "Notes not found or no changes made",
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Updation Error : ", err);
    return res.status(500).json({
      error: "Failed to update notes",
    });
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

    const deleteNotesQuery = `UPDATE notes_tbl 
        SET Deleted_On = NOW(), is_Active = 0 
        WHERE N_ID = ?`;

    const [result] = await connection.query(deleteNotesQuery, [id]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message: "Notes Deleted Successfully",
      });
    } else {
      await connection.rollback();
      res.status(404).json({
        status: false,
        message: "Notes already deleted or not found",
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Notes Deletion Error", err);
    return res.status(500).json({
      error: "Failed to delete notes",
    });
  } finally {
    if (connection) connection.release();
  }
};
