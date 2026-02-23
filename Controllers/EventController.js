import db from "../config/db.js";

//Getting events based on the page number sent by the frontend
export const getEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) as total FROM event_tbl WHERE Is_Active = 1`;
    const [countResult] = await db.query(countQuery);
    const total = countResult[0].total;

    if (total === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        page,
        totalPages: 0,
      });
    }

    const query = `
  SELECT 
    e.E_ID,
    e.Poster_File,
    e.Description,
    e.Event_Date,
    e.Added_On,
    e.Is_Active,
    s.S_ID AS Organizer_ID,
    s.Name AS Organizer_Name
  FROM event_tbl e
  LEFT JOIN student_tbl s 
    ON e.Added_By = s.S_ID
  WHERE e.Is_Active = 1
  ORDER BY e.Event_Date DESC
  LIMIT ? OFFSET ?
`;

    const [events] = await db.query(query, [limit, offset]);

    res.status(200).json({
      success: true,
      data: events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

//Getting events for the user loggedin
export const getUserEvents = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM event_tbl
      WHERE Is_Active = 1 AND Added_By = ?
    `;
    const [countResult] = await db.query(countQuery, [userId]);
    const total = countResult[0].total;

    const query = `
      SELECT e.*, s.username as Contact_Person
      FROM event_tbl e
      LEFT JOIN student_tbl s ON e.Added_By = s.S_ID
      WHERE e.Is_Active = 1 AND e.Added_By = ?
      ORDER BY Event_Date DESC
      LIMIT ? OFFSET ?
    `;

    const [events] = await db.query(query, [userId, limit, offset]);

    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No events found for this user",
        data: [],
        total: 0,
      });
    }

    res.status(200).json({
      success: true,
      data: events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user events" });
  }
};

export const addEvent = async (req, res) => {
  const { Description, Event_Date, Added_By } = req.body;
  const Poster_File = req.file ? req.file.path : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const createEventQuery = `INSERT INTO event_tbl (Description, Event_Date, Poster_File, Added_By, Added_on, Is_Active) Values (?,?,?,?,NOW(),?)`;

    await connection.query(createEventQuery, [
      Description.trim() || null,
      Event_Date,
      Poster_File,
      Added_By,
      1,
    ]);

    await connection.commit();
    res.status(201).json({
      status: true,
      message: "Event Published Successfully",
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Event Creation Error : ", err);
    return res.status(500).json({ error: "Failed to create event." });
  } finally {
    if (connection) connection.release();
  }
};

export const updateEvents = async (req, res) => {
  const { Description, Event_Date, E_ID } = req.body;
  const Poster_File = req.file ? req.file.path : null;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const updateEventQuery = `UPDATE event_tbl SET Poster_File = ?, Description = ?, Event_Date = ? Where E_ID = ?`;
    const [updateResult] = await connection.query(updateEventQuery, [
      Poster_File,
      Description,
      Event_Date,
      E_ID,
    ]);

    if (updateResult.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message: "Event updated successfully",
      });
    } else {
      await connection.rollback();
      res.status(404).json({
        status: false,
        message: "Event not found or no changes made",
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Event updation Error :", err);
    return res.status(500).json({ error: "Failed to update event." });
  } finally {
    if (connection) connection.release();
  }
};

export const updateEventEngagement = async (req, res) => {
  const { E_ID, type } = req.body; // type should be 'interested' or 'not_interested'

  if (!["interested", "not_interested"].includes(type)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid engagement type" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const column = type === "interested" ? "Interested" : "Not_Interested";

    const engagementQuery = `UPDATE event_tbl SET ${column} = ${column} + 1 WHERE E_ID = ? AND Is_Active = 1`;

    const [result] = await connection.query(engagementQuery, [E_ID]);

    if (result.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message: `Successfully marked as ${type.replace("_", " ")}`,
      });
    } else {
      await connection.rollback();
      res.status(404).json({ status: false, message: "Event not found" });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Engagement Update Error:", err);
    res.status(500).json({ error: "Failed to update engagement" });
  } finally {
    if (connection) connection.release();
  }
};

export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const deleteEventQuery = `UPDATE event_tbl 
        SET Deleted_On = NOW(), is_Active = 0 
        WHERE E_ID = ?`;
    const [deleteResult] = await connection.query(deleteEventQuery, [id]);

    if (deleteResult.affectedRows > 0) {
      await connection.commit();
      res.status(200).json({
        status: true,
        message: "Event deleted successfully",
      });
    } else {
      await connection.rollback();
      res.status(404).json({
        status: false,
        message: "Event not found or already deleted",
      });
    }
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Event Deletion Error", err);
    return res.status(500).json({
      error: "Failed to delete events",
    });
  } finally {
    if (connection) connection.release();
  }
};
